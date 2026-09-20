import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Radar, AlertTriangle, Users, Wallet, BookOpen } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import AbmSuggestionCard from '../components/AbmSuggestionCard'
import SegmentFilters, { oppMatches } from '../components/SegmentFilters'
import { useAccounts, useOpportunities, useTasks, useDismissals, useSalesCost, useRoster } from '../lib/hooks'
import { buildSuggestions } from '../lib/abm'
import { withDefaults } from '../lib/costs'
import { AGING_LEVELS, AGING_LEVEL_ORDER, ABM_THEORY } from '../data/abmPlaybook'
import { ABM_TIERS, CRM_STAGES, formatBRL, formatPct } from '../lib/constants'

export default function RadarAbm() {
  const { data: accounts = [] } = useAccounts()
  const { data: opportunities = [] } = useOpportunities()
  const { data: tasks = [] } = useTasks()
  const { data: dismissals = [] } = useDismissals()
  const { data: settingsRaw } = useSalesCost()
  const { data: roster = [] } = useRoster()
  const settings = withDefaults(settingsRaw)

  const [seg, setSeg] = useState({ segment: '', micro: '', pillar: '' })
  const [level, setLevel] = useState('')
  const [tier, setTier] = useState('')
  const [owner, setOwner] = useState('')
  const [showOnTime, setShowOnTime] = useState(false)

  const all = useMemo(
    () => buildSuggestions({ opportunities, accounts, tasks, dismissals, settings: settingsRaw }),
    [opportunities, accounts, tasks, dismissals, settingsRaw],
  )

  const list = useMemo(() => all.filter((s) => {
    if (!oppMatches(s.opp, s.account, seg)) return false
    if (level && s.aging.level.key !== level) return false
    if (!level && !showOnTime && s.aging.level.key === 'no_prazo') return false
    if (tier && (s.account.abm_tier || '1:few') !== tier) return false
    if (owner && s.opp.owner_id !== owner) return false
    return true
  }), [all, seg, level, tier, owner, showOnTime])

  const kpis = useMemo(() => {
    const byLevel = Object.fromEntries(AGING_LEVEL_ORDER.map((k) => [k, 0]))
    let atRisk = 0
    let coverageSum = 0
    let coverageN = 0
    all.forEach((s) => {
      byLevel[s.aging.level.key] += 1
      if (['critico', 'parado'].includes(s.aging.level.key) && s.opp.stage !== 'fechado') atRisk += Number(s.opp.estimated_value_brl) || 0
      if (s.coverage.ratio != null) { coverageSum += s.coverage.ratio; coverageN += 1 }
    })
    return { byLevel, atRisk, coverage: coverageN ? coverageSum / coverageN : null, plays: all.reduce((n, s) => n + s.plays.length, 0) }
  }, [all])

  return (
    <>
      <PageHeader
        eyebrow="ABM inteligente"
        title="Radar ABM"
        subtitle="Sugestões proativas de ações por conta, a partir do aging de cada oportunidade, do nível ABM e do comitê de compra."
      />
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Kpi icon={AlertTriangle} label="Críticas ou paradas" value={kpis.byLevel.critico + kpis.byLevel.parado}
            hint={`${kpis.byLevel.atencao} em atenção · ${kpis.byLevel.no_prazo} no prazo`} />
          <Kpi icon={Wallet} label="Valor em risco" value={formatBRL(kpis.atRisk)} hint="Oportunidades críticas ou paradas" />
          <Kpi icon={Users} label="Cobertura do comitê" value={formatPct(kpis.coverage)} hint="Personas do mercado com contato mapeado" />
          <Kpi icon={Radar} label="Jogadas sugeridas" value={kpis.plays} hint="Descartadas somem por 30 dias" />
        </div>

        <div className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-4 xl:grid-cols-7">
          <SegmentFilters value={seg} onChange={setSeg} />
          <div>
            <label className="label">Aging</label>
            <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="">Pedindo ação</option>
              {AGING_LEVEL_ORDER.map((k) => <option key={k} value={k}>{AGING_LEVELS[k].label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Nível ABM</label>
            <select className="input" value={tier} onChange={(e) => setTier(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ABM_TIERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Dono</label>
            <select className="input" value={owner} onChange={(e) => setOwner(e.target.value)}>
              <option value="">Todos</option>
              {roster.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </select>
          </div>
          <label className="col-span-2 flex items-center gap-2 self-end pb-2 text-sm text-ink-700 md:col-span-4 xl:col-span-7">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={showOnTime} onChange={(e) => setShowOnTime(e.target.checked)} disabled={Boolean(level)} />
            Incluir oportunidades no prazo (jogadas proativas para manter o ritmo)
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-3 xl:col-span-2">
            {list.map((s, i) => (
              <AbmSuggestionCard key={s.opp.id} suggestion={s} settings={settingsRaw} defaultOpen={i === 0} />
            ))}
            {list.length === 0 && (
              <div className="card p-10 text-center text-sm text-ink-500">
                Nenhuma oportunidade pedindo ação com esses filtros.
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-900"><BookOpen size={16} className="text-brand-500" /> Como o Radar decide</h2>
              <p className="text-xs text-ink-600">
                Cada etapa tem um SLA de dias. O aging é a razão entre os dias na etapa e o SLA; a faixa define a intensidade da jogada.
                O nível ABM da conta libera ou não ações de alto investimento (viagem, jantar) e a urgência pondera valor e cobertura do comitê.
              </p>
              <table className="mt-3 w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-500"><th className="py-1">Etapa</th><th className="py-1 text-right">SLA (dias)</th></tr>
                </thead>
                <tbody>
                  {Object.entries(settings.aging_sla).map(([k, v]) => (
                    <tr key={k} className="border-t border-ink-100"><td className="py-1">{CRM_STAGES[k]?.label || k}{k === 'fechado' ? ' (expansão)' : ''}</td><td className="py-1 text-right font-mono">{v}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {AGING_LEVEL_ORDER.map((k) => (
                  <span key={k} className={`chip ${AGING_LEVELS[k].color}`}>
                    {AGING_LEVELS[k].label} {k === 'no_prazo' ? '≤ 1×' : k === 'parado' ? '> 3×' : `≤ ${AGING_LEVELS[k].upTo}×`}
                  </span>
                ))}
              </div>
              <Link to="/config" className="mt-3 inline-block text-xs text-brand-600 hover:underline">Ajustar SLA em Configurações</Link>
            </div>
            <div className="card p-5">
              <h2 className="mb-2 text-sm font-bold text-ink-900">Princípios ABM aplicados</h2>
              <ul className="space-y-1.5 text-xs text-ink-600">
                {ABM_THEORY.principles.map((p) => <li key={p} className="border-l-2 border-accent-500 pl-2">{p}</li>)}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}

function Kpi({ icon: Icon, label, value, hint }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-ink-900 text-white"><Icon size={20} /></div>
      <div className="min-w-0">
        <div className="kpi truncate">{value}</div>
        <div className="text-xs font-medium text-ink-600">{label}</div>
        {hint && <div className="text-[11px] text-ink-400">{hint}</div>}
      </div>
    </div>
  )
}
