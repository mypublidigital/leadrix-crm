// Mensageria: e-mails para o lead, automáticos por evento ou enviados à mão.
//
// Como funciona:
//   1. Modelos (`email_templates`) — assunto e corpo com marcadores, ligados a
//      um evento do CRM. Cada modelo pode estar em automático ou não.
//   2. Fila (`email_messages`) — todo e-mail nasce aqui, com status. Em
//      automático, já sai "agendado"; fora dele, fica "rascunho" para alguém
//      revisar. Nada sai do CRM sem passar por esta fila.
//   3. Envio — Edge Function `crm-email` usando a conta Gmail da Leadrix, com
//      escolha do alias remetente. Sem credencial configurada, a mensagem fica
//      na fila com o erro explicado (não se perde).
//
// A fila existe de propósito: e-mail é irreversível. Preferimos que o
// automático produza mensagens prontas para conferência do que disparos
// silenciosos que ninguém revisou.

import { DEMO_MODE, invokeFn, listEmailTemplates, createEmailMessage, listEmailSettings } from './data'
import { MARKETS, PILLARS } from '../data/leadrix'
import { CRM_STAGES } from './constants'

export const EMAIL_STATUS = {
  rascunho: { label: 'Rascunho', color: 'bg-ink-100 text-ink-600', help: 'Escrito, aguardando revisão e envio manual.' },
  agendado: { label: 'Agendado', color: 'bg-sky-100 text-sky-700', help: 'Pronto para enviar na data marcada.' },
  enviado: { label: 'Enviado', color: 'bg-emerald-100 text-emerald-700', help: 'Entregue ao Gmail da Leadrix.' },
  erro: { label: 'Erro', color: 'bg-rose-100 text-rose-700', help: 'O envio falhou — veja o motivo e tente de novo.' },
  cancelado: { label: 'Cancelado', color: 'bg-ink-100 text-ink-400', help: 'Descartado sem envio.' },
}

// Eventos do CRM que podem disparar e-mail. `auto` indica se faz sentido
// automatizar por padrão (o modelo decide, isto é só a sugestão).
export const EMAIL_EVENTS = {
  conta_criada: { label: 'Conta criada', help: 'Primeiro contato depois de cadastrar a conta.', auto: false },
  oportunidade_criada: { label: 'Oportunidade criada', help: 'Interesse registrado em um serviço.', auto: false },
  etapa_qualificado: { label: 'Oportunidade → Qualificado', help: 'Convite para a conversa de diagnóstico.', auto: true },
  etapa_proposta: { label: 'Oportunidade → Proposta', help: 'Envio da proposta ou do business case.', auto: true },
  etapa_negociacao: { label: 'Oportunidade → Negociação', help: 'Plano mútuo de fechamento.', auto: false },
  etapa_fechado: { label: 'Oportunidade → Fechado', help: 'Boas-vindas e próximos passos da implantação.', auto: true },
  etapa_standby: { label: 'Oportunidade → Stand by', help: 'Confirmação da data de revisão.', auto: false },
  etapa_perdido: { label: 'Oportunidade → Perdido', help: 'Encerramento de ciclo, porta aberta.', auto: false },
  acao_concluida: { label: 'Ação ABM concluída', help: 'Resumo depois de reunião, workshop ou diagnóstico.', auto: false },
  aging_critico: { label: 'Aging crítico', help: 'Retomada quando a oportunidade passa de 2× o SLA.', auto: false },
  manual: { label: 'Envio manual', help: 'Modelo usado sob demanda, sem evento.', auto: false },
}

export const EMAIL_EVENT_IDS = Object.keys(EMAIL_EVENTS)

// Marcadores disponíveis nos modelos.
export const EMAIL_PLACEHOLDERS = [
  { key: 'contato', what: 'Nome completo do contato' },
  { key: 'primeiro_nome', what: 'Primeiro nome do contato' },
  { key: 'conta', what: 'Nome da conta' },
  { key: 'mercado', what: 'Mercado (macrossegmento)' },
  { key: 'microssegmento', what: 'Microssegmento' },
  { key: 'pilar', what: 'Pilar da oportunidade' },
  { key: 'servico', what: 'Serviço da oportunidade' },
  { key: 'etapa', what: 'Etapa do funil' },
  { key: 'indicador', what: 'Primeiro indicador do mercado' },
  { key: 'hipotese', what: 'Hipótese de valor registrada na estratégia' },
  { key: 'remetente', what: 'Nome de quem assina' },
  { key: 'assinatura', what: 'Assinatura completa configurada' },
]

const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || ''

/** Valores dos marcadores a partir do contexto. */
export function templateVars({ account, contact, opportunity, strategy, sender }) {
  const market = MARKETS[account?.segment]
  return {
    contato: contact?.name || '',
    primeiro_nome: firstName(contact?.name) || '',
    conta: account?.name || '',
    mercado: market?.label || '',
    microssegmento: account?.micro_segment || '',
    pilar: PILLARS[opportunity?.service?.macro_id]?.label || '',
    servico: opportunity?.service?.name || '',
    etapa: CRM_STAGES[opportunity?.stage]?.label || '',
    indicador: market?.indicators?.[0] || '',
    hipotese: strategy?.hypothesis || '',
    remetente: sender?.name || 'Equipe Leadrix',
    assinatura: sender?.signature || 'Equipe Leadrix',
  }
}

/** Substitui {{marcador}}. Marcador sem valor sai como texto vazio. */
export function render(text, vars) {
  return String(text || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => vars[k.toLowerCase()] ?? '')
}

export function renderTemplate(template, ctx) {
  const vars = templateVars(ctx)
  return {
    subject: render(template.subject, vars),
    body: render(template.body, vars),
    missing: EMAIL_PLACEHOLDERS
      .filter((p) => new RegExp(`\\{\\{\\s*${p.key}\\s*\\}\\}`, 'i').test(`${template.subject} ${template.body}`) && !vars[p.key])
      .map((p) => p.key),
  }
}

/** Contato que deve receber: o principal, ou o primeiro com e-mail. */
export function pickRecipient(account, contactId) {
  const contacts = (account?.contacts || []).filter((c) => c.email)
  if (contactId) {
    const chosen = contacts.find((c) => c.id === contactId)
    if (chosen) return chosen
  }
  return contacts.find((c) => c.is_primary) || contacts[0] || null
}

/**
 * Dispara um evento: para cada modelo ativo daquele evento, coloca uma
 * mensagem na fila. Modelo em automático entra como "agendado"; os demais como
 * "rascunho". Não envia nada aqui — quem envia é `sendEmail`.
 *
 * Nunca lança: um problema de e-mail não deve impedir a operação comercial.
 */
export async function triggerEmailEvent(event, ctx) {
  try {
    const [templates, settings] = await Promise.all([listEmailTemplates(), listEmailSettings()])
    const actives = templates.filter((t) => t.active !== false && t.event === event)
    if (!actives.length) return { queued: 0 }
    const contact = pickRecipient(ctx.account, ctx.contactId)
    if (!contact) return { queued: 0, reason: 'sem contato com e-mail' }

    let queued = 0
    for (const t of actives) {
      const { subject, body } = renderTemplate(t, { ...ctx, sender: settings })
      await createEmailMessage({
        account_id: ctx.account.id,
        contact_id: contact.id,
        opportunity_id: ctx.opportunity?.id || null,
        task_id: ctx.task?.id || null,
        template_id: t.id,
        event,
        to_email: contact.email,
        to_name: contact.name,
        from_alias: t.from_alias || settings.default_alias,
        subject,
        body,
        status: t.auto ? 'agendado' : 'rascunho',
        scheduled_at: scheduleFor(t),
      })
      queued += 1
    }
    return { queued }
  } catch (e) {
    return { queued: 0, error: e.message }
  }
}

function scheduleFor(template) {
  const days = Number(template.delay_days) || 0
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

/**
 * Envia de verdade (Edge Function `crm-email` → Gmail da Leadrix).
 * Em demonstração, simula o envio para o fluxo poder ser testado.
 */
export async function sendEmail(message) {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 400))
    return { ok: true, simulated: true, provider_message_id: `demo-${Date.now()}` }
  }
  return invokeFn('crm-email', {
    messageId: message.id,
    to: message.to_email,
    toName: message.to_name,
    fromAlias: message.from_alias,
    subject: message.subject,
    body: message.body,
  })
}
