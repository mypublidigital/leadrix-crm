import { useMemo } from 'react'
import { MARKETS, MARKET_IDS, PILLARS, PILLAR_IDS } from '../data/leadrix'
import { useMicroSegments } from '../lib/hooks'

// Filtros encadeados: mercado (macro) → microssegmento, mais pilar de entrega.
// O microssegmento lista só os do mercado escolhido; sem mercado, lista todos
// agrupados. Trocar de mercado limpa um microssegmento que não pertence a ele.
export default function SegmentFilters({ value, onChange, showPillar = true, className = '' }) {
  const { data: micros = [] } = useMicroSegments()
  const { segment = '', micro = '', pillar = '' } = value

  const microOptions = useMemo(
    () => micros.filter((m) => !segment || m.segment === segment),
    [micros, segment],
  )

  const set = (patch) => onChange({ ...value, ...patch })

  return (
    <div className={`contents ${className}`}>
      <div>
        <label className="label">Mercado</label>
        <select
          className="input"
          value={segment}
          onChange={(e) => {
            const next = e.target.value
            const keepMicro = micros.some((m) => m.label === micro && (!next || m.segment === next))
            set({ segment: next, micro: keepMicro ? micro : '' })
          }}
        >
          <option value="">Todos os mercados</option>
          {MARKET_IDS.map((k) => <option key={k} value={k}>{MARKETS[k].label}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Microssegmento</label>
        <select className="input" value={micro} onChange={(e) => set({ micro: e.target.value })}>
          <option value="">Todos</option>
          {segment
            ? microOptions.map((m) => <option key={m.id} value={m.label}>{m.label}</option>)
            : MARKET_IDS.map((k) => (
                <optgroup key={k} label={MARKETS[k].label}>
                  {micros.filter((m) => m.segment === k).map((m) => <option key={m.id} value={m.label}>{m.label}</option>)}
                </optgroup>
              ))}
        </select>
      </div>
      {showPillar && (
        <div>
          <label className="label">Pilar de entrega</label>
          <select className="input" value={pillar} onChange={(e) => set({ pillar: e.target.value })}>
            <option value="">Todos os pilares</option>
            {PILLAR_IDS.map((k) => <option key={k} value={k}>{PILLARS[k].short}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

// Predicados reutilizáveis.
export function accountMatches(account, { segment, micro }) {
  if (segment && account?.segment !== segment) return false
  if (micro && account?.micro_segment !== micro) return false
  return true
}

export function oppMatches(opp, account, { segment, micro, pillar }) {
  if (!accountMatches(account, { segment, micro })) return false
  if (pillar && opp?.service?.macro_id !== pillar) return false
  return true
}

export function PillarBadge({ id, short = true }) {
  const p = PILLARS[id]
  if (!p) return null
  return <span className={`chip ${p.color}`} title={p.label}>{short ? p.short : p.label}</span>
}

export function MarketBadge({ id, micro }) {
  const m = MARKETS[id]
  if (!m) return <span className="text-xs text-ink-400">—</span>
  return (
    <span className="inline-flex flex-col leading-tight">
      <span className="text-xs font-semibold text-ink-700">{m.label}</span>
      {micro && <span className="text-[11px] text-ink-500">{micro}</span>}
    </span>
  )
}
