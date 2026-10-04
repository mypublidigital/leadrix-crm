import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Copy } from 'lucide-react'
import Modal from './Modal'
import Combobox from './Combobox'
import { createOpportunity } from '../lib/data'
import { useServices, useRoster } from '../lib/hooks'
import { CRM_STAGES, KANBAN_STAGES, THERMOMETER, THERMOMETER_LEVELS, formatBRL } from '../lib/constants'
import { PILLARS } from '../data/leadrix'

// Nova oportunidade de uma conta. Pode repetir um serviço que a conta já tem:
// a mesma empresa compra o mesmo serviço em outra unidade, outra fase ou outro
// ano — e aí a identificação é o que diferencia as duas no pipeline.
export default function OpportunityCreateModal({ account, existing = [], onClose }) {
  const qc = useQueryClient()
  const { data: services = [] } = useServices()
  const { data: roster = [] } = useRoster()

  const [f, setF] = useState({
    service_id: '', title: '', notes: '', estimated_value_brl: '',
    stage: 'lead', commercial_temp: 0, owner_id: account.owner_id || '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const options = useMemo(
    () => services.map((s) => ({
      value: s.id,
      label: s.name,
      group: PILLARS[s.macro_id]?.short || s.macro_label,
      hint: s.suggested_value_brl ? formatBRL(s.suggested_value_brl) : null,
    })),
    [services],
  )

  const servico = services.find((s) => s.id === f.service_id) || null
  const repetidas = existing.filter((o) => o.service_id === f.service_id)

  function escolherServico(id) {
    const s = services.find((x) => x.id === id)
    setF((p) => ({
      ...p,
      service_id: id,
      // Valor sugerido do catálogo entra como ponto de partida, sem apagar o
      // que a pessoa já tiver digitado.
      estimated_value_brl: p.estimated_value_brl || (s?.suggested_value_brl ?? ''),
    }))
  }

  async function save() {
    setBusy(true); setErr('')
    try {
      await createOpportunity({ ...f, account_id: account.id })
      ;['all-account-services', 'accounts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      qc.invalidateQueries({ queryKey: ['account', account.id] })
      onClose(true)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title={`Nova oportunidade — ${account.name}`} onClose={() => onClose(false)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy || !f.service_id}>
          {busy ? 'Criando…' : 'Criar oportunidade'}
        </button>
      </>}>
      {err && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={16} /> {err}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Serviço *</label>
          <Combobox value={f.service_id} options={options} onChange={escolherServico}
            placeholder="Digite para buscar no catálogo dos quatro pilares…" />
          {servico && (
            <p className="mt-1 text-xs text-ink-400">
              {servico.macro_label} · complexidade {servico.complexity_range}
              {servico.anchor ? ' · projeto âncora' : ''}
            </p>
          )}
        </div>

        {repetidas.length > 0 && (
          <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Copy size={14} className="mt-0.5 shrink-0" />
            <span>
              Esta conta já tem {repetidas.length} oportunidade(s) deste serviço
              ({repetidas.map((o) => o.title || CRM_STAGES[o.stage]?.label).join(', ')}).
              Repetir é permitido — use a identificação abaixo para diferenciar as duas no pipeline.
            </span>
          </div>
        )}

        <div>
          <label className="label">Identificação</label>
          <input className="input" value={f.title} onChange={set('title')}
            placeholder="Ex.: Unidade Sul · Fase 2 · Safra 2027" />
          <p className="mt-1 text-xs text-ink-400">Aparece ao lado do nome do serviço nas listas e no kanban.</p>
        </div>

        <div>
          <label className="label">Valor estimado (R$)</label>
          <input type="number" min="0" className="input" value={f.estimated_value_brl} onChange={set('estimated_value_brl')} />
        </div>

        <div>
          <label className="label">Etapa inicial</label>
          <select className="input" value={f.stage} onChange={set('stage')}>
            {KANBAN_STAGES.filter((k) => !['fechado', 'perdido'].includes(k))
              .map((k) => <option key={k} value={k}>{CRM_STAGES[k].label}</option>)}
          </select>
        </div>

        <div>
          <label className="label">Dono da oportunidade</label>
          <select className="input" value={f.owner_id} onChange={set('owner_id')}>
            <option value="">Sem dono definido</option>
            {roster.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
          </select>
          <p className="mt-1 text-xs text-ink-400">Cada oportunidade tem seu dono — pode ser diferente do responsável pela conta.</p>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Termômetro comercial</label>
          <div className="flex flex-wrap gap-1">
            {THERMOMETER_LEVELS.map((k) => (
              <button key={k} type="button" onClick={() => setF((p) => ({ ...p, commercial_temp: k }))}
                title={THERMOMETER[k].help}
                className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                  Number(f.commercial_temp) === k ? `${THERMOMETER[k].color} text-white` : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                }`}>
                {THERMOMETER[k].short}
              </button>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="label">Observação</label>
          <textarea className="input min-h-[80px]" value={f.notes} onChange={set('notes')}
            placeholder="O que diferencia esta oportunidade: escopo, unidade, contexto da negociação…" />
        </div>
      </div>
    </Modal>
  )
}
