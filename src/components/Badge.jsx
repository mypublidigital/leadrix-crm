import { CLASSIFICATIONS, CRM_STAGES, HEALTH, TASK_STATUS, thermo } from '../lib/constants'

export function ClassificationBadge({ value }) {
  const c = CLASSIFICATIONS[value] || CLASSIFICATIONS.lead
  return <span className={`chip ${c.color}`}>{c.label}</span>
}

export function StageBadge({ value }) {
  const c = CRM_STAGES[value] || CRM_STAGES.lead
  return <span className={`chip ${c.color}`}>{c.label}</span>
}

export function StatusBadge({ value }) {
  const c = TASK_STATUS[value] || TASK_STATUS.backlog
  return <span className={`chip ${c.color}`}>{c.label}</span>
}

export function HealthDot({ value, withLabel = false }) {
  if (!value) return <span className="text-xs text-ink-400">—</span>
  const h = HEALTH[value] || HEALTH.verde
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${h.color}`} />
      {withLabel && <span className={`text-xs font-medium ${h.text}`}>{h.label}</span>}
    </span>
  )
}

// Termômetro comercial: barra de % com cor por faixa.
export function ThermometerBadge({ value, withLabel = false }) {
  const t = thermo(value)
  if (!t) return <span className="text-xs text-ink-400">—</span>
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative h-2 w-14 overflow-hidden rounded-full bg-ink-200" title={t.label}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${t.color}`} style={{ width: `${value}%` }} />
      </span>
      <span className={`text-xs font-semibold ${t.text}`}>{withLabel ? t.label : t.short}</span>
    </span>
  )
}
