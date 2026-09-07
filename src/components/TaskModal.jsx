import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from './Modal'
import { TASK_TYPES, TASK_STATUS } from '../lib/constants'
import {
  listAccounts,
  listServices,
  createTask,
  updateTask,
  addAccountService,
  listAccountServices,
} from '../lib/data'

// Modal de criar/editar tarefa de ABM. Inclui a seleção dos SERVIÇOS DE
// INTERESSE do lead (briefing: ao atualizar ações ABM, marca-se os serviços),
// que passam a alimentar a previsão de faturamento.
export default function TaskModal({ task, defaultAccountId, onClose }) {
  const qc = useQueryClient()
  const isEdit = Boolean(task?.id)

  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: listServices })

  const [accountId, setAccountId] = useState(task?.account_id || defaultAccountId || '')
  const [contactId, setContactId] = useState(task?.contact_id || '')
  const [title, setTitle] = useState(task?.title || '')
  const [taskType, setTaskType] = useState(task?.task_type || 'ligacao')
  const [date, setDate] = useState(task?.scheduled_date || new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState(task?.status || 'planejada')
  const [description, setDescription] = useState(task?.description || '')

  // Contatos da conta selecionada (para direcionar a ação a uma pessoa específica).
  const account = accounts.find((a) => a.id === accountId)
  const contacts = account?.contacts || []
  const [serviceIds, setServiceIds] = useState(task?.service_ids || [])
  const [saving, setSaving] = useState(false)

  // Serviços já marcados como de interesse na conta (para não duplicar).
  const { data: accountServices = [] } = useQuery({
    queryKey: ['account-services', accountId],
    queryFn: () => listAccountServices(accountId),
    enabled: Boolean(accountId),
  })
  const alreadyInterest = new Set(accountServices.map((as) => as.service_id))

  function toggleService(id) {
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleSave() {
    if (!accountId || !title) return
    setSaving(true)
    try {
      const payload = {
        account_id: accountId,
        contact_id: contactId || null,
        title,
        task_type: taskType,
        scheduled_date: date,
        status,
        description: description || null,
        service_ids: serviceIds,
      }
      if (isEdit) await updateTask(task.id, payload)
      else await createTask(payload)

      // Registra os serviços marcados como interesse do lead (se ainda não estão).
      for (const sid of serviceIds) {
        if (!alreadyInterest.has(sid)) {
          const svc = services.find((s) => s.id === sid)
          await addAccountService(accountId, sid, svc?.suggested_value_brl || 0, 'interessado')
        }
      }

      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['account', accountId] })
      qc.invalidateQueries({ queryKey: ['account-services'] })
      qc.invalidateQueries({ queryKey: ['all-account-services'] })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      wide
      title={isEdit ? 'Editar tarefa de ABM' : 'Nova tarefa de ABM'}
      onClose={onClose}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving || !accountId || !title}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Conta</label>
          <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)} disabled={Boolean(defaultAccountId)}>
            <option value="">Selecione…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
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
          {accountId && contacts.length === 0 && (
            <p className="mt-1 text-xs text-ink-400">Esta conta ainda não tem contatos cadastrados.</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Título</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Ligação de qualificação" />
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
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="sm:col-span-2">
          <label className="label">Oportunidades (serviços de interesse do lead)</label>
          <p className="mb-2 text-xs text-ink-500">
            Marque os serviços que interessam a esta conta. Eles alimentam a previsão de faturamento por etapa do funil.
          </p>
          <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-auto rounded-lg border border-ink-200 p-2 sm:grid-cols-2">
            {services.map((s) => (
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
      </div>
    </Modal>
  )
}
