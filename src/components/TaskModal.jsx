import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Clock, Receipt, Sparkles } from 'lucide-react'
import Modal from './Modal'
import { TASK_TYPES, TASK_STATUS, formatBRL } from '../lib/constants'
import {
  listAccounts,
  listServices,
  createTask,
  updateTask,
  addAccountService,
  listAccountServices,
  listCostEntries,
  replaceTaskCostEntries,
} from '../lib/data'
import { useSalesCost } from '../lib/hooks'
import { entryAmount, resourceHourly } from '../lib/costs'
import { PLAYS } from '../data/abmPlaybook'
import { useAuth } from '../lib/useAuth'
import { triggerEmailEvent } from '../lib/messaging'

// Modal de criar/editar AÇÃO ABM. Além do que já existia (conta, contato,
// serviços de interesse), registra:
//   • a oportunidade trabalhada e a jogada ABM de origem (quando veio do Radar);
//   • o CUSTO da ação: quem trabalhou (horas × custo hora-homem) e despesas
//     (viagem, almoço, jantar…). Esses lançamentos alimentam o custo de venda,
//     o custo do lead, o custo de conversão e o ROI.
//
// `draft` pré-preenche uma ação nova (ex.: sugestão do Radar ABM).
export default function TaskModal({ task, draft, defaultAccountId, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(task?.id)
  const base = task || draft || {}

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: listServices })
  const { data: settings } = useSalesCost()
  const { can } = useAuth()
  const showCosts = can('costs.view')

  const [accountId, setAccountId] = useState(base.account_id || defaultAccountId || '')
  const [opportunityId, setOpportunityId] = useState(base.opportunity_id || '')
  const [contactId, setContactId] = useState(base.contact_id || '')
  const [title, setTitle] = useState(base.title || '')
  const [taskType, setTaskType] = useState(base.task_type || 'ligacao')
  const [date, setDate] = useState(base.scheduled_date || new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState(base.status || 'planejada')
  const [description, setDescription] = useState(base.description || '')
  const [serviceIds, setServiceIds] = useState(base.service_ids || [])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Custos da ação.
  const [hoursRows, setHoursRows] = useState(null) // [{resource_id, hours, hourly_cost}]
  const [expenseRows, setExpenseRows] = useState(null) // [{category_id, quantity, unit_cost, description}]

  const account = accounts.find((a) => a.id === accountId)
  const contacts = account?.contacts || []
  const play = PLAYS.find((p) => p.id === base.abm_play_id)

  const { data: accountServices = [] } = useQuery({
    queryKey: ['account-services', accountId],
    queryFn: () => listAccountServices(accountId),
    enabled: Boolean(accountId),
  })
  const alreadyInterest = new Set(accountServices.map((as) => as.service_id))

  const { data: existingEntries } = useQuery({
    queryKey: ['cost-entries', 'task', task?.id],
    queryFn: async () => (await listCostEntries({ accountId: task.account_id })).filter((e) => e.task_id === task.id),
    enabled: isEdit,
  })

  const resources = useMemo(() => (settings?.resources || []).filter((r) => r.active !== false), [settings])
  const categories = settings?.expense_categories || []
  const resById = useMemo(() => new Map((settings?.resources || []).map((r) => [r.id, r])), [settings])
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  // Inicializa as linhas de custo uma única vez, quando os dados chegam.
  useEffect(() => {
    if (hoursRows !== null || !settings) return
    if (isEdit) {
      if (!existingEntries) return
      setHoursRows(existingEntries.filter((e) => e.kind === 'hours').map((e) => ({ resource_id: e.resource_id, hours: e.hours, hourly_cost: e.hourly_cost })))
      setExpenseRows(existingEntries.filter((e) => e.kind === 'expense').map((e) => ({ category_id: e.category_id, quantity: e.quantity, unit_cost: e.unit_cost, description: e.description || '' })))
      return
    }
    setHoursRows((draft?.cost_hours || []).map((h) => ({ ...h, hourly_cost: resourceHourly(resById.get(h.resource_id)) })))
    setExpenseRows((draft?.cost_expenses || []).map((x) => ({ ...x, unit_cost: catById.get(x.category_id)?.default_cost ?? 0, description: '' })))
  }, [settings, existingEntries, isEdit, draft, hoursRows, resById, catById])

  const defaultHours = Number(settings?.task_hours?.[taskType] ?? TASK_TYPES[taskType]?.hours ?? 1)

  function addHours() {
    const used = new Set((hoursRows || []).map((h) => h.resource_id))
    const r = resources.find((x) => !used.has(x.id)) || resources[0]
    if (!r) return
    setHoursRows((rows) => [...(rows || []), { resource_id: r.id, hours: defaultHours, hourly_cost: resourceHourly(r) }])
  }
  function addExpense() {
    const c = categories[0]
    if (!c) return
    setExpenseRows((rows) => [...(rows || []), { category_id: c.id, quantity: 1, unit_cost: c.default_cost || 0, description: '' }])
  }
  const setRow = (setter, i, patch) => setter((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const costPreview = useMemo(() => {
    const h = (hoursRows || []).reduce((s, r) => s + entryAmount({ kind: 'hours', ...r }), 0)
    const e = (expenseRows || []).reduce((s, r) => s + entryAmount({ kind: 'expense', ...r }), 0)
    return { h, e, total: h + e }
  }, [hoursRows, expenseRows])

  function toggleService(id) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSave() {
    if (!accountId || !title) return
    setSaving(true); setErr('')
    try {
      const payload = {
        account_id: accountId,
        opportunity_id: opportunityId || null,
        contact_id: contactId || null,
        abm_play_id: base.abm_play_id || null,
        title,
        task_type: taskType,
        scheduled_date: date,
        status,
        description: description || null,
        service_ids: serviceIds,
      }
      let taskId = task?.id
      if (isEdit) await updateTask(task.id, payload)
      else taskId = (await createTask(payload)).id

      const entries = [
        ...(hoursRows || []).map((r) => ({ kind: 'hours', account_id: accountId, opportunity_id: opportunityId || null, date, ...r })),
        ...(expenseRows || []).map((r) => ({ kind: 'expense', account_id: accountId, opportunity_id: opportunityId || null, date, ...r })),
      ]
      if (showCosts && taskId && (isEdit || entries.length)) await replaceTaskCostEntries(taskId, entries)

      // Ação concluída pode disparar e-mail de resumo (modelo do evento).
      if (status === 'concluida' && task?.status !== 'concluida') {
        await triggerEmailEvent('acao_concluida', {
          account,
          contactId: contactId || null,
          opportunity: accountServices.find((o) => o.id === opportunityId) || null,
          task: { id: taskId },
        })
      }

      for (const sid of serviceIds) {
        if (!alreadyInterest.has(sid)) {
          const svc = services.find((s) => s.id === sid)
          await addAccountService(accountId, sid, svc?.suggested_value_brl || 0, 'interessado')
        }
      }

      ;['tasks', 'accounts', 'account-services', 'all-account-services', 'cost-entries', 'abm-dismissals'].forEach((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      )
      qc.invalidateQueries({ queryKey: ['account', accountId] })
      onClose(true)
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      wide
      title={isEdit ? 'Editar ação ABM' : draft ? 'Nova ação ABM (sugerida)' : 'Nova ação ABM'}
      onClose={() => onClose(false)}
      footer={
        <>
          {showCosts && (
            <span className="mr-auto text-xs text-ink-500">
              Custo desta ação: <b className="text-ink-900">{formatBRL(costPreview.total)}</b>
            </span>
          )}
          <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !accountId || !title}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      {err && <p className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</p>}
      {play && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent-200 bg-accent-50 p-3 text-xs text-ink-700">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-accent-600" />
          <span>Ação criada a partir da jogada <b>{play.title}</b>. Ao salvar, ela sai da lista de sugestões desta oportunidade.</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Conta</label>
          <select className="input" value={accountId} onChange={(e) => { setAccountId(e.target.value); setOpportunityId(''); setContactId('') }} disabled={Boolean(defaultAccountId) || Boolean(draft)}>
            <option value="">Selecione…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Oportunidade trabalhada</label>
          <select className="input" value={opportunityId} onChange={(e) => setOpportunityId(e.target.value)} disabled={!accountId}>
            <option value="">Conta toda (custo rateado)</option>
            {accountServices.map((o) => (
              <option key={o.id} value={o.id}>{o.service?.name || o.service_id}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Contato (opcional)</label>
          <select className="input" value={contactId} onChange={(e) => setContactId(e.target.value)} disabled={!accountId}>
            <option value="">Toda a conta / não especificar</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Sem nome'}{c.role ? ` — ${c.role}` : ''}{c.is_primary ? ' (principal)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Almoço com o sponsor" />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
            {Object.entries(TASK_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(TASK_STATUS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Data</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descrição</label>
          <textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {/* ── Custo da ação (oculto para o perfil Vendas) ── */}
        <div className={`sm:col-span-2 rounded-lg border border-ink-200 p-3 ${showCosts ? '' : 'hidden'}`}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink-900"><Clock size={14} className="text-brand-500" /> Quem trabalha nesta ação</h3>
            <button className="btn-outline py-1 text-xs" onClick={addHours} disabled={!resources.length}><Plus size={14} /> Pessoa</button>
          </div>
          {!resources.length && (
            <p className="text-xs text-amber-700">Cadastre os recursos e o custo hora-homem em Configurações → Custo de venda.</p>
          )}
          <div className="space-y-2">
            {(hoursRows || []).map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <select className="input col-span-6 py-1.5" value={r.resource_id}
                  onChange={(e) => setRow(setHoursRows, i, { resource_id: e.target.value, hourly_cost: resourceHourly(resById.get(e.target.value)) })}>
                  {resources.map((x) => <option key={x.id} value={x.id}>{x.name}{x.role ? ` · ${x.role}` : ''}</option>)}
                </select>
                <input type="number" min="0" step="0.25" className="input col-span-2 py-1.5 text-right" value={r.hours ?? ''}
                  onChange={(e) => setRow(setHoursRows, i, { hours: e.target.value })} title="Horas" />
                <span className="col-span-3 text-right text-xs text-ink-500">
                  × {formatBRL(r.hourly_cost)}/h = <b className="text-ink-800">{formatBRL(entryAmount({ kind: 'hours', ...r }))}</b>
                </span>
                <button className="col-span-1 justify-self-end rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                  onClick={() => setHoursRows((rows) => rows.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className="mb-2 mt-4 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink-900"><Receipt size={14} className="text-brand-500" /> Despesas</h3>
            <button className="btn-outline py-1 text-xs" onClick={addExpense}><Plus size={14} /> Despesa</button>
          </div>
          <div className="space-y-2">
            {(expenseRows || []).map((r, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2">
                <select className="input col-span-4 py-1.5" value={r.category_id}
                  onChange={(e) => setRow(setExpenseRows, i, { category_id: e.target.value, unit_cost: catById.get(e.target.value)?.default_cost ?? r.unit_cost })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
                <input type="number" min="0" className="input col-span-2 py-1.5 text-right" value={r.quantity ?? ''} title={`Quantidade (${catById.get(r.category_id)?.unit || 'un.'})`}
                  onChange={(e) => setRow(setExpenseRows, i, { quantity: e.target.value })} />
                <input type="number" min="0" className="input col-span-2 py-1.5 text-right" value={r.unit_cost ?? ''} title="Custo unitário (R$)"
                  onChange={(e) => setRow(setExpenseRows, i, { unit_cost: e.target.value })} />
                <input className="input col-span-3 py-1.5" placeholder="Detalhe" value={r.description || ''}
                  onChange={(e) => setRow(setExpenseRows, i, { description: e.target.value })} />
                <button className="col-span-1 justify-self-end rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                  onClick={() => setExpenseRows((rows) => rows.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button>
              </div>
            ))}
            {(expenseRows || []).length > 0 && <p className="text-[11px] text-ink-400">Quantidade × custo unitário. O custo sugerido vem da tabela de Configurações.</p>}
          </div>
          <div className="mt-3 flex justify-end gap-4 border-t border-ink-100 pt-2 text-xs text-ink-500">
            <span>Horas: <b className="text-ink-800">{formatBRL(costPreview.h)}</b></span>
            <span>Despesas: <b className="text-ink-800">{formatBRL(costPreview.e)}</b></span>
            <span>Total: <b className="text-ink-900">{formatBRL(costPreview.total)}</b></span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Oportunidades (serviços de interesse da conta)</label>
          <p className="mb-2 text-xs text-ink-500">
            Marque os serviços que interessam a esta conta. Cada um vira uma oportunidade no pipeline.
          </p>
          <div className="max-h-48 space-y-2 overflow-auto rounded-lg border border-ink-200 p-2">
            {groupByPillar(services).map((g) => (
              <div key={g.id}>
                <div className="eyebrow px-2 pb-1">{g.label}</div>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {g.items.map((s) => (
                    <label key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-ink-50">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-ink-300 text-brand-500"
                        checked={serviceIds.includes(s.id) || alreadyInterest.has(s.id)}
                        onChange={() => toggleService(s.id)}
                      />
                      <span className="flex-1">{s.name}</span>
                      {s.anchor && <span className="chip bg-amber-100 text-amber-700">âncora</span>}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function groupByPillar(services) {
  const m = new Map()
  services.forEach((s) => {
    if (!m.has(s.macro_id)) m.set(s.macro_id, { id: s.macro_id, label: s.macro_label, items: [] })
    m.get(s.macro_id).items.push(s)
  })
  return [...m.values()]
}
