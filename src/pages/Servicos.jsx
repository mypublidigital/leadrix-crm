import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, X } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { listServices, updateServiceValue, listAllAccountServices } from '../lib/data'
import { formatBRL } from '../lib/constants'

function ValueCell({ svc }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(svc.suggested_value_brl)

  async function save() {
    await updateServiceValue(svc.id, Number(val) || 0)
    qc.invalidateQueries({ queryKey: ['services'] })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <input
          type="number"
          className="input w-32 py-1 text-right"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          autoFocus
        />
        <button className="rounded p-1 text-emerald-600 hover:bg-emerald-50" onClick={save}><Check size={16} /></button>
        <button className="rounded p-1 text-ink-400 hover:bg-ink-100" onClick={() => setEditing(false)}><X size={16} /></button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-semibold text-ink-900">{formatBRL(svc.suggested_value_brl)}</span>
      <button className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-brand-600" onClick={() => setEditing(true)}>
        <Pencil size={14} />
      </button>
    </div>
  )
}

export default function Servicos() {
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: listServices })
  const { data: accountServices = [] } = useQuery({
    queryKey: ['all-account-services'],
    queryFn: listAllAccountServices,
  })

  // Quantas contas têm interesse em cada serviço (demanda).
  const demand = useMemo(() => {
    const m = {}
    accountServices.forEach((as) => (m[as.service_id] = (m[as.service_id] || 0) + 1))
    return m
  }, [accountServices])

  const groups = useMemo(() => {
    const map = new Map()
    services.forEach((s) => {
      if (!map.has(s.macro_id)) map.set(s.macro_id, { label: s.macro_label, items: [] })
      map.get(s.macro_id).items.push(s)
    })
    return [...map.values()]
  }, [services])

  const totalPotential = accountServices.reduce((s, as) => s + (Number(as.estimated_value_brl) || 0), 0)

  return (
    <>
      <PageHeader
        title="Serviços"
        subtitle="Catálogo organizado pelos quatro pilares de entrega da Leadrix, com valores sugeridos. Base da visão financeira do pipeline."
      />
      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-4">
            <div className="text-2xl font-extrabold text-ink-900">{services.length}</div>
            <div className="text-xs text-ink-500">Serviços no catálogo</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-extrabold text-ink-900">{accountServices.length}</div>
            <div className="text-xs text-ink-500">Interesses registrados (leads × serviço)</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-extrabold text-brand-600">{formatBRL(totalPotential)}</div>
            <div className="text-xs text-ink-500">Potencial total em interesse</div>
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.label} className="card overflow-hidden">
            <div className="border-b border-ink-200 bg-ink-50/60 px-4 py-2.5 text-sm font-bold text-ink-800">
              {g.label}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5">Serviço</th>
                  <th className="px-4 py-2.5 text-center">Complexidade</th>
                  <th className="px-4 py-2.5 text-center">Leads interessados</th>
                  <th className="px-4 py-2.5 text-right">Valor sugerido</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((s) => (
                  <tr key={s.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2 font-medium text-ink-900">
                        {s.name}
                        {s.anchor && <span className="chip bg-amber-100 text-amber-700">âncora</span>}
                      </div>
                      <div className="font-mono text-xs text-ink-400">{s.service_id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-ink-600">{s.complexity_range}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`chip ${demand[s.id] ? 'bg-sky-100 text-sky-700' : 'bg-ink-100 text-ink-400'}`}>
                        {demand[s.id] || 0}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right"><ValueCell svc={s} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  )
}
