import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TrendingUp, Trophy, Wallet, CheckCircle2, ExternalLink, GripVertical, CalendarClock, Clock } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import OpportunityModal from '../components/OpportunityModal'
import { ThermometerBadge } from '../components/Badge'
import SegmentFilters, { oppMatches, PillarBadge } from '../components/SegmentFilters'
import { opportunityAgingState } from '../lib/abm'
import { useSalesCost } from '../lib/hooks'
import { triggerEmailEvent } from '../lib/messaging'
import {
  listAccounts, listAllAccountServices, listLostReasons, listRoster,
  moveOpportunityStage, closeAndHandoff,
} from '../lib/data'
import { pipelineByStage, daysSince } from '../lib/finance'
import {
  CRM_STAGES, KANBAN_STAGES, SEGMENTS, ACCOUNT_SIZES, BILLING_MODELS, formatBRL,
} from '../lib/constants'

// ── Modal de handoff (Fechar oportunidade) ──────────────────────
function HandoffModal({ opportunity, account, onClose }) {
  const qc = useQueryClient()
  const [managerEmail, setManagerEmail] = useState('')
  const [billing, setBilling] = useState('milestone')
  const [contractValue, setContractValue] = useState(opportunity.estimated_value_brl || 0)
  const [segment, setSegment] = useState(account?.segment || '')
  const [size, setSize] = useState(account?.account_size || '')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  // `fired` diz ao pai se a oportunidade foi realmente fechada — cancelar o
  // modal não deve disparar o e-mail de fechamento.
  const fired = Boolean(result)

  async function fire() {
    setBusy(true)
    try {
      await moveOpportunityStage(opportunity.id, 'fechado', { commercial_temp: 100 })
      const r = await closeAndHandoff(account.id, {
        name: `${opportunity.service?.name || 'Projeto'} — ${account.name}`,
        contract_value_brl: Number(contractValue),
        billing_model: billing, manager_email: managerEmail, segment, size,
      })
      qc.invalidateQueries({ queryKey: ['accounts'] })
      qc.invalidateQueries({ queryKey: ['all-account-services'] })
      setResult(r)
    } finally { setBusy(false) }
  }

  if (result) {
    return (
      <Modal title="Oportunidade fechada" onClose={() => onClose(true)} footer={<button className="btn-primary" onClick={() => onClose(true)}>Fechar</button>}>
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-sm text-ink-700">Oportunidade fechada {result.simulated && '(handoff simulado em modo demo)'}.</p>
          {result.project_url && (
            <a href={result.project_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:underline">
              <ExternalLink size={14} /> Abrir projeto
            </a>
          )}
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={`Fechar — ${opportunity.service?.name || ''} · ${account?.name || ''}`} onClose={() => onClose(fired)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(fired)}>Cancelar</button>
        <button className="btn-primary" onClick={fire} disabled={busy || !managerEmail}>{busy ? 'Enviando…' : 'Fechar e disparar handoff'}</button>
      </>}>
      <p className="mb-4 rounded-lg bg-brand-50 p-3 text-xs text-ink-600">
        A oportunidade vai para <b>Fechado (100%)</b>. Se houver um sistema de projetos configurado, o CRM envia o projeto
        (HMAC); sem ele, o envio fica registrado como pendente.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Responsável pela entrega na Leadrix (e-mail) *</label>
          <input className="input" placeholder="nome@leadrix.com.br" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} />
        </div>
        <div><label className="label">Segmento</label>
          <select className="input" value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option value="">—</option>{Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label className="label">Porte</label>
          <select className="input" value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">—</option>{Object.entries(ACCOUNT_SIZES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><label className="label">Valor do contrato</label>
          <input type="number" className="input" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /></div>
        <div><label className="label">Modelo de cobrança</label>
          <select className="input" value={billing} onChange={(e) => setBilling(e.target.value)}>
            {Object.entries(BILLING_MODELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>
    </Modal>
  )
}

// ── Stand by (data de revisão obrigatória) ──────────────────────
function StandbyModal({ opportunity, label, onClose, onDone }) {
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!date) return
    setBusy(true)
    try { await moveOpportunityStage(opportunity.id, 'standby', { standby_review_date: date }); onDone() } finally { setBusy(false) }
  }
  return (
    <Modal title={`Stand by — ${label}`} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy || !date}>Mover para Stand by</button></>}>
      <p className="mb-3 text-sm text-ink-600">Pausa a oportunidade com uma <b>data obrigatória de revisão</b>.</p>
      <label className="label">Data de revisão *</label>
      <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
    </Modal>
  )
}

// ── Perdido (motivo obrigatório) ────────────────────────────────
function LostModal({ opportunity, label, onClose, onDone }) {
  const { data: reasons = [] } = useQuery({ queryKey: ['lost-reasons'], queryFn: listLostReasons })
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!reason) return
    setBusy(true)
    try { await moveOpportunityStage(opportunity.id, 'perdido', { lost_reason: reason, commercial_temp: 0 }); onDone() } finally { setBusy(false) }
  }
  return (
    <Modal title={`Perdido — ${label}`} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy || !reason}>Confirmar perda</button></>}>
      <p className="mb-3 text-sm text-ink-600">É <b>obrigatório</b> informar o motivo de não-venda (lista editável em Configurações).</p>
      <label className="label">Motivo de não-venda *</label>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
        <option value="">Selecione…</option>
        {reasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
      </select>
    </Modal>
  )
}

function initials(nameOrEmail) {
  if (!nameOrEmail) return null
  const parts = String(nameOrEmail).split('@')[0].split(/[\s._-]+/).filter(Boolean)
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('')
}

export default function Pipeline() {
  const qc = useQueryClient()
  const { data: accounts = [] } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const { data: allOpportunities = [] } = useQuery({ queryKey: ['all-account-services'], queryFn: listAllAccountServices })
  const { data: roster = [] } = useQuery({ queryKey: ['roster'], queryFn: listRoster })
  const { data: settings } = useSalesCost()
  const [seg, setSeg] = useState({ segment: '', micro: '', pillar: '' })

  const [refDate, setRefDate] = useState(new Date().toISOString().slice(0, 10))
  const [handoff, setHandoff] = useState(null)
  const [standby, setStandby] = useState(null)
  const [lost, setLost] = useState(null)
  const [detail, setDetail] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [overStage, setOverStage] = useState(null)

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts])
  const rosterById = useMemo(() => new Map(roster.map((u) => [u.id, u])), [roster])
  const opportunities = useMemo(
    () => allOpportunities.filter((o) => oppMatches(o, accountById.get(o.account_id), seg)),
    [allOpportunities, accountById, seg],
  )

  const { stages, totals } = useMemo(() => pipelineByStage(opportunities), [opportunities])
  const maxPotential = Math.max(1, ...stages.map((s) => s.potential))

  const oppLabel = (o) => `${o.service?.name || o.service_id} · ${accountById.get(o.account_id)?.name || ''}`

  // Mudança de etapa é um evento da mensageria: se houver modelo para a etapa,
  // a mensagem entra na fila (automático) ou como rascunho para revisão.
  async function notifyStage(opp, toStage) {
    await triggerEmailEvent(`etapa_${toStage}`, {
      account: accountById.get(opp.account_id),
      opportunity: opp,
    })
    qc.invalidateQueries({ queryKey: ['email-messages'] })
  }

  async function applyStage(opp, toStage) {
    if (toStage === opp.stage) return
    if (toStage === 'fechado') return setHandoff({ opportunity: opp, account: accountById.get(opp.account_id) })
    if (toStage === 'standby') return setStandby({ opportunity: opp })
    if (toStage === 'perdido') return setLost({ opportunity: opp })
    await moveOpportunityStage(opp.id, toStage)
    await notifyStage(opp, toStage)
    qc.invalidateQueries({ queryKey: ['all-account-services'] })
  }

  function onDrop(stage) {
    const opp = opportunities.find((o) => o.id === dragId)
    setDragId(null); setOverStage(null)
    if (opp) applyStage(opp, stage)
  }

  const refreshOpps = () => qc.invalidateQueries({ queryKey: ['all-account-services'] })

  return (
    <>
      <PageHeader title="Pipeline / Oportunidades" subtitle="Cada card é uma oportunidade — com termômetro, dono e aging próprios. Arraste entre etapas." />

      <div className="space-y-5 p-6">
        {/* Data de referência */}
        <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
          <SegmentFilters value={seg} onChange={setSeg} />
        </div>
        <div className="card flex flex-wrap items-center gap-4 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <CalendarClock size={16} className="text-brand-500" /> Data de referência
            <input type="date" className="input w-auto py-1.5" value={refDate} onChange={(e) => setRefDate(e.target.value)} />
          </label>
          <span className="text-sm text-ink-500">
            <b className="text-ink-800">{totals.openCount}</b> oportunidade(s) em aberto · <b className="text-ink-800">{totals.wonCount}</b> fechada(s)
          </span>
        </div>

        {/* Resumo financeiro */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-500"><Wallet size={20} /></div>
            <div><div className="truncate text-xl font-extrabold text-ink-900">{formatBRL(totals.totalPotential)}</div>
              <div className="text-xs text-ink-500">Potencial total no funil</div></div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-50 text-amber-500"><TrendingUp size={20} /></div>
            <div><div className="truncate text-xl font-extrabold text-ink-900">{formatBRL(totals.openForecast)}</div>
              <div className="text-xs text-ink-500">Previsão ponderada (em aberto)</div></div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent-50 text-accent-600"><Trophy size={20} /></div>
            <div><div className="truncate text-xl font-extrabold text-ink-900">{formatBRL(totals.won)}</div>
              <div className="text-xs text-ink-500">Fechado (ganho)</div></div>
          </div>
        </div>

        {/* Previsão por etapa */}
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-bold text-ink-900">Previsão de faturamento por etapa do ABM</h2>
          <div className="space-y-3">
            {stages.filter((s) => s.stage !== 'perdido').map((s) => (
              <div key={s.stage} className="flex items-center gap-3">
                <div className="flex w-28 shrink-0 items-center gap-2"><span className={`chip ${CRM_STAGES[s.stage].color}`}>{s.label}</span></div>
                <div className="w-14 shrink-0 text-right text-xs font-semibold text-ink-500">{Math.round(s.probability * 100)}%</div>
                <div className="relative h-7 flex-1 overflow-hidden rounded-md bg-ink-100">
                  <div className="absolute inset-y-0 left-0 rounded-md bg-brand-100" style={{ width: `${(s.potential / maxPotential) * 100}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-md bg-brand-500" style={{ width: `${(s.forecast / maxPotential) * 100}%` }} />
                  <div className="absolute inset-0 flex items-center justify-end px-2 text-xs font-medium text-ink-600">
                    {formatBRL(s.forecast)} <span className="ml-1 text-ink-400">/ {formatBRL(s.potential)}</span>
                  </div>
                </div>
                <div className="w-24 shrink-0 text-right text-xs text-ink-500">{s.count} oportunidade(s)</div>
              </div>
            ))}
          </div>
        </div>

        {/* Kanban de oportunidades */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-7">
          {KANBAN_STAGES.map((stage) => {
            const col = stages.find((s) => s.stage === stage)
            return (
              <div key={stage}
                onDragOver={(e) => { e.preventDefault(); setOverStage(stage) }}
                onDragLeave={() => setOverStage((s) => (s === stage ? null : s))}
                onDrop={() => onDrop(stage)}
                className={`flex flex-col rounded-xl p-2 transition-colors ${overStage === stage ? 'bg-accent-100' : 'bg-ink-100/60'}`}>
                <div className="flex items-center justify-between px-1 py-1.5">
                  <span className={`chip ${CRM_STAGES[stage].color}`}>{CRM_STAGES[stage].label}</span>
                  <span className="text-xs font-semibold text-ink-500">{col?.count || 0}</span>
                </div>
                <div className="px-1 pb-1 text-xs font-medium text-ink-500">{formatBRL(col?.potential || 0)}</div>
                <div className="space-y-2">
                  {(col?.opportunities || []).map((o) => {
                    const acc = accountById.get(o.account_id)
                    const owner = o.owner_id ? rosterById.get(o.owner_id) : null
                    const dStage = daysSince(o.stage_entered_at || o.created_at)
                    const ag = ['fechado', 'perdido'].includes(stage) ? null : opportunityAgingState(o, settings)
                    return (
                      <div key={o.id} draggable
                        onDragStart={() => setDragId(o.id)}
                        onDragEnd={() => { setDragId(null); setOverStage(null) }}
                        onClick={() => setDetail(o)}
                        className={`card cursor-pointer p-2.5 ${dragId === o.id ? 'opacity-40' : ''}`}>
                        <div className="flex items-start gap-1.5">
                          <GripVertical size={14} className="mt-0.5 shrink-0 text-ink-300" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold text-ink-900">{acc?.name || '—'}</div>
                            <div className="truncate text-xs text-ink-500">{o.service?.name || o.service_id}</div>
                            {o.service?.macro_id && <div className="mt-1"><PillarBadge id={o.service.macro_id} /></div>}
                            <div className="mt-1 text-sm font-bold text-brand-500">{formatBRL(o.estimated_value_brl)}</div>
                            <div className="mt-1 flex items-center justify-between gap-1">
                              <ThermometerBadge value={o.commercial_temp} />
                              {owner && (
                                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-600"
                                  title={owner.full_name || owner.email}>
                                  {initials(owner.full_name || owner.email)}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-500">
                              <Clock size={10} /> {dStage ?? 0} d na etapa
                              {ag && ag.level.key !== 'no_prazo' && <span className={`chip px-1.5 py-0 text-[10px] ${ag.level.color}`}>{ag.level.label}</span>}
                            </div>
                            {stage === 'standby' && o.standby_review_date && (
                              <div className="text-[11px] text-violet-600">revisar {o.standby_review_date}</div>
                            )}
                            {stage === 'perdido' && o.lost_reason && (
                              <div className="truncate text-[11px] text-rose-500">{o.lost_reason}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {(col?.opportunities || []).length === 0 && (
                    <div className="rounded-lg border border-dashed border-ink-300 p-3 text-center text-xs text-ink-400">arraste aqui</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-center text-xs text-ink-400">Arraste um card para mudar de etapa (o histórico de aging é registrado), ou clique para ver o detalhe.</p>
      </div>

      {handoff && (
        <HandoffModal
          opportunity={handoff.opportunity}
          account={handoff.account}
          onClose={async (fired) => { if (fired) await notifyStage(handoff.opportunity, 'fechado'); setHandoff(null); refreshOpps() }}
        />
      )}
      {standby && <StandbyModal opportunity={standby.opportunity} label={oppLabel(standby.opportunity)} onClose={() => setStandby(null)}
        onDone={async () => { await notifyStage(standby.opportunity, 'standby'); setStandby(null); refreshOpps() }} />}
      {lost && <LostModal opportunity={lost.opportunity} label={oppLabel(lost.opportunity)} onClose={() => setLost(null)}
        onDone={async () => { await notifyStage(lost.opportunity, 'perdido'); setLost(null); refreshOpps() }} />}
      {detail && <OpportunityModal opportunity={detail} onClose={() => { setDetail(null); refreshOpps() }} />}
    </>
  )
}
