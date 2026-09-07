import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Clock, User } from 'lucide-react'
import Modal from './Modal'
import TaskTypeIcon from './TaskTypeIcon'
import { StageBadge, StatusBadge, ThermometerBadge } from './Badge'
import { getAccount, updateAccountService, listLostReasons, listRoster } from '../lib/data'
import { opportunityAging } from '../lib/finance'
import {
  PROPOSAL_LINK_FROM, THERMOMETER, THERMOMETER_LEVELS, CRM_STAGES, formatBRL,
} from '../lib/constants'

// Detalhe da OPORTUNIDADE: resumo, termômetro próprio, dono, hemograma de
// aging (dias no pipeline / na etapa / por etapa), tarefas e anotações.
export default function OpportunityModal({ opportunity, onClose }) {
  const qc = useQueryClient()
  const opp = opportunity
  const { data: a } = useQuery({ queryKey: ['account', opp.account_id], queryFn: () => getAccount(opp.account_id) })
  const { data: lostReasons = [] } = useQuery({ queryKey: ['lost-reasons'], queryFn: listLostReasons })
  const { data: roster = [] } = useQuery({ queryKey: ['roster'], queryFn: listRoster })

  const [temp, setTemp] = useState(opp.commercial_temp ?? 0)
  const [ownerId, setOwnerId] = useState(opp.owner_id || '')
  const [value, setValue] = useState(opp.estimated_value_brl ?? 0)
  const [notes, setNotes] = useState(opp.notes || '')
  const [proposalLink, setProposalLink] = useState(opp.proposal_link || '')
  const [reviewDate, setReviewDate] = useState(opp.standby_review_date || '')
  const [lostReason, setLostReason] = useState(opp.lost_reason || '')
  const [busy, setBusy] = useState(false)

  const aging = opportunityAging(opp)
  const showProposal = PROPOSAL_LINK_FROM.includes(opp.stage)
  const serviceName = opp.service?.name || opp.service_id

  async function save() {
    setBusy(true)
    try {
      await updateAccountService(opp.id, {
        commercial_temp: Number(temp),
        owner_id: ownerId || null,
        estimated_value_brl: Number(value) || 0,
        notes: notes || null,
        proposal_link: proposalLink || null,
        standby_review_date: reviewDate || null,
        lost_reason: lostReason || null,
      })
      qc.invalidateQueries({ queryKey: ['all-account-services'] })
      qc.invalidateQueries({ queryKey: ['account', opp.account_id] })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          {a?.name || '…'} · {serviceName} <StageBadge value={opp.stage} />
        </span>
      }
      footer={<>
        <Link to={`/contas/${opp.account_id}`} className="btn-ghost mr-auto">Abrir conta completa</Link>
        <button className="btn-ghost" onClick={onClose}>Fechar</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Resumo + campos da oportunidade */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-ink-900">Resumo da oportunidade</h3>
          <div className="rounded-lg bg-brand-50 p-3">
            <div className="text-xs text-ink-500">Valor estimado</div>
            <div className="flex items-center gap-2">
              <input type="number" className="input w-40 py-1 text-lg font-extrabold text-brand-500"
                value={value} onChange={(e) => setValue(e.target.value)} />
              <span className="text-xs text-ink-400">{formatBRL(value)}</span>
            </div>
          </div>

          <div>
            <label className="label">Termômetro comercial desta oportunidade</label>
            <div className="flex flex-wrap gap-1">
              {THERMOMETER_LEVELS.map((k) => (
                <button key={k} onClick={() => setTemp(k)} title={THERMOMETER[k].help}
                  className={`rounded-md px-2 py-1 text-xs font-semibold transition ${
                    Number(temp) === k ? `${THERMOMETER[k].color} text-white` : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                  }`}>
                  {THERMOMETER[k].short}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label flex items-center gap-1"><User size={12} /> Dono da oportunidade</label>
            <select className="input" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              <option value="">Sem dono definido</option>
              {roster.map((u) => (
                <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
              ))}
            </select>
          </div>

          {showProposal && (
            <div>
              <label className="label">Link da proposta comercial</label>
              <div className="flex items-center gap-2">
                <input className="input" placeholder="https://…" value={proposalLink} onChange={(e) => setProposalLink(e.target.value)} />
                {proposalLink && (
                  <a href={proposalLink} target="_blank" rel="noreferrer" className="btn-outline shrink-0"><ExternalLink size={16} /></a>
                )}
              </div>
            </div>
          )}

          {opp.stage === 'standby' && (
            <div>
              <label className="label">Data de revisão (obrigatória em Stand by)</label>
              <input type="date" className="input" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
            </div>
          )}

          {opp.stage === 'perdido' && (
            <div>
              <label className="label">Motivo de não-venda</label>
              <select className="input" value={lostReason} onChange={(e) => setLostReason(e.target.value)}>
                <option value="">Selecione…</option>
                {lostReasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="label">Anotações da negociação</label>
            <textarea className="input min-h-[90px]" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas internas sobre esta oportunidade…" />
          </div>
        </div>

        {/* Hemograma (aging) + tarefas */}
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink-900">
              <Clock size={14} className="text-brand-500" /> Aging da oportunidade
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-ink-100 p-2.5 text-center">
                <div className="text-xl font-extrabold text-ink-900">{aging.inPipeline ?? '—'}</div>
                <div className="text-xs text-ink-500">dias no pipeline</div>
              </div>
              <div className={`rounded-lg border p-2.5 text-center ${
                (aging.inStage ?? 0) > 30 ? 'border-rose-200 bg-rose-50' : 'border-ink-100'
              }`}>
                <div className={`text-xl font-extrabold ${(aging.inStage ?? 0) > 30 ? 'text-rose-600' : 'text-ink-900'}`}>
                  {aging.inStage ?? '—'}
                </div>
                <div className="text-xs text-ink-500">dias na etapa atual</div>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {aging.perStage.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`chip ${CRM_STAGES[p.stage]?.color || 'bg-ink-100 text-ink-600'}`}>
                    {CRM_STAGES[p.stage]?.label || p.stage}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div className={`h-full rounded-full ${p.closed ? 'bg-ink-300' : 'bg-brand-500'}`}
                      style={{ width: `${Math.min(100, (p.days / 60) * 100)}%` }} />
                  </div>
                  <span className="w-12 text-right font-medium text-ink-600">{p.days} d{p.closed ? '' : ' ●'}</span>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-ink-400">● = etapa atual. Histórico registrado a cada movimentação no funil.</p>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-bold text-ink-900">Ações ABM da conta</h3>
            {(a?.tasks || []).length ? (
              <ul className="max-h-48 space-y-1.5 overflow-auto">
                {a.tasks.slice().sort((x, y) => (x.scheduled_date || '').localeCompare(y.scheduled_date || '')).map((t) => (
                  <li key={t.id} className="flex items-center gap-2 rounded-lg border border-ink-100 p-2 text-sm">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-ink-100 text-ink-500"><TaskTypeIcon type={t.task_type} size={12} /></span>
                    <span className="min-w-0 flex-1 truncate">{t.title}</span>
                    <span className="text-xs text-ink-400">{t.scheduled_date}</span>
                    <StatusBadge value={t.status} />
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-400">Sem ações ABM ainda.</p>}
          </div>

          {a?.project_url && (
            <a href={a.project_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:underline">
              <ExternalLink size={14} /> Projeto no Consulcard Projetos
            </a>
          )}
        </div>
      </div>
    </Modal>
  )
}
