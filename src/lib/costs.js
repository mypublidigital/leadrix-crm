// Custo de venda, custo do lead, custo de conversão e ROI da operação comercial.
//
// Modelo:
//   • Configuração (tela Config): recursos com custo hora-homem, categorias de
//     despesa com custo unitário sugerido, horas padrão por tipo de ação,
//     custos fixos mensais da operação, margem de contribuição e SLA de aging.
//   • Lançamentos (`cost_entries`): cada linha é HORAS de um recurso ou uma
//     DESPESA, ligada a uma conta e, quando possível, a uma oportunidade e/ou a
//     uma ação ABM (tarefa). O custo/hora é gravado no lançamento (snapshot):
//     reajustar o custo de alguém não reescreve o passado.
//
// Regras de rateio (explicadas também nas telas):
//   • Lançamento com oportunidade → custo direto daquela oportunidade.
//   • Lançamento só com conta → rateado entre as oportunidades da conta na
//     proporção do valor estimado (igualitário se todas estiverem sem valor).
//   • Custos fixos mensais → entram na visão da operação, proporcionais aos
//     dias do período; com filtro de segmento/pilar, rateados pela participação
//     do filtro no número de leads do período.

import { TASK_TYPES, STAGE_PROBABILITY } from './constants'
import { DEFAULT_AGING_SLA } from '../data/abmPlaybook'

export const DEFAULT_EXPENSE_CATEGORIES = [
  { id: 'passagem', label: 'Passagem aérea / rodoviária', unit: 'trecho', default_cost: 0 },
  { id: 'hospedagem', label: 'Hospedagem', unit: 'diária', default_cost: 0 },
  { id: 'deslocamento', label: 'Deslocamento (app, táxi, km)', unit: 'trajeto', default_cost: 0 },
  { id: 'almoco', label: 'Almoço', unit: 'pessoa', default_cost: 0 },
  { id: 'jantar', label: 'Jantar', unit: 'pessoa', default_cost: 0 },
  { id: 'evento', label: 'Evento / inscrição / espaço', unit: 'evento', default_cost: 0 },
  { id: 'brinde', label: 'Brinde / envio físico', unit: 'unidade', default_cost: 0 },
  { id: 'material', label: 'Material / impressos', unit: 'unidade', default_cost: 0 },
  { id: 'midia', label: 'Mídia paga (LinkedIn Ads etc.)', unit: 'campanha', default_cost: 0 },
  { id: 'outros', label: 'Outras despesas', unit: 'unidade', default_cost: 0 },
]

export function defaultSalesCostSettings() {
  return {
    resources: [],
    expense_categories: DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c })),
    task_hours: Object.fromEntries(Object.entries(TASK_TYPES).map(([k, v]) => [k, v.hours])),
    fixed_costs: [],
    margin_pct: null,
    aging_sla: { ...DEFAULT_AGING_SLA },
  }
}

// Completa uma configuração parcial com os padrões (útil após upgrades).
export function withDefaults(settings) {
  const d = defaultSalesCostSettings()
  const s = settings || {}
  return {
    resources: s.resources || d.resources,
    expense_categories: s.expense_categories?.length ? s.expense_categories : d.expense_categories,
    task_hours: { ...d.task_hours, ...(s.task_hours || {}) },
    fixed_costs: s.fixed_costs || d.fixed_costs,
    margin_pct: s.margin_pct ?? d.margin_pct,
    aging_sla: { ...d.aging_sla, ...(s.aging_sla || {}) },
  }
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Custo/hora efetivo do recurso: calculado pelo custo mensal ÷ horas, ou informado direto. */
export function resourceHourly(r) {
  if (!r) return 0
  if (num(r.monthly_cost) > 0 && num(r.monthly_hours) > 0) return num(r.monthly_cost) / num(r.monthly_hours)
  return num(r.hourly_cost)
}

/** Valor de um lançamento. */
export function entryAmount(e) {
  if (e.kind === 'hours') return num(e.hours) * num(e.hourly_cost)
  return num(e.quantity || 1) * num(e.unit_cost)
}

/** Estimativa de custo de uma ação antes de executá-la (usada nas sugestões ABM). */
export function estimateActionCost({ taskType, people = 1, expenses = [] }, settings) {
  const s = withDefaults(settings)
  const hours = num(s.task_hours[taskType] ?? TASK_TYPES[taskType]?.hours ?? 1)
  const active = s.resources.filter((r) => r.active !== false)
  const avgHourly = active.length ? active.reduce((acc, r) => acc + resourceHourly(r), 0) / active.length : 0
  const hoursCost = hours * people * avgHourly
  const cats = new Map(s.expense_categories.map((c) => [c.id, c]))
  const lines = expenses.map((x) => {
    const c = cats.get(x.category)
    return { category: x.category, label: c?.label || x.category, qty: x.qty, unit_cost: num(c?.default_cost), amount: num(x.qty) * num(c?.default_cost) }
  })
  const expensesCost = lines.reduce((acc, l) => acc + l.amount, 0)
  return { hours: hours * people, avgHourly, hoursCost, expenses: lines, expensesCost, total: hoursCost + expensesCost }
}

/**
 * Custo alocado por oportunidade.
 * @returns Map<oppId, { direct, shared, total, hours, expenses }>
 *          e `unallocated` (contas sem oportunidade).
 */
export function allocateCosts(opportunities, entries) {
  const byOpp = new Map(opportunities.map((o) => [o.id, { direct: 0, shared: 0, total: 0, hours: 0, hoursCost: 0, expensesCost: 0 }]))
  const oppsByAccount = new Map()
  opportunities.forEach((o) => {
    if (!oppsByAccount.has(o.account_id)) oppsByAccount.set(o.account_id, [])
    oppsByAccount.get(o.account_id).push(o)
  })
  let unallocated = 0

  const add = (oppId, amount, e, share = 1, kind = 'direct') => {
    const row = byOpp.get(oppId)
    if (!row) return false
    row[kind] += amount * share
    row.total += amount * share
    if (e.kind === 'hours') { row.hours += num(e.hours) * share; row.hoursCost += amount * share }
    else row.expensesCost += amount * share
    return true
  }

  for (const e of entries) {
    const amount = entryAmount(e)
    if (e.opportunity_id && add(e.opportunity_id, amount, e)) continue
    const opps = oppsByAccount.get(e.account_id) || []
    if (!opps.length) { unallocated += amount; continue }
    const totalValue = opps.reduce((acc, o) => acc + num(o.estimated_value_brl), 0)
    opps.forEach((o) => {
      const share = totalValue > 0 ? num(o.estimated_value_brl) / totalValue : 1 / opps.length
      add(o.id, amount, e, share, 'shared')
    })
  }
  return { byOpp, unallocated }
}

/**
 * Comissão de indicação da conta sobre um valor.
 * A conta marca "gera comissão" e o percentual; a comissão entra no custo de
 * venda (e portanto no custo de conversão e no ROI) quando a venda acontece.
 */
export function commissionRate(account) {
  if (!account?.referral_commission) return 0
  const pct = num(account.referral_commission_pct)
  return pct > 0 ? pct / 100 : 0
}

export function commissionOn(account, value) {
  return commissionRate(account) * num(value)
}

/** Data em que a oportunidade foi ganha (entrada em "fechado"). */
export function wonAt(o) {
  if (o.stage !== 'fechado') return null
  return o.stage_entered_at || o.updated_at || o.created_at
}

export const inRange = (iso, from, to) => {
  if (!iso) return false
  const d = String(iso).slice(0, 10)
  return (!from || d >= from) && (!to || d <= to)
}

function daysBetween(from, to) {
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

/**
 * Indicadores da operação comercial num período.
 *
 * @param opps       oportunidades (account_services) já enriquecidas com
 *                   `pillar` e `segment` quando houver filtro
 * @param entries    lançamentos de custo
 * @param settings   configuração de custo de venda
 * @param opts       { from, to, filter: (opp) => boolean }
 */
export function operationMetrics(opps, entries, settings, { from, to, filter, accountById } = {}) {
  const s = withDefaults(settings)
  const accept = filter || (() => true)
  const filtered = Boolean(filter)

  const periodEntries = entries.filter((e) => inRange(e.date || e.created_at, from, to))
  const { byOpp, unallocated } = allocateCosts(opps, periodEntries)

  const scoped = opps.filter(accept)
  const variableCost = scoped.reduce((acc, o) => acc + (byOpp.get(o.id)?.total || 0), 0) + (filtered ? 0 : unallocated)
  const hoursCost = scoped.reduce((acc, o) => acc + (byOpp.get(o.id)?.hoursCost || 0), 0)
  const hours = scoped.reduce((acc, o) => acc + (byOpp.get(o.id)?.hours || 0), 0)

  const leadsAll = opps.filter((o) => inRange(o.created_at, from, to))
  const leads = leadsAll.filter(accept)
  const won = scoped.filter((o) => inRange(wonAt(o), from, to))
  const lost = scoped.filter((o) => o.stage === 'perdido' && inRange(o.stage_entered_at, from, to))
  const revenue = won.reduce((acc, o) => acc + num(o.estimated_value_brl), 0)

  // Custos fixos proporcionais ao período (e ao peso do filtro nos leads).
  const days = from && to ? daysBetween(from, to) : 30
  const fixedMonthly = s.fixed_costs.reduce((acc, f) => acc + num(f.monthly), 0)
  const fixedPeriod = fixedMonthly * (days / 30)
  const filterShare = filtered ? (leadsAll.length ? leads.length / leadsAll.length : 0) : 1
  const fixedCost = fixedPeriod * filterShare

  const acc = accountById || new Map()
  // Comissão de indicação: só sobre o que foi efetivamente ganho no período.
  const commissionCost = won.reduce((sum, o) => sum + commissionOn(acc.get(o.account_id), o.estimated_value_brl), 0)

  const totalCost = variableCost + fixedCost + commissionCost
  const margin = s.margin_pct != null && s.margin_pct !== '' ? num(s.margin_pct) / 100 : null

  const open = scoped.filter((o) => !['fechado', 'perdido'].includes(o.stage))
  const openForecast = open.reduce((sum, o) => sum + num(o.estimated_value_brl) * (STAGE_PROBABILITY[o.stage] ?? 0), 0)
  const openCommission = open.reduce(
    (sum, o) => sum + commissionOn(acc.get(o.account_id), num(o.estimated_value_brl) * (STAGE_PROBABILITY[o.stage] ?? 0)),
    0,
  )
  const openCost = open.reduce((sum, o) => sum + (byOpp.get(o.id)?.total || 0), 0) + openCommission

  return {
    days,
    hours,
    hoursCost,
    expensesCost: scoped.reduce((acc, o) => acc + (byOpp.get(o.id)?.expensesCost || 0), 0),
    unallocated: filtered ? 0 : unallocated,
    variableCost,
    fixedCost,
    commissionCost,
    openCommission,
    totalCost,
    leads: leads.length,
    won: won.length,
    lost: lost.length,
    revenue,
    conversion: leads.length ? won.length / leads.length : null,
    costPerLead: leads.length ? totalCost / leads.length : null,
    costPerConversion: won.length ? totalCost / won.length : null,
    costToRevenue: revenue ? totalCost / revenue : null,
    roi: totalCost ? (revenue - totalCost) / totalCost : null,
    roiMargin: totalCost && margin != null ? (revenue * margin - totalCost) / totalCost : null,
    margin,
    open: open.length,
    openCost,
    openForecast,
    roiProjected: openCost ? (openForecast - openCost) / openCost : null,
    byOpp,
  }
}

/**
 * ROI de uma oportunidade: realizado (fechada) ou projetado (em aberto).
 * `account` é opcional e serve para somar a comissão de indicação ao custo.
 */
export function opportunityRoi(opp, cost, account) {
  const value = num(opp.estimated_value_brl)
  const stageValue = opp.stage === 'fechado' ? value : value * (STAGE_PROBABILITY[opp.stage] ?? 0)
  const commission = opp.stage === 'perdido' ? 0 : commissionOn(account, stageValue)
  const full = num(cost) + commission
  const projected = !['fechado', 'perdido'].includes(opp.stage)
  if (!full) return { cost: 0, commission, value: opp.stage === 'perdido' ? 0 : stageValue, roi: null, projected }
  if (opp.stage === 'perdido') return { cost: full, commission: 0, value: 0, roi: -1, projected: false }
  return { cost: full, commission, value: stageValue, roi: (stageValue - full) / full, projected }
}

/** Soma um conjunto de chaves agrupando custo e receita (para as quebras). */
export function breakdown(opps, byOpp, keyOf, labelOf, isWon = (o) => o.stage === 'fechado', accountById) {
  const m = new Map()
  opps.forEach((o) => {
    const k = keyOf(o) || '—'
    if (!m.has(k)) m.set(k, { key: k, label: labelOf(k), cost: 0, revenue: 0, won: 0, count: 0 })
    const row = m.get(k)
    row.cost += byOpp.get(o.id)?.total || 0
    row.count += 1
    if (isWon(o)) {
      row.revenue += num(o.estimated_value_brl)
      row.won += 1
      // A comissão de indicação é custo da venda ganha.
      row.cost += commissionOn(accountById?.get(o.account_id), o.estimated_value_brl)
    }
  })
  return [...m.values()].map((r) => ({ ...r, roi: r.cost ? (r.revenue - r.cost) / r.cost : null }))
}
