import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Building2, Globe, Mail, Phone, User, FileText, Target,
  CalendarRange, History, Briefcase, Plus, Trash2, Pencil, Hash, Cake,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import TaskModal from '../components/TaskModal'
import TaskTypeIcon from '../components/TaskTypeIcon'
import AccountEditModal from '../components/AccountEditModal'
import CopilotChat from '../components/CopilotChat'
import { ClassificationBadge, StageBadge, StatusBadge, ThermometerBadge } from '../components/Badge'
import OpportunityModal from '../components/OpportunityModal'
import AccountCostPanel from '../components/AccountCostPanel'
import AbmSuggestionCard from '../components/AbmSuggestionCard'
import { IcpPanel, SignalsPanel, TimelinePanel } from '../components/AccountAbmPanels'
import { PillarBadge } from '../components/SegmentFilters'
import { useAuth } from '../lib/useAuth'
import { useEmailMessages, useContents } from '../lib/hooks'
import { CAMPAIGNS } from '../data/abmContext'
import { LEAD_ORIGINATORS } from '../lib/constants'
import { getAccount, saveStrategy, removeAccountService, addInteraction } from '../lib/data'
import { accountConsolidatedTemp } from '../lib/finance'
import { idadeNoAno } from '../lib/birthdays'
import { suggestForOpportunity, committeeCoverage } from '../lib/abm'
import { useTasks, useDismissals, useSalesCost } from '../lib/hooks'
import { ENTRY_DOORS } from '../data/leadrix'
import { SEGMENTS, ACCOUNT_SIZES, LEAD_SOURCES, ABM_TIERS, formatBRL } from '../lib/constants'

function Section({ icon: Icon, title, action, children }) {
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900">
          <Icon size={16} className="text-brand-500" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  )
}

// Estratégia ABM como caderno de anotações.
const STRATEGY_FIELDS = [
  ['hypothesis', 'Hipótese de valor', 'Onde esta empresa perde margem, capacidade, qualidade, velocidade ou receita porque a operação ainda não incorporou IA?'],
  ['affected_indicator', 'Indicador afetado', 'Qual indicador prova a hipótese (ex.: horas por entrega, custo por processo)?'],
  ['entry_offer', 'Oferta de entrada', 'Qual entrega de menor risco abre a conta (diagnóstico, workshop, piloto)?'],
  ['expansion_plan', 'Plano de expansão', 'Por quais pilares a conta cresce depois da primeira entrega?'],
  ['objective', 'Objetivo da conta', 'O que queremos alcançar com esta conta?'],
  ['value_proposition', 'Proposta de valor', 'Por que a Leadrix é a melhor escolha aqui? Qual indicador vamos mover?'],
  ['key_messages', 'Mensagens-chave', 'Pontos que devem aparecer em todos os toques.'],
  ['decision_makers', 'Decisores e influenciadores', 'Quem decide, quem influencia, quem usa.'],
  ['channels', 'Canais de relacionamento', 'Onde e como vamos tocar a conta.'],
  ['success_metrics', 'Métricas de sucesso', 'Como medimos o avanço do ABM nesta conta.'],
  ['objections', 'Objeções esperadas', 'O que pode travar e como respondemos.'],
  ['notes', 'Anotações livres', 'Caderno aberto da estratégia.'],
]

function StrategyModal({ account, onClose }) {
  const qc = useQueryClient()
  const s = account.account_strategy?.[0] || {}
  const [form, setForm] = useState(
    Object.fromEntries(STRATEGY_FIELDS.map(([k]) => [k, s[k] || ''])),
  )
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await saveStrategy(account.id, form)
      qc.invalidateQueries({ queryKey: ['account', account.id] })
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Estratégia ABM — caderno da conta" onClose={onClose} wide
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </>}>
      <div className="space-y-3">
        {STRATEGY_FIELDS.map(([k, label, hint]) => (
          <div key={k}>
            <label className="label">{label}</label>
            <textarea className="input min-h-[56px]" value={form[k]} onChange={set(k)} placeholder={hint} />
          </div>
        ))}
      </div>
    </Modal>
  )
}

function InteractionModal({ account, onClose }) {
  const qc = useQueryClient()
  const [type, setType] = useState('ligacao')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    if (!summary.trim()) return
    setBusy(true)
    try {
      await addInteraction(account.id, { type, summary })
      qc.invalidateQueries({ queryKey: ['account', account.id] })
      onClose()
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="Registrar interação" onClose={onClose}
      footer={<>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-primary" onClick={save} disabled={busy || !summary.trim()}>Salvar</button>
      </>}>
      <div className="space-y-3">
        <div>
          <label className="label">Tipo</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {['ligacao', 'reuniao', 'email', 'almoco', 'evento', 'outro'].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Resumo do toque</label>
          <textarea className="input min-h-[80px]" value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="O que aconteceu nesse contato com a conta?" />
        </div>
      </div>
    </Modal>
  )
}

export default function AccountView() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { data: a, isLoading, error } = useQuery({ queryKey: ['account', id], queryFn: () => getAccount(id) })
  const { data: allTasks = [] } = useTasks()
  const { data: dismissals = [] } = useDismissals()
  const { data: settings } = useSalesCost()
  const { data: emails = [] } = useEmailMessages(id)
  const { data: allContents = [] } = useContents()
  const { can } = useAuth()

  const [taskModal, setTaskModal] = useState(null)
  const [strategyModal, setStrategyModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [interactionModal, setInteractionModal] = useState(false)
  const [oppModal, setOppModal] = useState(null)

  if (isLoading) return <div className="p-8 text-sm text-ink-500">Carregando conta…</div>
  if (error) return <div className="p-8 text-sm text-rose-600">Erro: {error.message}</div>
  if (!a) return <div className="p-8 text-sm text-ink-500">Conta não encontrada.</div>

  const strategy = a.account_strategy?.[0] || null
  const hasStrategy = strategy && STRATEGY_FIELDS.some(([k]) => strategy[k])
  const opportunities = a.account_services || []
  const oppValue = opportunities
    .filter((o) => o.stage !== 'perdido')
    .reduce((sum, o) => sum + (Number(o.estimated_value_brl) || 0), 0)
  // Termômetro consolidado: maior termômetro entre as oportunidades abertas.
  const consolidatedTemp = accountConsolidatedTemp(a.id, opportunities)
  const suggestions = opportunities
    .map((o) => suggestForOpportunity(o, { account: a, tasks: allTasks, dismissals, settings }))
    .filter(Boolean)
    .sort((x, y) => y.score - x.score)
  const coverage = committeeCoverage(a)

  async function delService(asId) {
    await removeAccountService(asId)
    qc.invalidateQueries({ queryKey: ['account', id] })
    qc.invalidateQueries({ queryKey: ['all-account-services'] })
  }

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-500"><Building2 size={20} /></span>
          {a.name}
        </span>}
        subtitle={<span className="flex items-center gap-2">
          <ClassificationBadge value={a.classification} />
          <ThermometerBadge value={consolidatedTemp} withLabel />
          <span className="text-xs text-ink-400">(consolidado das oportunidades)</span>
        </span>}
        actions={<>
          <button className="btn-primary" onClick={() => setEditModal(true)}><Pencil size={16} /> Editar conta</button>
          <Link to="/contas" className="btn-outline"><ArrowLeft size={16} /> Voltar</Link>
        </>}
      />

      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-3">
        {/* Coluna esquerda */}
        <div className="space-y-5">
          <Section icon={Building2} title="Identidade" action={<button className="btn-ghost text-xs" onClick={() => setEditModal(true)}>Editar</button>}>
            <dl className="space-y-2 text-sm">
              <Row label="Nome fantasia">{a.trade_name || '—'}</Row>
              <Row label="CNPJ"><span className="inline-flex items-center gap-1">{a.cnpj ? <><Hash size={12} />{a.cnpj}</> : '—'}</span></Row>
              <Row label="Site">{a.site ? (
                <a href={a.site.startsWith('http') ? a.site : `https://${a.site}`} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline"><Globe size={14} /> {a.site}</a>
              ) : '—'}</Row>
              <Row label="Mercado">{SEGMENTS[a.segment] || '—'}</Row>
              <Row label="Microssegmento">{a.micro_segment || '—'}</Row>
              <Row label="Nível ABM">
                {a.abm_tier
                  ? <span className={`chip ${ABM_TIERS[a.abm_tier]?.color}`} title={ABM_TIERS[a.abm_tier]?.help}>{ABM_TIERS[a.abm_tier]?.label}</span>
                  : '—'}
              </Row>
              <Row label="Porta de entrada">{ENTRY_DOORS[a.entry_door]?.label || '—'}</Row>
              <Row label="Porte">{ACCOUNT_SIZES[a.account_size] || '—'}</Row>
              <Row label="Termômetro">
                <span className="flex items-center gap-2">
                  <ThermometerBadge value={consolidatedTemp} withLabel />
                  <span className="text-xs text-ink-400">consolidado — edite em cada oportunidade</span>
                </span>
              </Row>
              <Row label="Origem do lead">
                {a.origin_source
                  ? <span className="chip bg-accent-100 text-accent-800">
                      {a.origin_source === 'outros' ? (a.origin_source_other || 'Outros') : LEAD_ORIGINATORS[a.origin_source]}
                    </span>
                  : '—'}
              </Row>
              <Row label="Comissão de indicação">
                {a.referral_commission
                  ? <span className="font-semibold text-ink-900">Sim · {Number(a.referral_commission_pct || 0).toLocaleString('pt-BR')}% do valor ganho</span>
                  : 'Não'}
              </Row>
              <Row label="Campanha">{CAMPAIGNS[a.campaign]?.label || '—'}</Row>
              <Row label="Canal de origem">
                {a.lead_source
                  ? <span className="chip bg-brand-50 text-brand-700">{LEAD_SOURCES[a.lead_source] || a.lead_source}</span>
                  : '—'}
              </Row>
              <Row label="Detalhes do canal">{a.origin_details || '—'}</Row>
              <Row label="Quem indicou">{a.referred_by || '—'}</Row>
              <Row label="Observações">{a.observations || '—'}</Row>
            </dl>
          </Section>

          <Section icon={User} title={`Comitê de compra (${(a.contacts || []).length})`} action={<button className="btn-ghost text-xs" onClick={() => setEditModal(true)}>Editar</button>}>
            {coverage.personas.length > 0 && (
              <div className="mb-3 rounded-lg bg-ink-50 p-2.5 text-xs text-ink-600">
                <div className="mb-1 font-semibold">Personas típicas do mercado ({coverage.covered.length}/{coverage.personas.length} cobertas)</div>
                <div className="flex flex-wrap gap-1">
                  {coverage.covered.map((p) => <span key={p} className="chip bg-accent-100 text-accent-800">{p}</span>)}
                  {coverage.missing.map((p) => <span key={p} className="chip border border-dashed border-ink-300 bg-white text-ink-500">{p}</span>)}
                </div>
              </div>
            )}
            <ul className="space-y-3">
              {(a.contacts || []).map((c, i) => (
                <li key={i} className="border-b border-ink-100 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 font-semibold text-ink-900">
                    {c.name || 'Sem nome'}
                    {c.is_primary && <span className="chip bg-brand-50 text-brand-600">principal</span>}
                  </div>
                  {c.role && <div className="text-xs text-ink-500">{c.role}</div>}
                  <div className="mt-1 space-y-0.5 text-xs text-ink-600">
                    {c.email && <div className="flex items-center gap-1.5"><Mail size={12} /> <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></div>}
                    {c.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {c.phone}</div>}
                    {c.birth_date && (
                      <div className="flex items-center gap-1.5">
                        <Cake size={12} />
                        {format(parseISO(String(c.birth_date).slice(0, 10)), "d 'de' MMMM", { locale: ptBR })}
                        {idadeNoAno(c.birth_date, new Date().getFullYear()) != null &&
                          ` · ${idadeNoAno(c.birth_date, new Date().getFullYear())} anos`}
                      </div>
                    )}
                  </div>
                </li>
              ))}
              {(a.contacts || []).length === 0 && <li className="text-sm text-ink-400">Nenhum contato cadastrado. Use “Editar conta”.</li>}
            </ul>
          </Section>

          <IcpPanel account={a} />

          {can('costs.view') && <AccountCostPanel account={a} opportunities={opportunities} />}

          {(a.proposals || []).length > 0 && (
            <Section icon={FileText} title={`Propostas históricas (${a.proposals.length})`}>
              <ul className="space-y-2">
                {a.proposals.map((p, i) => (
                  <li key={i} className="rounded-lg border border-ink-100 p-2.5 text-sm">
                    {p.ref && <span className="chip mb-1 bg-ink-100 font-mono text-ink-600">{p.ref}</span>}
                    <div className="text-ink-700">{p.title || '—'}</div>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>

        {/* Coluna central */}
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="eyebrow">Ações ABM sugeridas</h2>
              <Link to="/radar" className="text-xs text-brand-600 hover:underline">Radar ABM</Link>
            </div>
            {suggestions.length ? (
              <div className="space-y-2">
                {suggestions.map((s, i) => (
                  <AbmSuggestionCard key={s.opp.id} suggestion={s} settings={settings} showAccount={false} defaultOpen={i === 0} />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-ink-300 p-3 text-sm text-ink-500">
                Nenhuma oportunidade pedindo ação agora. As sugestões aparecem quando o aging passa do SLA da etapa.
              </p>
            )}
          </div>

          <Section icon={Target} title="Estratégia ABM"
            action={<button className="btn-ghost text-xs" onClick={() => setStrategyModal(true)}>{hasStrategy ? 'Editar' : 'Definir'}</button>}>
            {hasStrategy ? (
              <dl className="space-y-2.5 text-sm">
                {STRATEGY_FIELDS.filter(([k]) => strategy[k]).map(([k, label]) => (
                  <div key={k}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
                    <dd className="whitespace-pre-wrap text-ink-700">{strategy[k]}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="rounded-lg border border-dashed border-ink-300 p-4 text-center text-sm text-ink-500">
                Caderno de estratégia ABM vazio.
                <div className="mt-2"><button className="btn-primary text-xs" onClick={() => setStrategyModal(true)}>Definir estratégia</button></div>
              </div>
            )}
          </Section>

          <Section icon={Briefcase}
            title={`Oportunidades · ${formatBRL(oppValue)}`}
            action={<button className="btn-ghost text-xs" onClick={() => setTaskModal({ new: true })}>+ via tarefa</button>}>
            {opportunities.length ? (
              <ul className="space-y-2">
                {opportunities.map((o) => (
                  <li key={o.id} className="rounded-lg border border-ink-100 p-2.5 hover:bg-ink-50">
                    <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOppModal(o)}>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink-900">{o.service?.name || o.service_id}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {o.service?.macro_id && <PillarBadge id={o.service.macro_id} />}
                          <StageBadge value={o.stage} />
                          <ThermometerBadge value={o.commercial_temp} />
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-brand-500">{formatBRL(o.estimated_value_brl)}</span>
                    </button>
                    {can('opportunity.delete') && (
                      <div className="mt-1 flex justify-end">
                        <button className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                          onClick={() => delService(o.id)} title="Excluir oportunidade (só administradores)">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-400">
                Nenhuma oportunidade. Marque os serviços de interesse ao criar uma tarefa de ABM — cada um vira uma oportunidade no pipeline.
              </p>
            )}
          </Section>

          <div className="flex items-center justify-between gap-2">
            <h2 className="eyebrow">Relacionamento</h2>
            <button className="btn-outline py-1 text-xs" onClick={() => setTaskModal({ new: true })}><Plus size={14} /> Nova ação ABM</button>
          </div>
          <TimelinePanel
            account={a}
            tasks={a.tasks || []}
            interactions={a.interactions || []}
            emails={emails}
            opportunities={opportunities}
            contents={allContents.filter((c) => c.account_id === a.id)}
            onOpenTask={(taskId) => setTaskModal({ task: (a.tasks || []).find((t) => t.id === taskId) })}
          />
        </div>

        {/* Coluna direita */}
        <div className="space-y-5">
          <SignalsPanel account={a} strategy={strategy} onEditStrategy={() => setStrategyModal(true)} />

          <CopilotChat account={a} />

          <Section icon={History} title="Interações"
            action={<button className="btn-ghost text-xs" onClick={() => setInteractionModal(true)}><Plus size={14} /> Registrar</button>}>
            <p className="mb-3 rounded-lg bg-ink-50 p-2.5 text-xs text-ink-500">
              Histórico de toques com a conta (ligações, reuniões, e-mails, almoços…). É a memória
              do relacionamento — alimenta o co-piloto e mostra a evolução do ABM.
            </p>
            {(a.interactions || []).length ? (
              <ul className="space-y-2 text-sm">
                {a.interactions.slice().sort((x, y) => (y.date || '').localeCompare(x.date || '')).map((it) => (
                  <li key={it.id} className="border-b border-ink-100 pb-2 last:border-0">
                    <div className="flex items-center gap-2 text-xs text-ink-400">
                      <span className="chip bg-ink-100 text-ink-500">{it.type}</span>
                      {new Date(it.date).toLocaleDateString('pt-BR')}
                    </div>
                    <div className="text-ink-700">{it.summary}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-ink-400">Sem interações registradas ainda.</p>}
          </Section>
        </div>
      </div>

      {taskModal && <TaskModal task={taskModal.task} defaultAccountId={a.id} onClose={() => setTaskModal(null)} />}
      {strategyModal && <StrategyModal account={a} onClose={() => setStrategyModal(false)} />}
      {editModal && <AccountEditModal account={a} onClose={() => setEditModal(false)} />}
      {interactionModal && <InteractionModal account={a} onClose={() => setInteractionModal(false)} />}
      {oppModal && (
        <OpportunityModal
          opportunity={oppModal}
          onClose={() => {
            setOppModal(null)
            qc.invalidateQueries({ queryKey: ['account', id] })
          }}
        />
      )}
    </>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="flex-1 text-ink-700">{children}</dd>
    </div>
  )
}
