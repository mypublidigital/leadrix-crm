// Motor de sugestões ABM proativas.
//
// Para cada oportunidade, lê o aging (dias na etapa × SLA da etapa), o nível
// ABM da conta, o mercado/microssegmento, o pilar do serviço e a cobertura do
// comitê de compra, e escolhe no playbook (src/data/abmPlaybook.js) as jogadas
// que fazem sentido agora — com custo estimado e briefing de conteúdo pronto.
//
// Roda inteiro no navegador, sem IA: a seleção é determinística e auditável —
// a regra está escrita no playbook e o time consegue discordar dela. A IA
// entra depois, no co-piloto e na geração do conteúdo de cada jogada.

import { PLAYS, AGING_LEVEL_ORDER, NEXT_PILLAR, agingLevel } from '../data/abmPlaybook'
import { CAMPAIGNS, journeyForStage, icpTotal, icpBand, SIGNAL_LABEL } from '../data/abmContext'
import { MARKETS, PILLARS } from '../data/leadrix'
import { CRM_STAGES } from './constants'
import { daysSince } from './finance'
import { estimateActionCost, withDefaults } from './costs'

const TIER_WEIGHT = { '1:1': 1.5, '1:few': 1.2, '1:many': 1 }
const DISMISS_DAYS = 30

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// "Diretor(a) de Operações" → "oper"; "CEO" → "ceo"; "Sócio(a)" → "soci".
function personaKey(persona) {
  const cleaned = norm(persona)
    .replace(/\(a\)/g, '')
    .replace(/^(diretor|diretora|lider|head|gerente)\s+(de\s+)?/, '')
    .replace(/\bde\s+/g, '')
    .trim()
  const first = cleaned.split(/\s+/)[0] || cleaned
  return first.length <= 4 ? first : first.slice(0, 4)
}

function matchesPersona(role, persona) {
  const key = personaKey(persona)
  const r = norm(role)
  return key.length <= 3 ? r.split(/[^a-z]+/).includes(key) : r.includes(key)
}

/** Cobertura do comitê de compra: quais personas do mercado já têm contato. */
export function committeeCoverage(account) {
  const market = MARKETS[account?.segment]
  if (!market) return { personas: [], covered: [], missing: [], ratio: null }
  const roles = (account.contacts || []).map((c) => norm(c.role))
  const covered = []
  const missing = []
  market.personas.forEach((p) => {
    const hit = roles.some((r) => matchesPersona(r, p))
    ;(hit ? covered : missing).push(p)
  })
  return { personas: market.personas, covered, missing, ratio: covered.length / market.personas.length }
}

const ROLE_PERSONA = {
  sponsor: (m) => m.personas[0],
  campeao: (m) => m.personas[Math.min(1, m.personas.length - 1)],
  pessoas: () => 'Liderança de Pessoas / RH',
  inovacao: () => 'Liderança de Inovação, estratégia ou produto',
  influenciador: () => 'Liderança de TI, dados ou segurança',
  financeiro: () => 'CFO / liderança financeira',
  usuario: () => 'Gerentes e times que vivem o processo',
  bloqueador: () => 'Jurídico, privacidade ou compras',
}

// Papéis do grupo decisor reconhecidos pelo cargo do contato (contexto ABM §5).
const COMMITTEE_ROLE_KEYS = {
  sponsor: ['ceo', 'presidente', 'socio', 'socia', 'proprietari', 'unidade de negocio', 'fundador'],
  campeao: ['operac', 'coo', 'excelencia', 'transformac', 'rede', 'expansao', 'comercial'],
  pessoas: ['rh', 'pessoas', 'gente', 'recursos humanos', 'talento'],
  inovacao: ['inovac', 'estrategia', 'produto', 'growth'],
  influenciador: ['ti', 'tecnologia', 'cto', 'cio', 'dados', 'seguranca', 'engenharia', 'arquitet'],
  financeiro: ['cfo', 'financ', 'controladoria'],
  bloqueador: ['juridic', 'legal', 'privacidade', 'compliance', 'compras', 'suprimentos'],
  usuario: ['gerente', 'coordenador', 'supervisor', 'consultor'],
}

/**
 * Papéis do grupo decisor cobertos por contato cadastrado.
 * `developed`: a conta deixa de depender de uma pessoa só quando há
 * patrocinador econômico + responsável operacional + aprovador técnico/de risco.
 */
export function committeeRoles(account) {
  const roles = (account?.contacts || []).map((c) => norm(c.role))
  const covered = Object.keys(COMMITTEE_ROLE_KEYS).filter((role) =>
    roles.some((r) => COMMITTEE_ROLE_KEYS[role].some((k) => r.includes(k))),
  )
  const has = (r) => covered.includes(r)
  return {
    covered,
    missing: Object.keys(COMMITTEE_ROLE_KEYS).filter((r) => !covered.includes(r)),
    developed: has('sponsor') && has('campeao') && (has('influenciador') || has('financeiro') || has('bloqueador')),
    contacts: (account?.contacts || []).length,
  }
}

/** Pontuação ICP da conta e faixa correspondente. */
export function accountIcp(account) {
  const total = icpTotal(account?.icp_scores)
  const band = icpBand(total, account?.icp_blockers || [])
  const scored = Object.keys(account?.icp_scores || {}).length > 0
  return { total, band, scored }
}

function pickContact(account, persona) {
  return (account.contacts || []).find((c) => matchesPersona(c.role, persona)) || null
}

/** Aging comercial da oportunidade, considerando as particularidades de cada etapa. */
export function opportunityAgingState(opp, settings) {
  const s = withDefaults(settings)
  const stage = opp.stage
  const days = daysSince(opp.stage_entered_at || opp.created_at) ?? 0
  const sla = Number(s.aging_sla[stage]) || 30
  let level = agingLevel(days, sla)
  // Stand by com data de revisão vencida é no mínimo crítico.
  if (stage === 'standby' && opp.standby_review_date && opp.standby_review_date < new Date().toISOString().slice(0, 10)) {
    if (AGING_LEVEL_ORDER.indexOf(level.key) < 2) level = { ...agingLevel(sla * 2.5, sla), ratio: days / sla }
  }
  return { days, sla, level }
}

function isDone(play, opp, tasks) {
  return tasks.some((t) =>
    t.abm_play_id === play.id &&
    (t.opportunity_id === opp.id || (!t.opportunity_id && t.account_id === opp.account_id)) &&
    t.status !== 'cancelada' &&
    (!opp.stage_entered_at || (t.created_at || t.scheduled_date || '') >= opp.stage_entered_at.slice(0, 10)),
  )
}

function isDismissed(play, opp, dismissals) {
  const limit = Date.now() - DISMISS_DAYS * 86400000
  return dismissals.some((d) => d.opportunity_id === opp.id && d.play_id === play.id && new Date(d.created_at).getTime() > limit)
}

/**
 * Sugestões para UMA oportunidade.
 * @returns { aging, coverage, plays: [...], score } ou null se nada a sugerir.
 */
export function suggestForOpportunity(opp, { account, tasks = [], dismissals = [], settings, maxPlays = 3 }) {
  if (!opp || opp.stage === 'perdido' || !account) return null
  const aging = opportunityAgingState(opp, settings)
  // No fechado só sugerimos expansão depois do SLA de pós-venda.
  if (opp.stage === 'fechado' && aging.level.key === 'no_prazo') return null

  const tier = account.abm_tier || '1:few'
  const market = MARKETS[account.segment] || null
  const pillarId = opp.service?.macro_id || null
  const pillar = PILLARS[pillarId] || null
  const coverage = committeeCoverage(account)
  const committee = committeeRoles(account)
  const icp = accountIcp(account)
  const signals = account.signals || []
  const campaign = CAMPAIGNS[account.campaign] || null
  const journey = journeyForStage(opp.stage)
  const levelIdx = AGING_LEVEL_ORDER.indexOf(aging.level.key)

  const candidates = PLAYS
    .filter((p) => p.stages.includes(opp.stage))
    .filter((p) => p.levels.includes(aging.level.key))
    .filter((p) => !p.tiers || p.tiers.includes(tier))
    // Jogadas que dependem de um sinal de intenção só entram quando ele existe.
    .filter((p) => !p.requiresSignal || (typeof p.requiresSignal === 'string' ? signals.includes(p.requiresSignal) : signals.length > 0))
    .filter((p) => !isDone(p, opp, tasks) && !isDismissed(p, opp, dismissals))
    // Prioriza jogadas desenhadas para a faixa mais severa em que ainda valem.
    .sort((a, b) => {
      const ma = Math.max(...a.levels.map((l) => AGING_LEVEL_ORDER.indexOf(l)))
      const mb = Math.max(...b.levels.map((l) => AGING_LEVEL_ORDER.indexOf(l)))
      return Math.abs(ma - levelIdx) - Math.abs(mb - levelIdx)
    })
    .slice(0, maxPlays)

  if (!candidates.length) return null

  const stageLabel = CRM_STAGES[opp.stage]?.label || opp.stage
  const context = opp.stage === 'fechado'
    ? `Ganha há ${aging.days} dias (janela de expansão a partir de ${aging.sla}).`
    : `Há ${aging.days} dias em ${stageLabel} — SLA de ${aging.sla} dias (${aging.level.ratio.toFixed(1).replace('.', ',')}×).`

  const plays = candidates.map((p) => {
    const persona = market ? (ROLE_PERSONA[p.role] || ROLE_PERSONA.sponsor)(market) : null
    // Multi-threading: se o papel alvo já está coberto, sugira a primeira persona faltante.
    const targetPersona = p.id.includes('multithreading') && coverage.missing.length ? coverage.missing[0] : persona
    const contact = targetPersona ? pickContact(account, targetPersona) : null
    const cost = estimateActionCost({ taskType: p.task_type, people: p.people, expenses: p.expenses || [] }, settings)
    const nextPillarId = p.expansion ? NEXT_PILLAR[pillarId] : null
    const content = p.content
      ? {
          format: p.content.format,
          angle: p.content.angle,
          account_id: account.id,
          opportunity_id: opp.id,
          play_id: p.id,
          segment: account.segment || '',
          micro_segment: account.micro_segment || '',
          pillar: pillarId || '',
          persona: targetPersona || '',
          stage: opp.stage,
        }
      : null
    return {
      ...p,
      persona: targetPersona,
      contact,
      cost,
      content,
      nextPillar: nextPillarId ? PILLARS[nextPillarId] : null,
      useCase: market && pillarId ? market.useCases[pillarId] : null,
      indicators: market?.indicators?.slice(0, 3) || [],
      signals: signals.map((s) => SIGNAL_LABEL[s] || s),
    }
  })

  const value = Number(opp.estimated_value_brl) || 0
  // Urgência: faixa de aging × valor × nível ABM, com peso extra quando há
  // sinal de intenção ativo, o comitê ainda depende de uma pessoa ou a conta
  // pontua como nível 1 no ICP.
  const score = aging.level.weight
    * (1 + Math.log10(1 + value / 10000))
    * (TIER_WEIGHT[tier] || 1)
    * (signals.length ? 1.25 : 1)
    * (committee.developed ? 1 : 1.15)
    * (icp.scored && icp.band.tier === '1:1' ? 1.2 : 1)

  return { opp, account, tier, market, pillar, aging, coverage, committee, icp, signals, campaign, journey, context, plays, score }
}

/** Sugestões para toda a carteira, ordenadas por urgência. */
export function buildSuggestions({ opportunities, accounts, tasks = [], dismissals = [], settings }) {
  const accById = new Map(accounts.map((a) => [a.id, a]))
  return opportunities
    .map((o) => suggestForOpportunity(o, { account: accById.get(o.account_id), tasks, dismissals, settings }))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
}

/** Monta o rascunho de tarefa a partir de uma jogada (para o TaskModal). */
export function taskDraftFromPlay(play, suggestion, settings) {
  const s = withDefaults(settings)
  const hoursEach = Number(s.task_hours[play.task_type]) || 1
  const inDays = suggestion.aging.level.key === 'parado' ? 2 : suggestion.aging.level.key === 'critico' ? 4 : 7
  const d = new Date()
  d.setDate(d.getDate() + inDays)
  const activeResources = s.resources.filter((r) => r.active !== false)
  const description = [
    `Jogada ABM: ${play.title}`,
    `Objetivo: ${play.objective}`,
    `Por quê: ${play.why}`,
    play.persona ? `Persona-alvo: ${play.persona}${play.contact ? ` (${play.contact.name})` : ''}` : null,
    play.nextPillar ? `Próximo pilar: ${play.nextPillar.label}` : null,
    '',
    'Passos:',
    ...play.steps.map((x, i) => `${i + 1}. ${x}`),
  ].filter((x) => x !== null).join('\n')

  return {
    account_id: suggestion.account.id,
    opportunity_id: suggestion.opp.id,
    contact_id: play.contact?.id || '',
    abm_play_id: play.id,
    title: `${play.title} — ${suggestion.account.name}`,
    task_type: play.task_type,
    scheduled_date: d.toISOString().slice(0, 10),
    status: 'planejada',
    description,
    // Pré-carrega esforço e despesas estimados; o usuário ajusta ao salvar.
    cost_hours: activeResources.slice(0, play.people || 1).map((r) => ({ resource_id: r.id, hours: hoursEach })),
    cost_expenses: (play.expenses || []).map((x) => ({ category_id: x.category, quantity: x.qty })),
  }
}
