// Co-piloto ABM conversacional.
// - Produção: Edge Function crm-copilot (Claude) com base de conhecimento sobre
//   ABM, a Leadrix, os quatro pilares e o mercado da conta.
// - Demo: respostas heurísticas didáticas baseadas no contexto da conta na tela.

import { DEMO_MODE, invokeFn } from './data'
import { CRM_STAGES, ABM_TIERS } from './constants'
import { MARKETS, PILLARS } from '../data/leadrix'
import { committeeCoverage } from './abm'

// Monta um contexto compacto da conta para enviar ao agente.
export function accountContext(a) {
  const market = MARKETS[a.segment]
  const coverage = committeeCoverage(a)
  return {
    conta: a.name,
    classificacao: a.classification,
    mercado: market?.label || null,
    microssegmento: a.micro_segment || null,
    nivel_abm: a.abm_tier ? ABM_TIERS[a.abm_tier]?.label : null,
    porte: a.account_size,
    site: a.site,
    decisores_tipicos: market?.personas || [],
    comite_coberto: coverage.covered,
    comite_faltando: coverage.missing,
    dores_do_mercado: market?.pains || [],
    indicadores_do_mercado: market?.indicators || [],
    estrategia: a.account_strategy?.[0] || null,
    oportunidades: (a.account_services || []).map((s) => ({
      servico: s.service?.name,
      pilar: PILLARS[s.service?.macro_id]?.label || null,
      etapa: CRM_STAGES[s.stage]?.label || s.stage,
      valor: s.estimated_value_brl,
    })),
    contatos: (a.contacts || []).map((c) => ({ nome: c.name, cargo: c.role, email: c.email })),
    interacoes_recentes: (a.interactions || []).slice(0, 5).map((i) => i.summary),
  }
}

// Conversa: recebe o histórico de mensagens [{role, content}] e devolve a resposta.
export async function copilotChat(account, messages) {
  if (!DEMO_MODE) {
    const data = await invokeFn('crm-copilot', { accountId: account.id, messages })
    return data.reply || data.content || ''
  }

  // ── Heurística didática (demo) ───────────────────────────────
  await new Promise((r) => setTimeout(r, 600))
  const last = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
  const ctx = accountContext(account)
  const opps = ctx.oportunidades
  const main = opps.find((o) => !['Perdido', 'Fechado'].includes(o.etapa)) || opps[0]
  const stageKey = Object.keys(CRM_STAGES).find((k) => CRM_STAGES[k].label === main?.etapa) || 'lead'
  const contato = account.contacts?.[0]?.name || 'o contato principal'

  const intro = `Sobre **${ctx.conta}**${ctx.microssegmento ? ` (${ctx.microssegmento})` : ''}${main ? ` — oportunidade principal: _${main.servico}_ em ${main.etapa}` : ''}:`

  const playByStage = {
    lead: 'o foco é **insight antes do pitch**. Em ABM, entenda o momento da conta antes de propor: quem decide, qual indicador dói e que gatilho recente existe. Um convite para o Workshop Mensal Leadrix costuma abrir a conversa sem pressão comercial.',
    qualificado: 'a conta está qualificada — hora de **oferecer o Diagnóstico Leadrix**. Ele gera dado da própria conta e desenha a proposta junto com o cliente, reduzindo risco percebido.',
    proposta: 'com proposta em jogo, o foco é **dar ao sponsor argumentos para defender internamente**: business case com os indicadores do mercado dele e governança desde o início.',
    negociacao: 'em negociação, trabalhe um **plano mútuo de fechamento** com o campeão e, se travar, reposicione a conversa no nível dos sócios.',
    fechado: 'conta ganha — agora é **land and expand**: meça o resultado, faça a revisão com o sponsor e apresente o próximo pilar conectado.',
    standby: 'em stand by, mantenha **toques de baixa frequência e alto valor** até a data de revisão.',
    perdido: 'ABM é de longo prazo: planeje uma **reativação com um fato novo** em cerca de 90 dias.',
  }

  const gap = ctx.comite_faltando.length
    ? `\n\n**Comitê de compra:** faltam contatos para ${ctx.comite_faltando.join(', ')}. Oportunidades com um só interlocutor envelhecem mais — vale mapear pelo menos mais uma persona.`
    : ''

  return `${intro}

${playByStage[stageKey]}${gap}

**Próxima ação concreta que eu sugiro:**
1. Toque com ${contato}${ctx.indicadores_do_mercado[0] ? ` ancorado no indicador "${ctx.indicadores_do_mercado[0]}"` : ''}.
2. Veja as jogadas do Radar ABM desta conta — elas já trazem custo estimado e briefing de conteúdo.
3. Registre o resultado nas Interações para alimentar o histórico.

> _(Você perguntou: "${last.slice(0, 140)}". Em produção, este agente usa o Claude com a base de conhecimento de ABM, da Leadrix, dos quatro pilares e do mercado da conta.)_`
}
