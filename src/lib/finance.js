// Cálculos da visão financeira — centrados na OPORTUNIDADE (reunião 13/07):
// cada oportunidade tem etapa, termômetro e valor próprios. A conta apenas
// consolida a leitura das suas oportunidades.

import { STAGE_PROBABILITY, CRM_STAGES } from './constants'

/** Valor de oportunidade de uma conta = soma das oportunidades não perdidas. */
export function accountValue(accountId, opportunities) {
  return opportunities
    .filter((o) => o.account_id === accountId && o.stage !== 'perdido')
    .reduce((sum, o) => sum + (Number(o.estimated_value_brl) || 0), 0)
}

/**
 * Termômetro CONSOLIDADO da conta = o maior termômetro entre as oportunidades
 * abertas (não perdidas). Sem oportunidades → null (conta sem leitura).
 */
export function accountConsolidatedTemp(accountId, opportunities) {
  const temps = opportunities
    .filter((o) => o.account_id === accountId && o.stage !== 'perdido')
    .map((o) => Number(o.commercial_temp) || 0)
  return temps.length ? Math.max(...temps) : null
}

/** Dias corridos entre uma data ISO e agora. */
export function daysSince(iso) {
  if (!iso) return null
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86400000))
}

/**
 * Aging da oportunidade: dias no pipeline, dias na etapa atual e
 * dias por etapa (histórico + etapa corrente).
 */
export function opportunityAging(opp) {
  const inPipeline = daysSince(opp.created_at)
  const inStage = daysSince(opp.stage_entered_at || opp.created_at)
  const perStage = []
  for (const h of Array.isArray(opp.stage_history) ? opp.stage_history : []) {
    perStage.push({ stage: h.stage, days: h.days ?? 0, closed: true })
  }
  perStage.push({ stage: opp.stage, days: inStage ?? 0, closed: false })
  return { inPipeline, inStage, perStage }
}

/**
 * Agrega o pipeline por etapa — OPORTUNIDADES (não contas).
 * @returns { stages: [{stage,label,count,potential,probability,forecast,opportunities}], totals }
 */
export function pipelineByStage(opportunities) {
  const stageKeys = Object.keys(CRM_STAGES)

  const stages = stageKeys.map((stage) => {
    const opps = opportunities.filter((o) => o.stage === stage)
    const potential = opps.reduce((s, o) => s + (Number(o.estimated_value_brl) || 0), 0)
    const probability = STAGE_PROBABILITY[stage] ?? 0
    return {
      stage,
      label: CRM_STAGES[stage].label,
      count: opps.length,
      potential,
      probability,
      forecast: potential * probability,
      opportunities: opps,
    }
  })

  const open = stages.filter((s) => !['fechado', 'perdido'].includes(s.stage))
  const totals = {
    totalPotential: stages.filter((s) => s.stage !== 'perdido').reduce((s, x) => s + x.potential, 0),
    totalForecast: stages.reduce((s, x) => s + x.forecast, 0),
    openForecast: open.reduce((s, x) => s + x.forecast, 0),
    openCount: open.reduce((s, x) => s + x.count, 0),
    won: stages.find((s) => s.stage === 'fechado')?.potential || 0,
    wonCount: stages.find((s) => s.stage === 'fechado')?.count || 0,
  }

  return { stages, totals }
}
