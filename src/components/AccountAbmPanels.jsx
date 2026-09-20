import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Gauge, Radio, History, Building2, Briefcase, GitBranch, CalendarCheck, MessageSquare, Mail, PenLine, Target,
} from 'lucide-react'
import Modal from './Modal'
import InfoTip from './InfoTip'
import { updateAccount } from '../lib/data'
import { committeeRoles } from '../lib/abm'
import { ICP_DIMENSIONS, ICP_BLOCKERS, INTENT_SIGNALS, SIGNAL_LABEL, icpTotal, icpBand, CAMPAIGNS, journeyForStage } from '../data/abmContext'
import { ABM_THEORY } from '../data/abmPlaybook'
import { ABM_TIERS } from '../lib/constants'
import { buildTimeline, timelineSummary, TIMELINE_TYPES } from '../lib/timeline'

const ICON = { Building2, Briefcase, GitBranch, CalendarCheck, MessageSquare, Mail, PenLine }

// ── Pontuação da conta ideal (ICP) ──────────────────────────────
export function IcpPanel({ account }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const total = icpTotal(account.icp_scores)
  const band = icpBand(total, account.icp_blockers || [])
  const scored = Object.keys(account.icp_scores || {}).length > 0

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <Gauge size={16} className="text-brand-500" /> Pontuação da conta (ICP)
          <InfoTip>Sete dimensões com pesos diferentes, somando 100. De 80 pontos é conta de nível 1; de 65 a 79, nível 2; de 50 a 64, relacionamento. Bloqueadores tiram a conta da operação ativa, qualquer que seja a nota.</InfoTip>
        </h2>
        <button className="btn-ghost text-xs" onClick={() => setOpen(true)}>{scored ? 'Editar' : 'Pontuar'}</button>
      </div>

      {scored ? (
        <>
          <div className="flex items-end gap-3">
            <span className="font-display text-3xl text-ink-900">{total}</span>
            <span className="pb-1 text-xs text-ink-500">de 100</span>
            <span className={`chip ml-auto ${band.color}`}>{band.label}</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {ICP_DIMENSIONS.map((d) => {
              const v = Math.min(Number(account.icp_scores?.[d.id]) || 0, d.weight)
              return (
                <div key={d.id} className="flex items-center gap-2 text-xs">
                  <span className="w-44 shrink-0 text-ink-600">{d.label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(v / d.weight) * 100}%` }} />
                  </div>
                  <span className="w-12 text-right font-mono text-ink-500">{v}/{d.weight}</span>
                </div>
              )
            })}
          </div>
          {(account.icp_blockers || []).length > 0 && (
            <div className="mt-3 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700">
              <b>Bloqueadores:</b> {account.icp_blockers.join(' · ')}
            </div>
          )}
          {band.tier && band.tier !== account.abm_tier && (
            <p className="mt-2 text-xs text-amber-700">
              A pontuação sugere <b>{ABM_TIERS[band.tier]?.label}</b> e a conta está como {ABM_TIERS[account.abm_tier]?.label || 'sem nível'}.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-400">Conta ainda não pontuada. A pontuação define o nível ABM e a ordem de prioridade.</p>
      )}

      {open && <IcpModal account={account} onClose={(saved) => { setOpen(false); if (saved) qc.invalidateQueries({ queryKey: ['account', account.id] }) }} />}
    </div>
  )
}

function IcpModal({ account, onClose }) {
  const [scores, setScores] = useState(() =>
    Object.fromEntries(ICP_DIMENSIONS.map((d) => [d.id, Number(account.icp_scores?.[d.id]) || 0])),
  )
  const [blockers, setBlockers] = useState(account.icp_blockers || [])
  const [applyTier, setApplyTier] = useState(true)
  const [busy, setBusy] = useState(false)
  const total = icpTotal(scores)
  const band = icpBand(total, blockers)

  async function save() {
    setBusy(true)
    try {
      const patch = { icp_scores: scores, icp_blockers: blockers }
      if (applyTier && band.tier) patch.abm_tier = band.tier
      await updateAccount(account.id, patch)
      onClose(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title={`Pontuação ICP — ${account.name}`} onClose={() => onClose(false)}
      footer={<>
        <span className="mr-auto text-sm text-ink-600">Total: <b className="text-ink-900">{total}</b> · <span className={`chip ${band.color}`}>{band.label}</span></span>
        <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar pontuação'}</button>
      </>}>
      <div className="space-y-4">
        {ICP_DIMENSIONS.map((d) => (
          <div key={d.id}>
            <div className="flex items-baseline justify-between gap-2">
              <label className="text-sm font-semibold text-ink-900">{d.label}</label>
              <span className="font-mono text-xs text-ink-500">{scores[d.id]} / {d.weight}</span>
            </div>
            <p className="mb-1 text-xs text-ink-500">{d.what}</p>
            <input type="range" min="0" max={d.weight} value={scores[d.id]} className="w-full accent-brand-500"
              onChange={(e) => setScores((s) => ({ ...s, [d.id]: Number(e.target.value) }))} />
          </div>
        ))}

        <div className="rounded-lg border border-ink-200 p-3">
          <h3 className="mb-2 text-sm font-bold text-ink-900">Bloqueadores</h3>
          <p className="mb-2 text-xs text-ink-500">Marcado qualquer item, a conta sai da operação ativa independentemente da nota.</p>
          <div className="space-y-1.5">
            {ICP_BLOCKERS.map((b) => (
              <label key={b} className="flex items-start gap-2 text-sm text-ink-700">
                <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-ink-300" checked={blockers.includes(b)}
                  onChange={(e) => setBlockers((prev) => (e.target.checked ? [...prev, b] : prev.filter((x) => x !== b)))} />
                {b}
              </label>
            ))}
          </div>
        </div>

        {band.tier && (
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" className="h-4 w-4 rounded border-ink-300" checked={applyTier} onChange={(e) => setApplyTier(e.target.checked)} />
            Atualizar o nível ABM da conta para <b>{ABM_TIERS[band.tier]?.label}</b>
          </label>
        )}
      </div>
    </Modal>
  )
}

// ── Sinais de intenção, hipótese e grupo decisor ────────────────
export function SignalsPanel({ account, strategy, onEditStrategy }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const signals = account.signals || []
  const committee = useMemo(() => committeeRoles(account), [account])
  const campaign = CAMPAIGNS[account.campaign]

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <Radio size={16} className="text-brand-500" /> Sinais, hipótese e grupo decisor
          <InfoTip>O ABM é ativado por acontecimentos. O sinal gera uma hipótese sobre o que está acontecendo e qual indicador é afetado — não uma apresentação comercial.</InfoTip>
        </h2>
        <button className="btn-ghost text-xs" onClick={() => setOpen(true)}>Editar sinais</button>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <div className="eyebrow mb-1">Sinais ativos ({signals.length})</div>
          {signals.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {signals.map((s) => <li key={s} className="chip bg-amber-100 text-amber-800">{SIGNAL_LABEL[s] || s}</li>)}
            </ul>
          ) : <p className="text-ink-400">Nenhum sinal registrado.</p>}
          {account.signal_notes && <p className="mt-1.5 text-xs text-ink-600">{account.signal_notes}</p>}
        </div>

        <div>
          <div className="eyebrow mb-1">Hipótese de valor</div>
          {strategy?.hypothesis ? (
            <>
              <p className="whitespace-pre-wrap text-ink-700">{strategy.hypothesis}</p>
              {strategy.affected_indicator && <p className="mt-1 text-xs text-ink-500">Indicador afetado: <b>{strategy.affected_indicator}</b></p>}
            </>
          ) : (
            <button className="text-xs text-brand-600 hover:underline" onClick={onEditStrategy}>
              Documentar a hipótese na estratégia da conta
            </button>
          )}
        </div>

        {campaign && (
          <div>
            <div className="eyebrow mb-1">Campanha</div>
            <p className="text-ink-700">{campaign.label}</p>
            <p className="text-xs text-ink-500">{campaign.thesis} · Entrada: {campaign.entry}</p>
          </div>
        )}

        <div>
          <div className="eyebrow mb-1">Grupo decisor</div>
          <div className="flex flex-wrap gap-1.5">
            {committee.covered.map((r) => (
              <span key={r} className="chip bg-accent-100 text-accent-800" title={ABM_THEORY.buyingCommittee[r]}>{roleLabel(r)}</span>
            ))}
            {committee.missing.map((r) => (
              <span key={r} className="chip border border-dashed border-ink-300 bg-white text-ink-500" title={ABM_THEORY.buyingCommittee[r]}>{roleLabel(r)}</span>
            ))}
          </div>
          <p className={`mt-1.5 text-xs ${committee.developed ? 'text-accent-700' : 'text-amber-700'}`}>
            {committee.developed
              ? 'Conta desenvolvida: há patrocinador econômico, responsável operacional e aprovador técnico ou de risco.'
              : ABM_THEORY.minimumCoverage}
          </p>
        </div>
      </div>

      {open && <SignalsModal account={account} onClose={(saved) => { setOpen(false); if (saved) qc.invalidateQueries({ queryKey: ['account', account.id] }) }} />}
    </div>
  )
}

const ROLE_LABELS = {
  sponsor: 'Patrocinador econômico', campeao: 'Operações (campeão)', pessoas: 'Pessoas / RH',
  inovacao: 'Inovação / produto', influenciador: 'TI / dados / segurança', financeiro: 'CFO / finanças',
  bloqueador: 'Jurídico / compras', usuario: 'Usuários',
}
const roleLabel = (r) => ROLE_LABELS[r] || r

function SignalsModal({ account, onClose }) {
  const [signals, setSignals] = useState(account.signals || [])
  const [notes, setNotes] = useState(account.signal_notes || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await updateAccount(account.id, { signals, signal_notes: notes.trim() || null })
      onClose(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal wide title={`Sinais de intenção — ${account.name}`} onClose={() => onClose(false)}
      footer={<>
        <button className="btn-ghost" onClick={() => onClose(false)}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <p className="mb-3 text-sm text-ink-600">
        Marque o que foi observado na conta. Sinal ativo aumenta a prioridade no Radar e libera a jogada de abordagem por sinal.
      </p>
      <div className="space-y-1.5">
        {INTENT_SIGNALS.map((s) => (
          <label key={s.id} className="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm text-ink-700 hover:bg-ink-50">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-ink-300" checked={signals.includes(s.id)}
              onChange={(e) => setSignals((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id)))} />
            {s.label}
          </label>
        ))}
      </div>
      <div className="mt-3">
        <label className="label">Onde o sinal foi observado</label>
        <textarea className="input min-h-[70px]" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="Ex.: comunicado de aquisição em jul/2026 e três vagas abertas para dados." />
      </div>
    </Modal>
  )
}

// ── Timeline de relacionamento ──────────────────────────────────
export function TimelinePanel({ account, tasks, interactions, emails, opportunities, contents, onOpenTask }) {
  const [filter, setFilter] = useState('')
  const items = useMemo(
    () => buildTimeline({ account, tasks, interactions, emails, opportunities, contents }),
    [account, tasks, interactions, emails, opportunities, contents],
  )
  const summary = useMemo(() => timelineSummary(items), [items])
  const list = filter ? items.filter((i) => i.type === filter) : items
  const journey = opportunities.flatMap((o) => journeyForStage(o.stage).map((j) => j.label))

  return (
    <div className="card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <History size={16} className="text-brand-500" /> Timeline de relacionamento
          <InfoTip>Todos os toques da conta em ordem: ações ABM, interações registradas, e-mails da mensageria, movimentos do funil e conteúdo produzido.</InfoTip>
        </h2>
        <span className="text-xs text-ink-500">
          {summary.touches} toque(s) realizados{summary.upcoming ? ` · ${summary.upcoming} agendado(s)` : ''}
          {summary.lastTouchAt ? ` · último em ${new Date(summary.lastTouchAt).toLocaleDateString('pt-BR')}` : ''}
        </span>
      </div>

      {journey.length > 0 && (
        <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
          <Target size={13} className="text-ink-400" /> Movimento da jornada: {[...new Set(journey)].join(' · ')}
        </p>
      )}

      <div className="mb-3 flex flex-wrap gap-1.5">
        <button onClick={() => setFilter('')} className={`chip ${!filter ? 'bg-ink-900 text-white' : 'bg-ink-100 text-ink-600'}`}>Tudo ({items.length})</button>
        {Object.entries(TIMELINE_TYPES).map(([k, v]) => (
          summary.byType[k] > 0 && (
            <button key={k} onClick={() => setFilter(k)} className={`chip ${filter === k ? 'bg-ink-900 text-white' : v.color}`}>
              {v.label} ({summary.byType[k]})
            </button>
          )
        ))}
      </div>

      <ol className="relative space-y-3 border-l border-ink-200 pl-4">
        {list.map((i) => {
          const cfg = TIMELINE_TYPES[i.type]
          const Icon = ICON[cfg.icon] || CalendarCheck
          return (
            <li key={i.id} className="relative">
              <span className={`absolute -left-[26px] grid h-5 w-5 place-items-center rounded-full ${cfg.color}`}>
                <Icon size={11} />
              </span>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-xs font-mono text-ink-400">{new Date(i.at).toLocaleDateString('pt-BR')}</span>
                {i.future && <span className="chip bg-sky-100 text-sky-700">agendado</span>}
                {i.badge && <span className="text-[11px] text-ink-500">{i.badge}</span>}
              </div>
              {i.taskId && onOpenTask ? (
                <button className="text-left text-sm font-medium text-ink-900 hover:text-brand-600" onClick={() => onOpenTask(i.taskId)}>{i.title}</button>
              ) : (
                <div className="text-sm text-ink-900">{i.title}</div>
              )}
              {i.detail && <div className="text-xs text-ink-500">{i.detail}</div>}
            </li>
          )
        })}
        {list.length === 0 && <li className="text-sm text-ink-400">Nenhum registro ainda.</li>}
      </ol>
    </div>
  )
}
