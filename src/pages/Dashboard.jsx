import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, Target, Handshake, TrendingUp, Clock, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import TaskSummaryCard from '../components/TaskSummaryCard'
import { listAccounts, listAllAccountServices, listRoster } from '../lib/data'
import { pipelineByStage, daysSince } from '../lib/finance'
import { CRM_STAGES, CLASSIFICATIONS, ABM_ACTIVE, THERMOMETER, THERMOMETER_LEVELS, formatBRL, formatPct } from '../lib/constants'
import { MARKETS, MARKET_IDS, PILLARS, PILLAR_IDS } from '../data/leadrix'
import { AGING_LEVELS, AGING_LEVEL_ORDER } from '../data/abmPlaybook'
import { buildSuggestions } from '../lib/abm'
import { operationMetrics } from '../lib/costs'
import { useTasks, useDismissals, useSalesCost, useCostEntries } from '../lib/hooks'
import { Radar, Calculator, Gauge } from 'lucide-react'
import { committeeRoles, accountIcp } from '../lib/abm'
import { ABM_TIERS } from '../lib/constants'
import { ABM_THESIS } from '../data/leadrix'
import { useAuth } from '../lib/useAuth'

// Faixas de aging por dias PARADO na etapa atual (oportunidades em aberto).
const AGING_BUCKETS = [
  { key: 'ok', label: '≤ 30 dias', max: 30, dot: 'bg-accent-500', text: 'text-accent-700', bar: 'bg-accent-500' },
  { key: 'atencao', label: '31–90 dias', max: 90, dot: 'bg-amber-500', text: 'text-amber-700', bar: 'bg-amber-500' },
  { key: 'critico', label: '91–180 dias', max: 180, dot: 'bg-orange-500', text: 'text-orange-700', bar: 'bg-orange-500' },
  { key: 'parado', label: '> 180 dias', max: Infinity, dot: 'bg-rose-500', text: 'text-rose-700', bar: 'bg-rose-500' },
]
function agingBucket(days) {
  return AGING_BUCKETS.find((b) => days <= b.max) || AGING_BUCKETS[AGING_BUCKETS.length - 1]
}

function Stat({ icon: Icon, label, value, hint }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-500">
        <Icon size={20} />
      </div>
      <div>
        <div className="text-xl font-extrabold text-ink-900">{value}</div>
        <div className="text-xs font-medium text-ink-500">{label}</div>
        {hint && <div className="text-xs text-ink-400">{hint}</div>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const { data: accountServices = [] } = useQuery({
    queryKey: ['all-account-services'],
    queryFn: listAllAccountServices,
  })
  const { data: roster = [] } = useQuery({ queryKey: ['roster'], queryFn: listRoster })
  const { data: tasks = [] } = useTasks()
  const { data: dismissals = [] } = useDismissals()
  const { data: settings } = useSalesCost()
  const { data: costEntries = [] } = useCostEntries()
  const { can } = useAuth()

  // Métricas de cobertura do programa ABM (contexto estratégico §10).
  const abmMetrics = useMemo(() => {
    const active = accounts.filter((a) => ABM_ACTIVE.includes(a.classification))
    const scored = active.filter((a) => accountIcp(a).scored)
    const developed = active.filter((a) => committeeRoles(a).developed)
    const withSignal = active.filter((a) => (a.signals || []).length > 0)
    const byTier = { '1:1': 0, '1:few': 0, '1:many': 0 }
    accounts.forEach((a) => { if (a.abm_tier) byTier[a.abm_tier] = (byTier[a.abm_tier] || 0) + 1 })
    // Pilares contratados por cliente (expansão).
    const wonByAccount = new Map()
    accountServices.filter((o) => o.stage === 'fechado').forEach((o) => {
      if (!wonByAccount.has(o.account_id)) wonByAccount.set(o.account_id, new Set())
      if (o.service?.macro_id) wonByAccount.get(o.account_id).add(o.service.macro_id)
    })
    const pillarsPerClient = wonByAccount.size
      ? [...wonByAccount.values()].reduce((s, set) => s + set.size, 0) / wonByAccount.size
      : 0
    return {
      active: active.length,
      scoredPct: active.length ? scored.length / active.length : null,
      developedPct: active.length ? developed.length / active.length : null,
      withSignal: withSignal.length,
      byTier,
      pillarsPerClient,
      clients: wonByAccount.size,
    }
  }, [accounts, accountServices])

  const radar = useMemo(() => {
    const list = buildSuggestions({ opportunities: accountServices, accounts, tasks, dismissals, settings })
    const byLevel = Object.fromEntries(AGING_LEVEL_ORDER.map((k) => [k, 0]))
    list.forEach((s) => { byLevel[s.aging.level.key] += 1 })
    return { top: list.filter((s) => s.aging.level.key !== 'no_prazo').slice(0, 4), byLevel }
  }, [accountServices, accounts, tasks, dismissals, settings])

  const roi = useMemo(() => {
    const to = new Date().toISOString().slice(0, 10)
    const d = new Date(); d.setDate(d.getDate() - 365)
    return operationMetrics(accountServices, costEntries, settings, {
      from: d.toISOString().slice(0, 10), to,
      accountById: new Map(accounts.map((a) => [a.id, a])),
    })
  }, [accountServices, costEntries, settings, accounts])

  // Matriz pilar × mercado: valor em aberto e número de oportunidades.
  const matrix = useMemo(() => {
    const accById = new Map(accounts.map((a) => [a.id, a]))
    const cells = {}
    let max = 1
    accountServices.forEach((o) => {
      if (['perdido'].includes(o.stage)) return
      const p = o.service?.macro_id
      const mk = accById.get(o.account_id)?.segment
      if (!p || !mk) return
      const k = `${p}|${mk}`
      cells[k] = cells[k] || { count: 0, value: 0, won: 0 }
      cells[k].count += 1
      if (o.stage === 'fechado') cells[k].won += Number(o.estimated_value_brl) || 0
      else cells[k].value += Number(o.estimated_value_brl) || 0
      max = Math.max(max, cells[k].value)
    })
    return { cells, max }
  }, [accountServices, accounts])

  const stats = useMemo(() => {
    const byClass = {}
    accounts.forEach((a) => {
      byClass[a.classification] = (byClass[a.classification] || 0) + 1
    })
    // Termômetro por OPORTUNIDADE (não por conta) — reunião 13/07.
    const byTemp = {}
    accountServices.forEach((o) => {
      if (o.stage === 'perdido') return
      const t = o.commercial_temp ?? 0
      byTemp[t] = (byTemp[t] || 0) + 1
    })
    const abm = accounts.filter((a) => ABM_ACTIVE.includes(a.classification)).length
    return { byClass, byTemp, abm }
  }, [accounts, accountServices])

  // Pipeline centrado em oportunidades.
  const pipeline = useMemo(() => pipelineByStage(accountServices), [accountServices])

  // Funil (formato de funil): lead → fechado.
  const FUNNEL_STAGES = ['lead', 'qualificado', 'proposta', 'negociacao', 'fechado']
  const funnel = FUNNEL_STAGES.map((k) => pipeline.stages.find((s) => s.stage === k))
  const maxFunnel = Math.max(1, ...funnel.map((s) => s?.count || 0))

  // Aging das oportunidades EM ABERTO (dias parado na etapa atual).
  const aging = useMemo(() => {
    const accById = new Map(accounts.map((a) => [a.id, a]))
    const ownerById = new Map(roster.map((u) => [u.id, u.full_name || u.email]))
    const open = accountServices.filter((o) => !['fechado', 'perdido'].includes(o.stage))
    const enriched = open.map((o) => {
      const days = daysSince(o.stage_entered_at || o.created_at) ?? 0
      return {
        ...o,
        days,
        bucket: agingBucket(days),
        accountName: accById.get(o.account_id)?.name || '—',
        ownerName: o.owner_id ? ownerById.get(o.owner_id) : null,
      }
    })
    const buckets = AGING_BUCKETS.map((b) => {
      const items = enriched.filter((o) => o.bucket.key === b.key)
      return { ...b, count: items.length, value: items.reduce((s, o) => s + (Number(o.estimated_value_brl) || 0), 0) }
    })
    const stalled = enriched
      .filter((o) => o.days > 30)
      .sort((a, b) => b.days - a.days)
      .slice(0, 6)
    const maxCount = Math.max(1, ...buckets.map((b) => b.count))
    return { buckets, stalled, maxCount, total: enriched.length }
  }, [accountServices, accounts, roster])

  return (
    <>
      <PageHeader
        title="Dashboard de funil"
        subtitle="Visão consolidada do pipeline comercial e da carteira ABM."
      />
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Building2} label="Contas na base" value={accounts.length} />
          <Stat icon={Target} label="Em gestão ABM ativa" value={stats.abm} hint="Contas-alvo + clientes" />
          <Stat icon={Handshake} label="Oportunidades em aberto" value={pipeline.totals.openCount} hint="Cards ativos no pipeline" />
          <Stat icon={TrendingUp} label="Valor ponderado" value={formatBRL(pipeline.totals.openForecast)} hint="Previsão ponderada em aberto" />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Radar ABM */}
          <div className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><Radar size={16} className="text-brand-500" /> Radar ABM — pedindo ação</h2>
              <Link to="/radar" className="text-xs text-brand-600 hover:underline">Abrir radar</Link>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {AGING_LEVEL_ORDER.map((k) => (
                <span key={k} className={`chip ${AGING_LEVELS[k].color}`}>{AGING_LEVELS[k].label}: {radar.byLevel[k]}</span>
              ))}
            </div>
            <ul className="space-y-1.5">
              {radar.top.map((s) => (
                <li key={s.opp.id}>
                  <Link to={`/contas/${s.account.id}`} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2 hover:bg-ink-50">
                    <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${s.aging.level.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-ink-900">{s.account.name}</div>
                      <div className="truncate text-xs text-ink-500">{s.plays[0]?.title}</div>
                    </div>
                    <span className="shrink-0 text-xs text-ink-500">{s.aging.days} d</span>
                  </Link>
                </li>
              ))}
              {!radar.top.length && <li className="text-sm text-ink-400">Nenhuma oportunidade fora do SLA.</li>}
            </ul>
          </div>

          {/* Custo de venda & ROI (12 meses) — oculto para o perfil Vendas */}
          <div className={`card p-5 ${can('costs.view') ? '' : 'hidden'}`}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><Calculator size={16} className="text-brand-500" /> Custo de venda & ROI — 12 meses</h2>
              <Link to="/custos" className="text-xs text-brand-600 hover:underline">Detalhar</Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Custo total de venda', formatBRL(roi.totalCost)],
                ['Receita fechada', formatBRL(roi.revenue)],
                ['Custo por lead', roi.costPerLead != null ? formatBRL(roi.costPerLead) : '—'],
                ['Custo de conversão', roi.costPerConversion != null ? formatBRL(roi.costPerConversion) : '—'],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-ink-100 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-ink-500">{l}</div>
                  <div className="font-display text-lg text-ink-900">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between rounded-lg bg-ink-900 px-4 py-3 text-white">
              <span className="text-xs uppercase tracking-wide text-ink-300">ROI da operação comercial</span>
              <span className="font-display text-2xl">{formatPct(roi.roi)}</span>
            </div>
          </div>
        </div>

        {/* Cobertura do programa ABM */}
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-ink-900"><Gauge size={16} className="text-brand-500" /> Cobertura do programa ABM</h2>
          <p className="mb-3 text-xs text-ink-500">
            O desempenho é medido por conta, não por contato. Distribuição recomendada: {ABM_THESIS.distribution}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-ink-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-500">Contas pontuadas no ICP</div>
              <div className="kpi">{formatPct(abmMetrics.scoredPct)}</div>
              <div className="text-[11px] text-ink-400">de {abmMetrics.active} contas em gestão ativa</div>
            </div>
            <div className="rounded-lg border border-ink-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-500">Grupo decisor desenvolvido</div>
              <div className="kpi">{formatPct(abmMetrics.developedPct)}</div>
              <div className="text-[11px] text-ink-400">patrocinador + operação + técnico/risco</div>
            </div>
            <div className="rounded-lg border border-ink-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-500">Contas com sinal ativo</div>
              <div className="kpi">{abmMetrics.withSignal}</div>
              <div className="text-[11px] text-ink-400">acontecimento que abre conversa</div>
            </div>
            <div className="rounded-lg border border-ink-100 p-3">
              <div className="text-[11px] uppercase tracking-wide text-ink-500">Pilares por cliente</div>
              <div className="kpi">{abmMetrics.pillarsPerClient.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</div>
              <div className="text-[11px] text-ink-400">{abmMetrics.clients} cliente(s) com venda fechada</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(ABM_TIERS).map(([k, v]) => (
              <span key={k} className={`chip ${v.color}`} title={v.help}>{v.label}: {abmMetrics.byTier[k] || 0}</span>
            ))}
          </div>
        </div>

        {/* Matriz pilares × mercados */}
        <div className="card overflow-x-auto p-5">
          <h2 className="mb-1 text-sm font-bold text-ink-900">Pilares × mercados</h2>
          <p className="mb-3 text-xs text-ink-500">Valor em aberto no pipeline (e ganho) por pilar de entrega e macrossegmento.</p>
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th />
                {MARKET_IDS.map((k) => <th key={k} className="px-2 py-1 text-left font-semibold text-ink-600">{MARKETS[k].label}</th>)}
              </tr>
            </thead>
            <tbody>
              {PILLAR_IDS.map((p) => (
                <tr key={p}>
                  <td className="w-48 pr-2 font-semibold text-ink-700">{PILLARS[p].short}</td>
                  {MARKET_IDS.map((mk) => {
                    const c = matrix.cells[`${p}|${mk}`]
                    const intensity = c ? Math.max(0.08, c.value / matrix.max) : 0
                    return (
                      <td key={mk} className="rounded-md px-2 py-2 align-top"
                        style={{ background: c ? `rgba(45,127,249,${intensity * 0.55})` : '#F6F6F4' }}>
                        {c ? (
                          <>
                            <div className="font-semibold text-ink-900">{formatBRL(c.value)}</div>
                            <div className="text-[11px] text-ink-600">{c.count} oport.{c.won ? ` · ganho ${formatBRL(c.won)}` : ''}</div>
                          </>
                        ) : <span className="text-ink-300">—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Funil de oportunidades (formato de funil) */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-bold text-ink-900">Funil de oportunidades</h2>
            <div className="space-y-1">
              {funnel.map((s, i) => {
                if (!s) return null
                // Largura afunilando: proporcional ao volume, com piso decrescente
                // por etapa para manter a silhueta de funil mesmo com poucos dados.
                const floor = 92 - i * 16
                const width = Math.max(s.count ? floor : 24, (s.count / maxFunnel) * 100)
                return (
                  <div key={s.stage} className="flex justify-center">
                    <div
                      className="flex h-9 items-center justify-between rounded-md px-3 text-xs font-semibold text-white transition-all"
                      style={{
                        width: `${width}%`,
                        background: `linear-gradient(90deg, #1D1D1B ${i * 12}%, #3A3A38)`,
                        clipPath: 'polygon(0 0, 100% 0, 97% 100%, 3% 100%)',
                        opacity: s.count === 0 ? 0.35 : 1,
                      }}
                      title={`${s.label}: ${s.count} oportunidade(s) · ${formatBRL(s.potential)}`}
                    >
                      <span>{s.label}</span>
                      <span>{s.count} · {formatBRL(s.potential)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-center gap-3 text-xs text-ink-500">
              {['standby', 'perdido'].map((k) => {
                const s = pipeline.stages.find((x) => x.stage === k)
                return (
                  <span key={k} className={`chip ${CRM_STAGES[k].color}`}>
                    {CRM_STAGES[k].label}: {s?.count || 0}
                  </span>
                )
              })}
            </div>
            <p className="mt-2 text-center text-xs text-ink-400">
              Silhueta saudável = afunilando. Barriga no meio ou boca vazia pedem ação.
            </p>
          </div>

          {/* Carteira por classificação */}
          <div className="card p-5">
            <h2 className="mb-4 text-sm font-bold text-ink-900">Carteira por classificação</h2>
            <div className="space-y-3">
              {Object.entries(CLASSIFICATIONS).map(([key, cfg]) => {
                const count = stats.byClass[key] || 0
                const pct = accounts.length ? Math.round((count / accounts.length) * 100) : 0
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className={`chip ${cfg.color}`}>{cfg.label}</span>
                      <span className="font-semibold text-ink-700">
                        {count} <span className="text-ink-400">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-brand-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
            <Link to="/contas" className="btn-outline mt-4 w-full">
              Ver todas as contas
            </Link>
          </div>
        </div>

        {/* Oportunidades por aging (dias parado na etapa atual) */}
        <div className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
              <Clock size={16} className="text-brand-500" /> Oportunidades por aging
            </h2>
            <span className="text-xs text-ink-400">{aging.total} em aberto · dias parado na etapa atual</span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Distribuição por faixa */}
            <div className="space-y-2.5">
              {aging.buckets.map((b) => (
                <div key={b.key} className="flex items-center gap-3">
                  <div className="flex w-28 shrink-0 items-center gap-2 text-xs font-medium text-ink-600">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${b.dot}`} /> {b.label}
                  </div>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-ink-100">
                    <div className={`flex h-full items-center justify-end rounded-md px-2 text-xs font-semibold text-white ${b.bar}`}
                      style={{ width: `${Math.max(b.count ? 10 : 0, (b.count / aging.maxCount) * 100)}%` }}>
                      {b.count > 0 && b.count}
                    </div>
                  </div>
                  <div className="w-24 shrink-0 text-right text-xs text-ink-500">{formatBRL(b.value)}</div>
                </div>
              ))}
              <p className="pt-1 text-xs text-ink-400">
                Defina o aging aceitável por etapa; acima disso, alguém precisa agir. (base para os alertas automáticos)
              </p>
            </div>

            {/* Oportunidades mais paradas (call-to-action) */}
            <div>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                <AlertTriangle size={13} className="text-rose-500" /> Mais paradas — pedem ação
              </div>
              {aging.stalled.length ? (
                <ul className="space-y-1.5">
                  {aging.stalled.map((o) => (
                    <li key={o.id}>
                      <Link to={`/contas/${o.account_id}`}
                        className="flex items-center gap-2 rounded-lg border border-ink-100 p-2 hover:bg-ink-50">
                        <span className={`grid h-9 w-11 shrink-0 place-items-center rounded-md text-sm font-extrabold text-white ${o.bucket.bar}`}>
                          {o.days}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-ink-900">{o.accountName}</div>
                          <div className="truncate text-xs text-ink-500">
                            {o.service?.name || o.service_id} · <span className={CRM_STAGES[o.stage]?.color?.replace(/bg-\S+/, '') || ''}>{CRM_STAGES[o.stage]?.label}</span>
                            {o.ownerName ? ` · ${o.ownerName}` : ''}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-brand-500">{formatBRL(o.estimated_value_brl)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-accent-50 p-3 text-sm text-accent-700">
                  Nenhuma oportunidade parada há mais de 30 dias. Funil saudável.
                </p>
              )}
              <Link to="/pipeline" className="btn-outline mt-3 w-full">Abrir pipeline</Link>
            </div>
          </div>
        </div>

        {/* Termômetro comercial da carteira */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold text-ink-900">Termômetro comercial das oportunidades</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {THERMOMETER_LEVELS.map((k) => {
              const count = stats.byTemp[k] || 0
              return (
                <div key={k} className="rounded-lg border border-ink-100 p-3 text-center">
                  <div className={`mx-auto mb-2 h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-ink-100`}>
                    <div className={`h-full rounded-full ${THERMOMETER[k].color}`} style={{ width: `${k}%` }} />
                  </div>
                  <div className="text-xl font-extrabold text-ink-900">{count}</div>
                  <div className={`text-xs font-semibold ${THERMOMETER[k].text}`}>{THERMOMETER[k].short}</div>
                  <div className="text-[11px] text-ink-400">{THERMOMETER[k].label.split('· ')[1]}</div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Cada oportunidade tem seu próprio termômetro — classifique no card do pipeline ou na conta.
            Oportunidades perdidas ficam de fora.
          </p>
        </div>

        {/* Análise de pré-vendas: nº de oportunidades e valor por etapa */}
        <div className="card p-5">
          <h2 className="mb-1 text-sm font-bold text-ink-900">Análise de pré-vendas</h2>
          <p className="mb-3 text-xs text-ink-500">Oportunidades por etapa do funil — em quantidade e em valor.</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="py-2">Etapa</th>
                <th className="py-2 text-center">Oportunidades</th>
                <th className="py-2 text-right">Potencial</th>
                <th className="py-2 text-right">Previsão ponderada</th>
              </tr>
            </thead>
            <tbody>
              {pipeline.stages.filter((s) => s.stage !== 'perdido').map((s) => (
                <tr key={s.stage} className="border-b border-ink-100 last:border-0">
                  <td className="py-2"><span className={`chip ${CRM_STAGES[s.stage].color}`}>{s.label}</span></td>
                  <td className="py-2 text-center font-semibold text-ink-800">{s.count}</td>
                  <td className="py-2 text-right text-ink-600">{formatBRL(s.potential)}</td>
                  <td className="py-2 text-right font-semibold text-brand-600">{formatBRL(s.forecast)}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2 text-ink-800">Total (em aberto)</td>
                <td className="py-2 text-center text-ink-800">{pipeline.stages.filter((s) => !['fechado', 'perdido'].includes(s.stage)).reduce((n, s) => n + s.count, 0)}</td>
                <td className="py-2 text-right text-ink-800">{formatBRL(pipeline.totals.totalPotential - pipeline.totals.won)}</td>
                <td className="py-2 text-right text-brand-700">{formatBRL(pipeline.totals.openForecast)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Resumo de tarefas: por tipo, por status e por cliente */}
        <TaskSummaryCard />
      </div>
    </>
  )
}
