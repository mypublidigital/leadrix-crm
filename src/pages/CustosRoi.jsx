import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calculator, Users, Target, Trophy, TrendingUp, Percent, Wallet, Info } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SegmentFilters, { oppMatches, accountMatches, PillarBadge } from '../components/SegmentFilters'
import InfoTip from '../components/InfoTip'
import { useAccounts, useOpportunities, useSalesCost, useCostEntries } from '../lib/hooks'
import { operationMetrics, opportunityRoi, breakdown, entryAmount, withDefaults, wonAt, inRange } from '../lib/costs'
import { MARKETS, PILLARS, PILLAR_IDS, MARKET_IDS } from '../data/leadrix'
import { CRM_STAGES, formatBRL, formatPct, LEAD_ORIGINATORS } from '../lib/constants'
import { useAuth } from '../lib/useAuth'

const PERIODS = {
  30: 'Últimos 30 dias',
  90: 'Últimos 90 dias',
  180: 'Últimos 180 dias',
  365: 'Últimos 12 meses',
  ano: 'Ano atual',
  custom: 'Personalizado',
}

const isoDaysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export default function CustosRoi() {
  const { data: accounts = [] } = useAccounts()
  const { data: oppsRaw = [] } = useOpportunities()
  const { data: settingsRaw } = useSalesCost()
  const { data: entries = [] } = useCostEntries()
  const settings = withDefaults(settingsRaw)
  const { can } = useAuth()

  const [period, setPeriod] = useState('365')
  const [customFrom, setCustomFrom] = useState(isoDaysAgo(90))
  const [customTo, setCustomTo] = useState(isoDaysAgo(0))
  const [seg, setSeg] = useState({ segment: '', micro: '', pillar: '' })
  const [sortBy, setSortBy] = useState('cost')

  const today = isoDaysAgo(0)
  const from = period === 'custom' ? customFrom : period === 'ano' ? `${today.slice(0, 4)}-01-01` : isoDaysAgo(Number(period))
  const to = period === 'custom' ? customTo : today

  const accById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const hasFilter = Boolean(seg.segment || seg.micro || seg.pillar)

  const m = useMemo(
    () => operationMetrics(oppsRaw, entries, settingsRaw, {
      from, to,
      accountById: accById,
      filter: hasFilter ? (o) => oppMatches(o, accById.get(o.account_id), seg) : undefined,
    }),
    [oppsRaw, entries, settingsRaw, from, to, hasFilter, seg, accById],
  )

  const scopedOpps = useMemo(
    () => oppsRaw.filter((o) => oppMatches(o, accById.get(o.account_id), seg)),
    [oppsRaw, accById, seg],
  )

  // Oportunidades com custo no período (ou ganhas no período).
  const oppRows = useMemo(() => {
    const rows = scopedOpps
      .map((o) => {
        const cost = m.byOpp.get(o.id)?.total || 0
        const acc = accById.get(o.account_id)
        return { o, acc, hours: m.byOpp.get(o.id)?.hours || 0, ...opportunityRoi(o, cost, acc) }
      })
      .filter((r) => r.cost > 0)
    const key = { cost: (r) => -r.cost, roi: (r) => -(r.roi ?? -Infinity), value: (r) => -(Number(r.o.estimated_value_brl) || 0) }[sortBy]
    return rows.sort((a, b) => key(a) - key(b))
  }, [scopedOpps, m, accById, sortBy])

  const wonInPeriod = (o) => inRange(wonAt(o), from, to)
  const byPillar = useMemo(() => breakdown(scopedOpps, m.byOpp, (o) => o.service?.macro_id, (k) => PILLARS[k]?.short || 'Sem pilar', wonInPeriod, accById), [scopedOpps, m, from, to, accById])
  const byMarket = useMemo(() => breakdown(scopedOpps, m.byOpp, (o) => accById.get(o.account_id)?.segment, (k) => MARKETS[k]?.label || 'Sem mercado', wonInPeriod, accById), [scopedOpps, m, accById, from, to])
  const byMicro = useMemo(() => breakdown(scopedOpps, m.byOpp, (o) => accById.get(o.account_id)?.micro_segment, (k) => k, wonInPeriod, accById), [scopedOpps, m, accById, from, to])
  // Comissão de indicação por originador do lead (quem trouxe a conta).
  const byOriginator = useMemo(
    () => breakdown(
      scopedOpps, m.byOpp,
      (o) => accById.get(o.account_id)?.origin_source,
      (k) => LEAD_ORIGINATORS[k] || 'Sem origem informada',
      wonInPeriod, accById,
    ),
    [scopedOpps, m, accById, from, to],
  )

  // Quebra por recurso e por categoria: lançamentos do período que caem no filtro.
  const { byResource, byCategory } = useMemo(() => {
    const resName = new Map(settings.resources.map((r) => [r.id, r.name]))
    const catName = new Map(settings.expense_categories.map((c) => [c.id, c.label]))
    const oppById = new Map(oppsRaw.map((o) => [o.id, o]))
    const res = new Map()
    const cat = new Map()
    entries.forEach((e) => {
      const d = String(e.date || e.created_at).slice(0, 10)
      if (d < from || d > to) return
      if (!accountMatches(accById.get(e.account_id), seg)) return
      if (seg.pillar) {
        const o = oppById.get(e.opportunity_id)
        if (!o || o.service?.macro_id !== seg.pillar) return
      }
      const amount = entryAmount(e)
      if (e.kind === 'hours') {
        const k = e.resource_id || '—'
        const row = res.get(k) || { label: resName.get(k) || 'Recurso removido', hours: 0, cost: 0 }
        row.hours += Number(e.hours) || 0
        row.cost += amount
        res.set(k, row)
      } else {
        const k = e.category_id || '—'
        const row = cat.get(k) || { label: catName.get(k) || 'Categoria removida', qty: 0, cost: 0 }
        row.qty += Number(e.quantity) || 0
        row.cost += amount
        cat.set(k, row)
      }
    })
    return {
      byResource: [...res.values()].sort((a, b) => b.cost - a.cost),
      byCategory: [...cat.values()].sort((a, b) => b.cost - a.cost),
    }
  }, [entries, from, to, seg, accById, oppsRaw, settings])

  const noConfig = !settings.resources.length

  // Perfil Vendas não vê custo nem ROI: vê o resultado comercial do período.
  if (!can('costs.view')) {
    return (
      <>
        <PageHeader eyebrow="Resultados" title="Resultados comerciais"
          subtitle="Leads, vendas, receita e conversão do período. Custo de venda e ROI ficam com Administração e Marketing." />
        <div className="space-y-5 p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Leads no período" value={m.leads} />
            <MiniStat label="Vendas ganhas" value={m.won} />
            <MiniStat label="Receita fechada" value={formatBRL(m.revenue)} />
            <MiniStat label="Taxa de conversão" value={formatPct(m.conversion)} />
          </div>
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-ink-900">Pipeline em aberto</h2>
            <p className="text-sm text-ink-600">
              {m.open} oportunidade(s) em aberto, com previsão ponderada de <b>{formatBRL(m.openForecast)}</b>.
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="ABM inteligente"
        title="Custo de venda & ROI"
        subtitle="Quanto custa gerar um lead, converter uma venda e qual o retorno da operação comercial — por período, mercado, microssegmento e pilar."
        actions={<Link to="/config" className="btn-outline"><Calculator size={16} /> Tabela de custos</Link>}
      />
      <div className="space-y-5 p-6">
        {noConfig && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Nenhum recurso com custo hora-homem cadastrado. Preencha a tabela em <Link to="/config" className="font-semibold underline">Configurações → Custo de venda</Link> para os indicadores fazerem sentido.
          </div>
        )}

        <div className="card grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="label">Período</label>
            <select className="input" value={period} onChange={(e) => setPeriod(e.target.value)}>
              {Object.entries(PERIODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {period === 'custom' ? (
            <>
              <div><label className="label">De</label><input type="date" className="input" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} /></div>
              <div><label className="label">Até</label><input type="date" className="input" value={customTo} onChange={(e) => setCustomTo(e.target.value)} /></div>
            </>
          ) : (
            <div className="col-span-1 self-end pb-2 text-xs text-ink-500 md:col-span-2">
              {new Date(`${from}T00:00`).toLocaleDateString('pt-BR')} a {new Date(`${to}T00:00`).toLocaleDateString('pt-BR')} · {m.days} dias
            </div>
          )}
          <SegmentFilters value={seg} onChange={setSeg} />
        </div>

        {/* KPIs principais */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Wallet} label="Custo total de venda" value={formatBRL(m.totalCost)}
            detail={`Horas ${formatBRL(m.hoursCost)} · Despesas ${formatBRL(m.expensesCost)} · Fixos ${formatBRL(m.fixedCost)} · Comissão ${formatBRL(m.commissionCost)}`}
            tip="Horas (horas × custo hora-homem gravado no lançamento) + despesas + custos fixos mensais proporcionais ao período + comissão de indicação sobre o que foi ganho. Com filtro, os fixos são rateados pela participação do filtro nos leads." />
          <Kpi icon={Users} label="Custo por lead" value={m.costPerLead != null ? formatBRL(m.costPerLead) : '—'}
            detail={`${m.leads} lead(s) no período`}
            tip="Custo total ÷ oportunidades criadas no período. Cada oportunidade (serviço de interesse de uma conta) conta como um lead." />
          <Kpi icon={Trophy} label="Custo de conversão" value={m.costPerConversion != null ? formatBRL(m.costPerConversion) : '—'}
            detail={`${m.won} venda(s) · conversão ${formatPct(m.conversion)}`}
            tip="Custo total ÷ oportunidades ganhas no período (CAC da operação). Conversão = ganhas ÷ leads do período." />
          <Kpi icon={TrendingUp} label="ROI da operação" value={formatPct(m.roi)} accent={m.roi != null && m.roi >= 0}
            detail={m.roiMargin != null ? `Sobre margem (${formatPct(m.margin)}): ${formatPct(m.roiMargin)}` : 'Informe a margem em Config para ver o ROI sobre margem'}
            tip="(Receita fechada no período − custo total) ÷ custo total. Sobre margem: (receita × margem de contribuição − custo) ÷ custo." />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Receita fechada" value={formatBRL(m.revenue)} />
          <MiniStat label="Custo de venda / receita" value={formatPct(m.costToRevenue, 1)} />
          <MiniStat label="Horas comerciais investidas" value={`${m.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`} />
          <MiniStat label="Pipeline aberto: investido × previsão ponderada" value={`${formatBRL(m.openCost)} → ${formatBRL(m.openForecast)}`}
            sub={`ROI projetado ${formatPct(m.roiProjected)} · ${m.open} oportunidade(s)`} />
        </div>

        {/* Quebras */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BreakdownTable title="Por pilar de entrega" rows={byPillar} order={PILLAR_IDS.map((k) => PILLARS[k].short)} renderLabel={(r) => {
            const id = PILLAR_IDS.find((k) => PILLARS[k].short === r.label)
            return id ? <PillarBadge id={id} /> : r.label
          }} />
          <BreakdownTable title="Por mercado" rows={byMarket} order={MARKET_IDS.map((k) => MARKETS[k].label)} />
          <BreakdownTable title="Por microssegmento" rows={byMicro.sort((a, b) => b.cost - a.cost)} />
          <BreakdownTable title="Por origem do lead (com comissão de indicação)" rows={byOriginator.sort((a, b) => b.cost - a.cost)} />
          <div className="card p-5">
            <h2 className="mb-3 text-sm font-bold text-ink-900">Por recurso e por tipo de despesa</h2>
            <table className="w-full text-sm">
              <tbody>
                {byResource.map((r) => (
                  <tr key={r.label} className="border-b border-ink-100">
                    <td className="py-1.5 text-ink-700">{r.label}</td>
                    <td className="py-1.5 text-right font-mono text-xs text-ink-500">{r.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</td>
                    <td className="py-1.5 text-right font-semibold text-ink-900">{formatBRL(r.cost)}</td>
                  </tr>
                ))}
                {byCategory.map((r) => (
                  <tr key={r.label} className="border-b border-ink-100 last:border-0">
                    <td className="py-1.5 text-ink-700">{r.label}</td>
                    <td className="py-1.5 text-right font-mono text-xs text-ink-500">{r.qty.toLocaleString('pt-BR')} un.</td>
                    <td className="py-1.5 text-right font-semibold text-ink-900">{formatBRL(r.cost)}</td>
                  </tr>
                ))}
                {m.commissionCost > 0 && (
                  <tr className="border-t border-ink-200">
                    <td className="py-1.5 font-medium text-ink-800">Comissão de indicação</td>
                    <td className="py-1.5 text-right font-mono text-xs text-ink-500">{m.won} venda(s)</td>
                    <td className="py-1.5 text-right font-semibold text-ink-900">{formatBRL(m.commissionCost)}</td>
                  </tr>
                )}
                {!byResource.length && !byCategory.length && !m.commissionCost && (
                  <tr><td className="py-4 text-center text-sm text-ink-400">Sem lançamentos no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Por oportunidade */}
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><Target size={16} className="text-brand-500" /> Custo e ROI por oportunidade</h2>
            <span className="text-xs text-ink-500">{oppRows.length} com custo no período</span>
            <select className="input ml-auto w-auto py-1.5 text-xs" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="cost">Maior custo</option>
              <option value="roi">Maior ROI</option>
              <option value="value">Maior valor</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5">Conta · serviço</th>
                  <th className="px-4 py-2.5">Etapa</th>
                  <th className="px-4 py-2.5 text-right">Horas</th>
                  <th className="px-4 py-2.5 text-right">Custo de venda</th>
                  <th className="px-4 py-2.5 text-right">Valor</th>
                  <th className="px-4 py-2.5 text-right">Custo / valor</th>
                  <th className="px-4 py-2.5 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {oppRows.map((r) => (
                  <tr key={r.o.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                    <td className="px-4 py-2.5">
                      <Link to={`/contas/${r.o.account_id}`} className="font-semibold text-ink-900 hover:text-brand-600">{r.acc?.name}</Link>
                      <div className="flex items-center gap-1.5 text-xs text-ink-500">{r.o.service?.name}{r.o.service?.macro_id && <PillarBadge id={r.o.service.macro_id} />}</div>
                    </td>
                    <td className="px-4 py-2.5"><span className={`chip ${CRM_STAGES[r.o.stage]?.color}`}>{CRM_STAGES[r.o.stage]?.label}</span></td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs">{r.hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{formatBRL(r.cost)}</td>
                    <td className="px-4 py-2.5 text-right">{formatBRL(r.o.estimated_value_brl)}</td>
                    <td className="px-4 py-2.5 text-right text-ink-600">{Number(r.o.estimated_value_brl) ? formatPct(r.cost / Number(r.o.estimated_value_brl), 1) : '—'}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${r.roi == null ? 'text-ink-400' : r.roi >= 0 ? 'text-accent-700' : 'text-rose-600'}`}>
                      {formatPct(r.roi)}{r.projected && r.roi != null && <span className="ml-1 text-[10px] font-normal text-ink-400">proj.</span>}
                    </td>
                  </tr>
                ))}
                {oppRows.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-ink-500">Nenhuma oportunidade com custo lançado neste recorte.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-5 text-xs text-ink-600">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-900"><Info size={16} className="text-brand-500" /> Como os números são calculados</h2>
          <ul className="grid grid-cols-1 gap-x-8 gap-y-1.5 md:grid-cols-2">
            <li><b>Custo de uma ação</b> = Σ (horas × custo hora-homem) + Σ (quantidade × custo unitário das despesas).</li>
            <li><b>Custo hora-homem</b> = custo mensal total (salário + encargos + benefícios) ÷ horas produtivas no mês, ou valor informado direto.</li>
            <li><b>Rateio</b>: lançamento sem oportunidade é dividido entre as oportunidades da conta pelo valor estimado.</li>
            <li><b>Custo por lead</b> = custo total do período ÷ oportunidades criadas no período.</li>
            <li><b>Custo de conversão</b> = custo total do período ÷ oportunidades ganhas no período (inclui a comissão de indicação).</li>
            <li><b>Comissão de indicação</b> = percentual da conta × valor ganho. Em oportunidades abertas, entra projetada sobre o valor ponderado.</li>
            <li><b>ROI</b> = (receita fechada − custo total) ÷ custo total. <b>ROI projetado</b> usa a previsão ponderada pela probabilidade da etapa.</li>
          </ul>
          <p className="mt-2 text-ink-400">O custo/hora é gravado em cada lançamento: reajustar o custo de uma pessoa não altera o passado. <Percent size={11} className="inline" /> Custo de venda / receita mostra quanto de cada real vendido foi gasto para vender.</p>
        </div>
      </div>
    </>
  )
}

function Kpi({ icon: Icon, label, value, detail, tip, accent }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-600">
        <Icon size={15} className="text-brand-500" /> {label}
        {tip && <InfoTip>{tip}</InfoTip>}
      </div>
      <div className={`kpi mt-1 ${accent ? 'text-accent-700' : ''}`}>{value}</div>
      {detail && <div className="mt-0.5 text-[11px] text-ink-500">{detail}</div>}
    </div>
  )
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
      <div className="mt-0.5 font-display text-lg text-ink-900">{value}</div>
      {sub && <div className="text-[11px] text-ink-500">{sub}</div>}
    </div>
  )
}

function BreakdownTable({ title, rows, order, renderLabel }) {
  const sorted = order ? [...rows].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label)) : rows
  const maxCost = Math.max(1, ...rows.map((r) => r.cost))
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-bold text-ink-900">{title}</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            <th className="pb-2" />
            <th className="pb-2 text-right">Custo</th>
            <th className="pb-2 text-right">Receita</th>
            <th className="pb-2 text-right">Vendas</th>
            <th className="pb-2 text-right">ROI</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.key} className="border-t border-ink-100">
              <td className="py-1.5 pr-2">
                <div>{renderLabel ? renderLabel(r) : <span className="text-ink-700">{r.label}</span>}</div>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.cost / maxCost) * 100}%` }} /></div>
              </td>
              <td className="py-1.5 text-right font-semibold text-ink-900">{formatBRL(r.cost)}</td>
              <td className="py-1.5 text-right text-ink-600">{formatBRL(r.revenue)}</td>
              <td className="py-1.5 text-right text-ink-600">{r.won}/{r.count}</td>
              <td className={`py-1.5 text-right font-semibold ${r.roi == null ? 'text-ink-400' : r.roi >= 0 ? 'text-accent-700' : 'text-rose-600'}`}>{formatPct(r.roi)}</td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="py-4 text-center text-sm text-ink-400">Sem dados.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
