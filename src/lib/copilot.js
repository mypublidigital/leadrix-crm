// Co-piloto ABM conversacional.
// - Produção: Edge Function crm-copilot (Claude Sonnet, última versão) com base de
//   conhecimento sobre ABM, Consulcard e seus serviços.
// - Demo: respostas heurísticas didáticas baseadas no contexto da conta na tela.

import { DEMO_MODE, invokeFn } from './data'
import { CRM_STAGES } from './constants'

// Monta um contexto compacto da conta para enviar ao agente.
export function accountContext(a) {
  return {
    conta: a.name,
    classificacao: a.classification,
    estagio: a.crm_stage,
    segmento: a.segment,
    porte: a.account_size,
    termometro_comercial: a.commercial_temp != null ? `${a.commercial_temp}%` : null,
    site: a.site,
    macro_categorias: a.macro_categories,
    anos_relacionamento: a.relationship_years,
    estrategia: a.account_strategy?.[0] || null,
    servicos_interesse: (a.account_services || []).map((s) => ({
      servico: s.service?.name, valor: s.estimated_value_brl, interesse: s.interest,
    })),
    contatos: (a.contacts || []).map((c) => ({ nome: c.name, cargo: c.role, email: c.email })),
    propostas_historicas: (a.proposals || []).map((p) => p.title).filter(Boolean).slice(0, 5),
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
  const stage = CRM_STAGES[ctx.estagio]?.label || ctx.estagio
  const svcs = ctx.servicos_interesse.map((s) => s.servico).filter(Boolean)
  const contato = ctx.contatos[0]?.nome || 'o contato principal'

  const intro = `Sobre **${ctx.conta}** (estágio _${stage}_${svcs.length ? `, interesse em ${svcs.join(', ')}` : ''}):`

  const playByStage = {
    lead: 'como a conta ainda é um lead, o foco é **qualificar**. Em ABM isso significa entender o momento da conta antes de propor: confirme quem decide, qual a dor regulatória/de produto e o orçamento. Sugiro uma ligação de qualificação seguida do envio de um case do segmento.',
    qualificado: 'a conta está qualificada — hora de **gerar valor e relacionamento**. Agende uma reunião de descoberta com o decisor e prepare conteúdo personalizado (a Consulcard pode usar um podcast ou landing dedicada para a conta).',
    proposta: 'com proposta em jogo, o foco é **provar valor e reduzir risco percebido**. Reforce os cases de projetos-âncora (emissor de cartão, BaaS, setup contábil) e proponha uma reunião de apresentação formal.',
    negociacao: 'em negociação, trabalhe a **relação humana e o senso de urgência**. Um almoço com o decisor costuma destravar; alinhe cronograma de fechamento e condições comerciais.',
    fechado: 'conta fechada — o ABM agora é de **expansão e retenção**. Garanta um bom kickoff (handoff para o Consulcard Projetos) e planeje toques de pós-venda para identificar novos serviços.',
    standby: 'a conta está em stand by — mantenha **relacionamento de baixa frequência** e defina um gatilho claro de reativação na data de revisão.',
    perdido: 'apesar de perdida, ABM é de longo prazo: planeje uma **reativação em ~90 dias** com um ângulo de valor novo.',
  }

  const didactic = playByStage[ctx.estagio] || playByStage.lead

  return `${intro}

${didactic}

**Próxima ação concreta que eu sugiro:**
1. Toque com ${contato}${svcs.length ? ` ancorado em "${svcs[0]}"` : ''}.
2. Registre o resultado nas Interações para alimentar o histórico da conta.
3. Atualize o estágio no Pipeline se a conversa avançar.

> _(Você perguntou: "${last.slice(0, 140)}". Em produção, este agente usa o Claude Sonnet com base de conhecimento de ABM + Consulcard + catálogo de serviços, respondendo de forma ainda mais contextual.)_`
}
