import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Calculator, Plus, Trash2, Save, Users, Receipt, Clock, Building, Timer, Percent } from 'lucide-react'
import { useSalesCost } from '../lib/hooks'
import { saveSalesCostSettings, DEMO_MODE } from '../lib/data'
import { withDefaults, resourceHourly } from '../lib/costs'
import { TASK_TYPES, CRM_STAGES, formatBRL } from '../lib/constants'
import { DEFAULT_AGING_SLA } from '../data/abmPlaybook'
import { slug } from '../data/leadrix'
import InfoTip from './InfoTip'

const newId = (prefix, label) => `${prefix}-${slug(label) || 'item'}-${Math.random().toString(36).slice(2, 6)}`

// Tabela de custo de venda (Configurações). Editada localmente e gravada de
// uma vez em "Salvar" — assim dá para ajustar várias linhas e conferir o
// custo/hora calculado antes de afetar os indicadores.
export default function SalesCostSettings() {
  const qc = useQueryClient()
  const { data } = useSalesCost()
  const [s, setS] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (data && !dirty) setS(withDefaults(structuredClone(data)))
  }, [data, dirty])

  const avgHourly = useMemo(() => {
    const act = (s?.resources || []).filter((r) => r.active !== false)
    return act.length ? act.reduce((a, r) => a + resourceHourly(r), 0) / act.length : 0
  }, [s])

  if (!s) return <div className="card p-5 text-sm text-ink-500">Carregando custos…</div>

  const edit = (fn) => { setS((prev) => { const next = structuredClone(prev); fn(next); return next }); setDirty(true); setMsg('') }
  const setList = (key, i, patch) => edit((n) => { Object.assign(n[key][i], patch) })
  const removeFrom = (key, i) => edit((n) => { n[key].splice(i, 1) })

  async function save() {
    setBusy(true); setMsg('')
    try {
      await saveSalesCostSettings(s)
      setDirty(false)
      qc.invalidateQueries({ queryKey: ['sales-cost'] })
      setMsg('Custos salvos. Novos lançamentos já usam estes valores; lançamentos antigos mantêm o custo da época.')
    } catch (e) {
      setMsg(`Erro ao salvar: ${e.message}`)
    } finally {
      setBusy(false)
    }
  }

  const num = (v) => (v === '' ? '' : Number(v))

  return (
    <div className="card lg:col-span-2">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-200 px-5 py-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><Calculator size={16} className="text-brand-500" /> Custo de venda</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Base do custo por ação ABM, custo do lead, custo de conversão e ROI da operação comercial.
            {DEMO_MODE && ' No modo demonstração os valores são exemplos — substitua pelos reais.'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {dirty && <span className="text-xs font-medium text-amber-700">Alterações não salvas</span>}
          <button className="btn-primary" onClick={save} disabled={busy || !dirty}><Save size={16} /> {busy ? 'Salvando…' : 'Salvar custos'}</button>
        </div>
      </div>
      {msg && <p className="border-b border-ink-100 bg-ink-50 px-5 py-2 text-xs text-ink-700">{msg}</p>}

      <div className="space-y-6 p-5">
        {/* Recursos / hora-homem */}
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <Users size={15} className="text-ink-500" /> Recursos e custo hora-homem
              <InfoTip>Quem trabalha nas oportunidades. Informe o custo mensal total da pessoa (salário + encargos + benefícios, ou retirada/pró-labore) e as horas produtivas no mês — o custo/hora é calculado. Se preferir, deixe o mensal em branco e informe o custo/hora direto.</InfoTip>
            </h3>
            <button className="btn-outline py-1 text-xs" onClick={() => edit((n) => n.resources.push({ id: newId('res', 'recurso'), name: '', role: '', monthly_cost: '', monthly_hours: 160, hourly_cost: '', active: true }))}>
              <Plus size={14} /> Recurso
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  <th className="pb-2 pr-2">Nome / papel</th>
                  <th className="pb-2 pr-2">Função na venda</th>
                  <th className="pb-2 pr-2 text-right">Custo mensal (R$)</th>
                  <th className="pb-2 pr-2 text-right">Horas/mês</th>
                  <th className="pb-2 pr-2 text-right">Custo/hora (R$)</th>
                  <th className="pb-2 pr-2 text-center">Ativo</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {s.resources.map((r, i) => {
                  const computed = Number(r.monthly_cost) > 0 && Number(r.monthly_hours) > 0
                  return (
                    <tr key={r.id} className="border-t border-ink-100">
                      <td className="py-1.5 pr-2"><input className="input py-1.5" value={r.name} placeholder="Ex.: Sócio(a) executivo(a)" onChange={(e) => setList('resources', i, { name: e.target.value })} /></td>
                      <td className="py-1.5 pr-2"><input className="input py-1.5" value={r.role || ''} placeholder="Ex.: Pré-venda técnica" onChange={(e) => setList('resources', i, { role: e.target.value })} /></td>
                      <td className="py-1.5 pr-2"><input type="number" min="0" className="input py-1.5 text-right" value={r.monthly_cost ?? ''} onChange={(e) => setList('resources', i, { monthly_cost: num(e.target.value) })} /></td>
                      <td className="py-1.5 pr-2"><input type="number" min="1" className="input w-24 py-1.5 text-right" value={r.monthly_hours ?? ''} onChange={(e) => setList('resources', i, { monthly_hours: num(e.target.value) })} /></td>
                      <td className="py-1.5 pr-2 text-right">
                        {computed
                          ? <span className="font-mono font-semibold text-ink-900" title="Calculado: custo mensal ÷ horas">{formatBRL(resourceHourly(r))}</span>
                          : <input type="number" min="0" className="input w-28 py-1.5 text-right" value={r.hourly_cost ?? ''} onChange={(e) => setList('resources', i, { hourly_cost: num(e.target.value) })} />}
                      </td>
                      <td className="py-1.5 pr-2 text-center"><input type="checkbox" className="h-4 w-4" checked={r.active !== false} onChange={(e) => setList('resources', i, { active: e.target.checked })} /></td>
                      <td className="py-1.5 text-right"><button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => removeFrom('resources', i)} aria-label="Remover recurso"><Trash2 size={14} /></button></td>
                    </tr>
                  )
                })}
                {!s.resources.length && <tr><td colSpan={7} className="py-3 text-sm text-ink-400">Nenhum recurso. Adicione quem participa das vendas.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-xs text-ink-500">Custo/hora médio dos recursos ativos: <b className="text-ink-800">{formatBRL(avgHourly)}</b> — usado nas estimativas das sugestões ABM.</p>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Despesas */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <Receipt size={15} className="text-ink-500" /> Despesas comerciais (custo unitário sugerido)
                <InfoTip>Viagens, hospedagem, almoços, jantares, eventos, brindes. O valor unitário é só a sugestão ao lançar — cada lançamento pode ter o valor real.</InfoTip>
              </h3>
              <button className="btn-outline py-1 text-xs" onClick={() => edit((n) => n.expense_categories.push({ id: newId('desp', 'despesa'), label: '', unit: 'unidade', default_cost: 0 }))}>
                <Plus size={14} /> Categoria
              </button>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-500">
                  <th className="pb-2 pr-2">Despesa</th><th className="pb-2 pr-2">Unidade</th><th className="pb-2 pr-2 text-right">Custo unit. (R$)</th><th />
                </tr>
              </thead>
              <tbody>
                {s.expense_categories.map((c, i) => (
                  <tr key={c.id} className="border-t border-ink-100">
                    <td className="py-1.5 pr-2"><input className="input py-1.5" value={c.label} onChange={(e) => setList('expense_categories', i, { label: e.target.value })} /></td>
                    <td className="py-1.5 pr-2"><input className="input w-28 py-1.5" value={c.unit || ''} onChange={(e) => setList('expense_categories', i, { unit: e.target.value })} /></td>
                    <td className="py-1.5 pr-2"><input type="number" min="0" className="input w-28 py-1.5 text-right" value={c.default_cost ?? ''} onChange={(e) => setList('expense_categories', i, { default_cost: num(e.target.value) })} /></td>
                    <td className="py-1.5 text-right"><button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => removeFrom('expense_categories', i)} aria-label="Remover categoria"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Horas por tipo de ação */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <Clock size={15} className="text-ink-500" /> Horas padrão por tipo de ação (por pessoa)
              <InfoTip>Preenche as horas ao adicionar uma pessoa numa ação ABM e estima o custo das jogadas sugeridas. Inclua preparação e deslocamento.</InfoTip>
            </h3>
            <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {Object.entries(TASK_TYPES).map(([k, v]) => (
                <label key={k} className="flex items-center justify-between gap-2 border-b border-ink-100 py-1 text-sm text-ink-700">
                  {v.label}
                  <span className="flex items-center gap-1">
                    <input type="number" min="0" step="0.25" className="input w-20 py-1 text-right" value={s.task_hours[k] ?? ''}
                      onChange={(e) => edit((n) => { n.task_hours[k] = num(e.target.value) })} />
                    <span className="text-xs text-ink-400">h</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {/* Custos fixos */}
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <Building size={15} className="text-ink-500" /> Custos fixos mensais da operação comercial
                <InfoTip>Custos que não pertencem a uma conta: ferramentas, assinaturas, mídia recorrente, parte de aluguel. Entram no custo total do período (proporcional aos dias).</InfoTip>
              </h3>
              <button className="btn-outline py-1 text-xs" onClick={() => edit((n) => n.fixed_costs.push({ id: newId('fix', 'custo'), label: '', monthly: 0 }))}>
                <Plus size={14} /> Custo fixo
              </button>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {s.fixed_costs.map((f, i) => (
                  <tr key={f.id} className="border-t border-ink-100">
                    <td className="py-1.5 pr-2"><input className="input py-1.5" value={f.label} placeholder="Ex.: LinkedIn Sales Navigator" onChange={(e) => setList('fixed_costs', i, { label: e.target.value })} /></td>
                    <td className="py-1.5 pr-2"><input type="number" min="0" className="input w-32 py-1.5 text-right" value={f.monthly ?? ''} onChange={(e) => setList('fixed_costs', i, { monthly: num(e.target.value) })} /></td>
                    <td className="py-1.5 text-right"><button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500" onClick={() => removeFrom('fixed_costs', i)} aria-label="Remover custo fixo"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
                {!s.fixed_costs.length && <tr><td className="py-2 text-sm text-ink-400">Nenhum custo fixo.</td></tr>}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-ink-500">Total mensal: <b className="text-ink-800">{formatBRL(s.fixed_costs.reduce((a, f) => a + (Number(f.monthly) || 0), 0))}</b></p>

            <label className="mt-4 flex items-center justify-between gap-2 text-sm text-ink-700">
              <span className="flex items-center gap-1.5 font-semibold text-ink-900">
                <Percent size={15} className="text-ink-500" /> Margem de contribuição média dos projetos
                <InfoTip>Opcional. Com ela, o ROI também é calculado sobre a margem (o que sobra da receita depois do custo de entrega), não só sobre a receita.</InfoTip>
              </span>
              <span className="flex items-center gap-1">
                <input type="number" min="0" max="100" className="input w-20 py-1 text-right" value={s.margin_pct ?? ''} placeholder="—"
                  onChange={(e) => edit((n) => { n.margin_pct = e.target.value === '' ? null : Number(e.target.value) })} />
                <span className="text-xs text-ink-400">%</span>
              </span>
            </label>
          </section>

          {/* SLA de aging */}
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-900">
              <Timer size={15} className="text-ink-500" /> SLA de aging por etapa (Radar ABM)
              <InfoTip>Quantos dias uma oportunidade pode ficar na etapa antes de pedir ação. Atenção a partir de 1×, crítico a partir de 2× e parado acima de 3× o SLA. Em Fechado, é a janela para sugerir expansão.</InfoTip>
            </h3>
            <div className="space-y-1.5">
              {Object.keys(DEFAULT_AGING_SLA).map((k) => (
                <label key={k} className="flex items-center justify-between gap-2 border-b border-ink-100 py-1 text-sm text-ink-700">
                  <span className={`chip ${CRM_STAGES[k]?.color}`}>{CRM_STAGES[k]?.label}{k === 'fechado' ? ' → expansão' : ''}</span>
                  <span className="flex items-center gap-1">
                    <input type="number" min="1" className="input w-20 py-1 text-right" value={s.aging_sla[k] ?? ''}
                      onChange={(e) => edit((n) => { n.aging_sla[k] = num(e.target.value) })} />
                    <span className="text-xs text-ink-400">dias</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
