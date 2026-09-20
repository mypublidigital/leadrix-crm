import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calculator, Plus, Trash2 } from 'lucide-react'
import { listCostEntries, addCostEntries, deleteCostEntry } from '../lib/data'
import { useSalesCost } from '../lib/hooks'
import { allocateCosts, entryAmount, opportunityRoi, resourceHourly, withDefaults } from '../lib/costs'
import { formatBRL, formatPct, CRM_STAGES } from '../lib/constants'
import InfoTip from './InfoTip'

// Custo de venda de UMA conta: total, custo e ROI por oportunidade e os
// lançamentos (das ações ABM ou avulsos — ex.: horas de proposta, viagem).
export default function AccountCostPanel({ account, opportunities = [], focusOpportunityId = null }) {
  const qc = useQueryClient()
  const { data: settingsRaw } = useSalesCost()
  const settings = withDefaults(settingsRaw)
  const { data: entries = [] } = useQuery({
    queryKey: ['cost-entries', 'account', account.id],
    queryFn: () => listCostEntries({ accountId: account.id }),
  })
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(null)
  const [err, setErr] = useState('')

  const resById = useMemo(() => new Map(settings.resources.map((r) => [r.id, r])), [settings])
  const catById = useMemo(() => new Map(settings.expense_categories.map((c) => [c.id, c])), [settings])
  const oppById = useMemo(() => new Map(opportunities.map((o) => [o.id, o])), [opportunities])

  const { byOpp, unallocated } = useMemo(() => allocateCosts(opportunities, entries), [opportunities, entries])
  const visibleOpps = focusOpportunityId ? opportunities.filter((o) => o.id === focusOpportunityId) : opportunities
  const visibleEntries = focusOpportunityId
    ? entries.filter((e) => e.opportunity_id === focusOpportunityId || !e.opportunity_id)
    : entries
  const total = focusOpportunityId
    ? byOpp.get(focusOpportunityId)?.total || 0
    : entries.reduce((s, e) => s + entryAmount(e), 0)
  const hours = focusOpportunityId
    ? byOpp.get(focusOpportunityId)?.hours || 0
    : entries.filter((e) => e.kind === 'hours').reduce((s, e) => s + (Number(e.hours) || 0), 0)

  function startAdd() {
    const r = settings.resources.find((x) => x.active !== false)
    setForm({
      kind: r ? 'hours' : 'expense',
      opportunity_id: focusOpportunityId || '',
      resource_id: r?.id || '',
      hours: 1,
      category_id: settings.expense_categories[0]?.id || '',
      quantity: 1,
      unit_cost: settings.expense_categories[0]?.default_cost || 0,
      description: '',
      date: new Date().toISOString().slice(0, 10),
    })
    setAdding(true); setErr('')
  }

  async function save() {
    setErr('')
    try {
      const e = form.kind === 'hours'
        ? { ...form, account_id: account.id, hourly_cost: resourceHourly(resById.get(form.resource_id)) }
        : { ...form, account_id: account.id }
      if (form.kind === 'hours' && !(Number(form.hours) > 0)) throw new Error('Informe as horas.')
      if (form.kind === 'expense' && !(Number(form.unit_cost) > 0)) throw new Error('Informe o custo unitário.')
      await addCostEntries([e])
      qc.invalidateQueries({ queryKey: ['cost-entries'] })
      setAdding(false)
    } catch (e) {
      setErr(e.message)
    }
  }

  async function remove(id) {
    await deleteCostEntry(id)
    qc.invalidateQueries({ queryKey: ['cost-entries'] })
  }

  const set = (k) => (ev) => setForm((f) => ({ ...f, [k]: ev.target.value }))

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <Calculator size={16} className="text-brand-500" /> {focusOpportunityId ? 'Custo de venda da oportunidade' : 'Custo de venda da conta'}
          <InfoTip>Horas (custo hora-homem gravado no lançamento) + despesas. Lançamentos sem oportunidade são rateados entre as oportunidades da conta pelo valor estimado.</InfoTip>
        </h2>
        <button className="btn-ghost text-xs" onClick={startAdd}><Plus size={14} /> Lançar</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-ink-900 p-3 text-white">
          <div className="text-[11px] uppercase tracking-wide text-ink-300">Custo acumulado</div>
          <div className="font-display text-xl">{formatBRL(total)}</div>
        </div>
        <div className="rounded-lg border border-ink-200 p-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-500">Horas investidas</div>
          <div className="font-display text-xl text-ink-900">{hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h</div>
        </div>
      </div>

      {visibleOpps.length > 0 && (
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              <th className="py-1">Oportunidade</th><th className="py-1 text-right">Custo</th><th className="py-1 text-right">ROI</th>
            </tr>
          </thead>
          <tbody>
            {visibleOpps.map((o) => {
              const r = opportunityRoi(o, byOpp.get(o.id)?.total || 0, account)
              return (
                <tr key={o.id} className="border-t border-ink-100">
                  <td className="py-1.5 pr-2">
                    <div className="truncate text-ink-800">{o.service?.name || o.service_id}</div>
                    <div className="text-[10px] text-ink-400">{CRM_STAGES[o.stage]?.label} · {formatBRL(o.estimated_value_brl)}</div>
                  </td>
                  <td className="py-1.5 text-right font-semibold text-ink-900">{formatBRL(r.cost)}</td>
                  <td className={`py-1.5 text-right font-semibold ${r.roi == null ? 'text-ink-400' : r.roi >= 0 ? 'text-accent-700' : 'text-rose-600'}`}>
                    {formatPct(r.roi)}{r.projected && r.roi != null ? <span className="ml-0.5 text-[9px] font-normal text-ink-400">proj.</span> : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {!focusOpportunityId && unallocated > 0 && (
        <p className="mt-2 text-[11px] text-amber-700">{formatBRL(unallocated)} lançados sem oportunidade para ratear — crie a oportunidade da conta.</p>
      )}

      {adding && form && (
        <div className="mt-3 space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
          <div className="flex gap-1">
            {[['hours', 'Horas'], ['expense', 'Despesa']].map(([k, l]) => (
              <button key={k} onClick={() => setForm((f) => ({ ...f, kind: k }))}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${form.kind === k ? 'bg-ink-900 text-white' : 'bg-white text-ink-600'}`}>{l}</button>
            ))}
          </div>
          {!focusOpportunityId && (
            <select className="input py-1.5 text-xs" value={form.opportunity_id} onChange={set('opportunity_id')}>
              <option value="">Conta toda (ratear)</option>
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.service?.name || o.service_id}</option>)}
            </select>
          )}
          {form.kind === 'hours' ? (
            <div className="grid grid-cols-3 gap-2">
              <select className="input col-span-2 py-1.5 text-xs" value={form.resource_id} onChange={set('resource_id')}>
                {settings.resources.filter((r) => r.active !== false).map((r) => <option key={r.id} value={r.id}>{r.name} · {formatBRL(resourceHourly(r))}/h</option>)}
              </select>
              <input type="number" min="0" step="0.25" className="input py-1.5 text-right text-xs" value={form.hours} onChange={set('hours')} title="Horas" />
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              <select className="input col-span-2 py-1.5 text-xs" value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value, unit_cost: catById.get(e.target.value)?.default_cost ?? f.unit_cost }))}>
                {settings.expense_categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input type="number" min="0" className="input py-1.5 text-right text-xs" value={form.quantity} onChange={set('quantity')} title="Quantidade" />
              <input type="number" min="0" className="input py-1.5 text-right text-xs" value={form.unit_cost} onChange={set('unit_cost')} title="Custo unitário" />
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <input className="input col-span-2 py-1.5 text-xs" placeholder="Descrição (ex.: elaboração da proposta)" value={form.description} onChange={set('description')} />
            <input type="date" className="input py-1.5 text-xs" value={form.date} onChange={set('date')} />
          </div>
          {err && <p className="text-xs text-rose-600">{err}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost py-1 text-xs" onClick={() => setAdding(false)}>Cancelar</button>
            <button className="btn-primary py-1 text-xs" onClick={save}>Lançar custo</button>
          </div>
        </div>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-brand-600">Lançamentos ({visibleEntries.length})</summary>
        <ul className="mt-2 max-h-64 space-y-1 overflow-auto text-xs">
          {visibleEntries
            .slice()
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
            .map((e) => (
              <li key={e.id} className="flex items-center gap-2 border-b border-ink-100 py-1 last:border-0">
                <span className="w-16 shrink-0 font-mono text-[10px] text-ink-400">{String(e.date).slice(5, 10).split('-').reverse().join('/')}</span>
                <span className="min-w-0 flex-1 truncate text-ink-700">
                  {e.kind === 'hours'
                    ? `${resById.get(e.resource_id)?.name || 'Recurso'} · ${Number(e.hours).toLocaleString('pt-BR')} h`
                    : `${catById.get(e.category_id)?.label || 'Despesa'} · ${Number(e.quantity || 1).toLocaleString('pt-BR')}×`}
                  {e.description ? ` — ${e.description}` : ''}
                  {!focusOpportunityId && e.opportunity_id && <span className="text-ink-400"> · {oppById.get(e.opportunity_id)?.service?.name}</span>}
                  {e.task_id && <span className="text-ink-400"> · ação ABM</span>}
                </span>
                <span className="shrink-0 font-semibold text-ink-900">{formatBRL(entryAmount(e))}</span>
                {!e.task_id && (
                  <button className="shrink-0 rounded p-0.5 text-ink-300 hover:text-rose-500" onClick={() => remove(e.id)} aria-label="Apagar lançamento"><Trash2 size={12} /></button>
                )}
              </li>
            ))}
          {!visibleEntries.length && <li className="text-ink-400">Nenhum custo lançado.</li>}
        </ul>
        <p className="mt-1 text-[10px] text-ink-400">Custos de ações ABM são editados na própria ação.</p>
      </details>
    </div>
  )
}
