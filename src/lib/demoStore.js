// Store de DEMO gravável (localStorage). Permite criar/editar tarefas, deals,
// serviços de interesse e estratégia SEM Supabase, para validar o fluxo completo.
// Em produção (Supabase configurado) este módulo não é usado — ver data.js.

import demoAccounts from '../demo/accounts.json'
import { SERVICES_CATALOG } from '../data/servicesCatalog'
import { ABM_ACTIVE, DEFAULT_LOST_REASONS } from './constants'

const KEY = 'consulcard-crm-demo-v8'

function uid() {
  return 'd-' + Math.random().toString(36).slice(2, 10)
}

function seed() {
  const accounts = structuredClone(demoAccounts)
  // Garante id em cada contato (a base demo não traz ids).
  accounts.forEach((a) => (a.contacts || []).forEach((c) => { if (!c.id) c.id = uid() }))

  const services = SERVICES_CATALOG.map((s) => ({
    id: `svc-${s.service_id}`,
    ...s,
    active: true,
  }))

  // Espalha as contas ABM ativas pelas etapas do funil para o gráfico ter forma.
  const stages = ['lead', 'qualificado', 'proposta', 'negociacao', 'fechado']
  const abm = accounts.filter((a) => ABM_ACTIVE.includes(a.classification))
  const today = new Date()
  const tempByStage = { lead: 0, qualificado: 60, proposta: 75, negociacao: 90, fechado: 100 }
  abm.forEach((a, i) => {
    a.crm_stage = stages[i % stages.length]
    // Termômetro comercial (substitui a antiga "Saúde").
    a.commercial_temp = tempByStage[a.crm_stage] ?? 50
    // Data prevista de fechamento (alguns ~ próximos meses).
    const ec = new Date(today)
    ec.setDate(today.getDate() + 15 + (i % 6) * 20)
    a.expected_close = ec.toISOString().slice(0, 10)
  })

  // Usuários demo (para dono de oportunidade / responsável).
  const users = [
    { id: 'u-marcelo', email: 'marck.mpc@gmail.com', full_name: 'Marcelo Carvalho', role: 'admin', created_at: new Date().toISOString() },
    { id: 'u-adriana', email: 'adriana.tito@consulcard.com.br', full_name: 'Adriana Tito', role: null, created_at: new Date().toISOString() },
  ]

  // OPORTUNIDADES (account_services): 1-3 por conta ABM ativa, cada uma com
  // etapa, termômetro, dono e histórico de etapas próprios (reunião 13/07).
  const account_services = []
  abm.forEach((a, i) => {
    const macros = (a.macro_categories || []).map((m) => m.toLowerCase())
    let candidates = services.filter((s) =>
      macros.some((m) => m.includes(s.macro_label.toLowerCase().split('/')[0].trim().slice(0, 6))),
    )
    if (candidates.length === 0) candidates = services
    const n = 1 + (i % 3)
    const picked = candidates.slice(0, n)
    picked.forEach((s, j) => {
      const stage = stages[(i + j) % stages.length]
      // Aging variado para o dashboard demonstrar as faixas (alguns muito parados).
      const enteredDaysAgo = 3 + ((i * 17 + j * 41) % 230)
      const createdDaysAgo = enteredDaysAgo + 8 + ((i * 5 + j * 3) % 120)
      const created = new Date(today); created.setDate(today.getDate() - createdDaysAgo)
      const entered = new Date(today); entered.setDate(today.getDate() - enteredDaysAgo)
      const history = stage !== 'lead'
        ? [{ stage: 'lead', entered_at: created.toISOString(), left_at: entered.toISOString(), days: createdDaysAgo - enteredDaysAgo }]
        : []
      account_services.push({
        id: uid(),
        account_id: a.id,
        service_id: s.id,
        estimated_value_brl: s.suggested_value_brl,
        interest: ['interessado', 'proposto', 'explorando'][j % 3],
        notes: null,
        stage,
        commercial_temp: tempByStage[stage] ?? 0,
        owner_id: users[(i + j) % users.length].id,
        created_at: created.toISOString(),
        stage_entered_at: entered.toISOString(),
        stage_history: history,
        standby_review_date: null,
        lost_reason: null,
        proposal_link: null,
      })
    })
  })

  // Tarefas de ABM espalhadas nas próximas semanas (para a Agenda).
  const types = ['ligacao', 'reuniao', 'almoco', 'conteudo', 'evento', 'landing_page', 'podcast']
  const statuses = ['planejada', 'em_execucao', 'concluida', 'backlog']
  const tasks = []
  abm.forEach((a, i) => {
    const count = 1 + (i % 3)
    for (let k = 0; k < count; k++) {
      const d = new Date(today)
      d.setDate(today.getDate() + ((i + k * 5) % 30) - 5)
      const iso = d.toISOString().slice(0, 10)
      tasks.push({
        id: uid(),
        account_id: a.id,
        title: `${typeTitle(types[(i + k) % types.length])} — ${a.name}`,
        description: null,
        task_type: types[(i + k) % types.length],
        scheduled_date: iso,
        scheduled_time: null,
        status: statuses[(i + k) % statuses.length],
        owner_id: null,
        effort: null,
        result_notes: null,
        service_ids: account_services
          .filter((s) => s.account_id === a.id)
          .slice(0, 2)
          .map((s) => s.service_id),
      })
    }
  })

  // Interações de exemplo (histórico de toques) para as primeiras contas ABM.
  const interactionTemplates = [
    { type: 'ligacao', summary: 'Ligação de qualificação: cliente confirmou interesse e pediu proposta para o Q3.' },
    { type: 'reuniao', summary: 'Reunião de descoberta com o time de produto; mapeados 2 decisores e o orçamento.' },
    { type: 'email', summary: 'Enviado case de sucesso do segmento; cliente respondeu pedindo agenda.' },
    { type: 'almoco', summary: 'Almoço com o diretor para destravar a negociação comercial.' },
  ]
  const interactions = []
  abm.slice(0, 12).forEach((a, i) => {
    const n = 1 + (i % 3)
    for (let k = 0; k < n; k++) {
      const t = interactionTemplates[(i + k) % interactionTemplates.length]
      const d = new Date(today)
      d.setDate(today.getDate() - (k + 1) * 7 - i)
      interactions.push({ id: uid(), account_id: a.id, type: t.type, summary: t.summary, date: d.toISOString() })
    }
  })

  // Estratégia ABM de exemplo (caderno) para a primeira conta ABM.
  const strategies = {}
  if (abm[0]) {
    strategies[abm[0].id] = {
      account_id: abm[0].id,
      objective: 'Tornar-se o parceiro de referência em meios de pagamento da conta nos próximos 12 meses.',
      value_proposition: 'Redução de custo regulatório e time-to-market com squad sênior dedicado.',
      key_messages: 'Especialistas ex-BACEN; cases de emissor de cartão; metodologia em 5 fases.',
      decision_makers: 'Diretor de Produto (econômico), Head de Compliance (técnico), CFO (orçamento).',
      channels: 'LinkedIn do diretor, evento setorial em set/2026, podcast do mercado de pagamentos.',
      success_metrics: 'Reunião com C-level em 30 dias; proposta enviada em 60 dias; fechamento em 90 dias.',
      objections: 'Já têm fornecedor atual; preocupação com prazo regulatório.',
      notes: 'Conta-âncora do segmento — priorizar relacionamento de longo prazo.',
      updated_at: new Date().toISOString(),
    }
  }

  return {
    accounts,
    services,
    account_services,
    tasks,
    users,
    deals: [],
    strategies,
    interactions,
    lost_reasons: DEFAULT_LOST_REASONS.map((label, i) => ({ id: uid(), label, active: true, sort: i + 1 })),
  }
}

function typeTitle(t) {
  const map = {
    ligacao: 'Ligação', reuniao: 'Reunião', almoco: 'Almoço', conteudo: 'Conteúdo',
    evento: 'Evento', landing_page: 'Landing page', podcast: 'Podcast',
    encontro: 'Encontro', viagem: 'Viagem', outro: 'Toque',
  }
  return map[t] || 'Toque'
}

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  const s = seed()
  saveState(s)
  return s
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function resetState() {
  localStorage.removeItem(KEY)
  return loadState()
}

// helper de mutação
export function mutate(fn) {
  const s = loadState()
  const result = fn(s)
  saveState(s)
  return result
}

export { uid }
