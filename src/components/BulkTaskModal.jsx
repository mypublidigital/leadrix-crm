import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import Modal from './Modal'
import { createTask } from '../lib/data'
import { TASK_TYPES } from '../lib/constants'

// Cria a MESMA ação de ABM para um conjunto de contas selecionadas
// (ex.: convite de jantar, brinde por diretoria).
export default function BulkTaskModal({ accountIds, onClose }) {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [taskType, setTaskType] = useState('encontro')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)

  async function run() {
    if (!title) return
    setBusy(true)
    try {
      let n = 0
      for (const id of accountIds) {
        await createTask({
          account_id: id, contact_id: null, title, task_type: taskType,
          scheduled_date: date, status: 'planejada', description: description || null, service_ids: [],
        })
        setDone(++n)
      }
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      onClose(true)
    } finally { setBusy(false) }
  }

  return (
    <Modal
      title={<span className="flex items-center gap-2"><Users size={16} /> Ação ABM em massa</span>}
      onClose={() => onClose(false)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
        <button className="btn-primary" onClick={run} disabled={busy || !title}>
          {busy ? `Criando… (${done}/${accountIds.length})` : `Criar para ${accountIds.length} contas`}
        </button>
      </>}>
      <p className="mb-4 rounded-lg bg-brand-50 p-3 text-xs text-ink-600">
        A mesma tarefa será criada para as <b>{accountIds.length}</b> contas selecionadas.
      </p>
      <div className="space-y-3">
        <div>
          <label className="label">Título da ação</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Convite jantar de fim de ano" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={taskType} onChange={(e) => setTaskType(e.target.value)}>
              {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data</label>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Descrição (opcional)</label>
          <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
