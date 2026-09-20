import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, CalendarPlus, PenLine, X, Users, Clock, Target } from 'lucide-react'
import TaskTypeIcon from './TaskTypeIcon'
import TaskModal from './TaskModal'
import { ContentModal } from './ContentComposer'
import { PillarBadge } from './SegmentFilters'
import { dismissAbmPlay } from '../lib/data'
import { taskDraftFromPlay } from '../lib/abm'
import { CRM_STAGES, ABM_TIERS, TASK_TYPES, formatBRL } from '../lib/constants'
import { ABM_THEORY } from '../data/abmPlaybook'
import { useAuth } from '../lib/useAuth'

// Cartão de sugestão ABM para UMA oportunidade: contexto de aging, cobertura
// do comitê de compra e as jogadas recomendadas com custo estimado.
export default function AbmSuggestionCard({ suggestion, settings, showAccount = true, defaultOpen = false }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(defaultOpen)
  const [taskDraft, setTaskDraft] = useState(null)
  const [contentBrief, setContentBrief] = useState(null)
  const { can } = useAuth()
  const { opp, account, aging, coverage, context, plays, pillar, tier, campaign, signals, committee } = suggestion

  async function dismiss(play) {
    await dismissAbmPlay(opp.id, play.id)
    qc.invalidateQueries({ queryKey: ['abm-dismissals'] })
  }

  return (
    <div className="card overflow-hidden">
      <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-ink-50/60" onClick={() => setOpen((v) => !v)}>
        <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${aging.level.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {showAccount && <span className="font-semibold text-ink-900">{account.name}</span>}
            <span className="text-sm text-ink-600">{opp.service?.name || opp.service_id}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={`chip ${aging.level.color}`}>{aging.level.label}</span>
            <span className={`chip ${CRM_STAGES[opp.stage]?.color}`}>{CRM_STAGES[opp.stage]?.label}</span>
            {pillar && <PillarBadge id={pillar.id} />}
            <span className={`chip ${ABM_TIERS[tier]?.color}`} title={ABM_TIERS[tier]?.help}>{ABM_TIERS[tier]?.short}</span>
            <span className="text-xs text-ink-500">{context}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-ink-900">{formatBRL(opp.estimated_value_brl)}</div>
          <div className="text-[11px] text-ink-500">{plays.length} jogada(s)</div>
        </div>
        {open ? <ChevronDown size={18} className="mt-1 text-ink-400" /> : <ChevronRight size={18} className="mt-1 text-ink-400" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-ink-100 bg-ink-50/40 p-4">
          {(signals?.length > 0 || campaign) && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
              {campaign && <span className="chip bg-brand-100 text-brand-700" title={campaign.thesis}>{campaign.label}</span>}
              {(signals || []).map((s) => <span key={s} className="chip bg-amber-100 text-amber-800">sinal: {s.length > 46 ? `${s.slice(0, 46)}…` : s}</span>)}
            </div>
          )}
          {committee && !committee.developed && (
            <p className="text-xs text-amber-700">
              Conta ainda depende de poucos papéis do grupo decisor — falta patrocinador econômico, responsável operacional ou aprovador técnico/de risco.
            </p>
          )}
          {coverage.personas.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-600">
              <Users size={13} className="text-ink-400" />
              <span className="font-semibold">Comitê de compra:</span>
              {coverage.covered.map((p) => <span key={p} className="chip bg-accent-100 text-accent-800">{p}</span>)}
              {coverage.missing.map((p) => <span key={p} className="chip border border-dashed border-ink-300 bg-white text-ink-500" title="Sem contato mapeado">{p}</span>)}
              {showAccount && <Link to={`/contas/${account.id}`} className="ml-auto text-brand-600 hover:underline">Abrir conta</Link>}
            </div>
          )}

          {plays.map((p) => (
            <div key={p.id} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-ink-900 text-white"><TaskTypeIcon type={p.task_type} size={15} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-ink-900">{p.title}</div>
                  <div className="mt-0.5 text-sm text-ink-700">{p.objective}</div>
                  <details className="mt-1 text-xs text-ink-600">
                    <summary className="cursor-pointer select-none text-brand-600">Por que esta jogada (teoria ABM) e passos</summary>
                    <p className="mt-1.5">{p.why}</p>
                    {p.role && <p className="mt-1 text-ink-500">Papel no comitê: {ABM_THEORY.buyingCommittee[p.role]}</p>}
                    {p.useCase && <p className="mt-1 text-ink-500">Caso de uso do pilar neste mercado: {p.useCase}.</p>}
                    {p.nextPillar && <p className="mt-1 text-ink-500">Próximo pilar recomendado: <b>{p.nextPillar.label}</b>.</p>}
                    <ol className="mt-1.5 list-decimal space-y-0.5 pl-4">
                      {p.steps.map((s) => <li key={s}>{s}</li>)}
                    </ol>
                  </details>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1"><Target size={12} /> {p.persona || '—'}{p.contact ? ` · ${p.contact.name}` : ' · sem contato mapeado'}</span>
                    <span className="inline-flex items-center gap-1" title={can('costs.view') ? `${p.cost.hours} h × ${formatBRL(p.cost.avgHourly)}/h (média) + despesas` : undefined}>
                      <Clock size={12} /> {TASK_TYPES[p.task_type]?.label}
                      {can('costs.view')
                        ? <> · custo estimado <b className="text-ink-800">{formatBRL(p.cost.total)}</b></>
                        : <> · {p.cost.hours} h estimadas</>}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button className="btn-ghost py-1.5 text-xs" onClick={() => dismiss(p)} title="Oculta por 30 dias"><X size={14} /> Descartar</button>
                {p.content && (
                  <button className="btn-outline py-1.5 text-xs" onClick={() => setContentBrief(p.content)}><PenLine size={14} /> Gerar conteúdo</button>
                )}
                <button className="btn-primary py-1.5 text-xs" onClick={() => setTaskDraft(taskDraftFromPlay(p, suggestion, settings))}><CalendarPlus size={14} /> Criar ação</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {taskDraft && <TaskModal draft={taskDraft} onClose={() => setTaskDraft(null)} />}
      {contentBrief && <ContentModal initial={contentBrief} onClose={() => setContentBrief(null)} />}
    </div>
  )
}
