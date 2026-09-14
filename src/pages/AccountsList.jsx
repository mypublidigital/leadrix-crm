import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Search, Building2, ExternalLink, Users, X, Plus } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { ClassificationBadge, ThermometerBadge, StageBadge } from '../components/Badge'
import InfoTip from '../components/InfoTip'
import BulkTaskModal from '../components/BulkTaskModal'
import AccountEditModal from '../components/AccountEditModal'
import { listAccounts, listAllAccountServices, listServices, listRoster } from '../lib/data'
import { accountConsolidatedTemp } from '../lib/finance'
import {
  CLASSIFICATIONS,
  SEGMENTS,
  ACCOUNT_SIZES,
  CRM_STAGES,
  THERMOMETER,
  THERMOMETER_LEVELS,
  LEAD_SOURCES,
  ABM_ACTIVE,
} from '../lib/constants'

// Detalhes da origem é texto livre: um <select> fragmentaria em variações
// ("Febraban" vs "Febraban Tech 2026"), então o filtro casa por TRECHO e apenas
// sugere o que já existe na base. Acento e caixa são ignorados no casamento.
const semAcento = (s) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

function TextFilter({ label, value, onChange, options, placeholder, listId }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        list={listId}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={listId}>
        {options.map((o) => <option key={o} value={o} />)}
      </datalist>
    </div>
  )
}

function Select({ label, value, onChange, options, allLabel, hint }) {
  return (
    <div>
      <label className="label flex items-center gap-1">
        {label}
        {hint}
      </label>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {options.map(([k, v]) => (
          <option key={k} value={k}>{v}</option>
        ))}
      </select>
    </div>
  )
}

export default function AccountsList() {
  const navigate = useNavigate()
  const { data: accounts = [], isLoading, error } = useQuery({ queryKey: ['accounts'], queryFn: listAccounts })
  const { data: accountServices = [] } = useQuery({ queryKey: ['all-account-services'], queryFn: listAllAccountServices })
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: listServices })

  const [q, setQ] = useState('')
  const [classification, setClassification] = useState('')
  const [segment, setSegment] = useState('')
  const [size, setSize] = useState('')
  const [temp, setTemp] = useState('')
  const [stage, setStage] = useState('')
  const [cargo, setCargo] = useState('')
  const [proposalStatus, setProposalStatus] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [originDetails, setOriginDetails] = useState('')
  const [abmOnly, setAbmOnly] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulk, setBulk] = useState(false)
  const [newAccount, setNewAccount] = useState(false)

  const { data: roster = [] } = useQuery({ queryKey: ['roster'], queryFn: listRoster })
  const rosterById = useMemo(() => new Map(roster.map((u) => [u.id, u])), [roster])

  // Mapas conta → oportunidades (serviços, etapas, termômetro consolidado, proposta).
  const svcByAccount = useMemo(() => {
    const m = new Map()
    accountServices.forEach((as) => {
      if (!m.has(as.account_id)) m.set(as.account_id, new Set())
      m.get(as.account_id).add(as.service_id)
    })
    return m
  }, [accountServices])

  const oppInfo = useMemo(() => {
    const m = new Map() // account_id -> {temp, stages:Set, topStage, hasProposal}
    const order = Object.keys(CRM_STAGES)
    accountServices.forEach((o) => {
      if (!m.has(o.account_id)) m.set(o.account_id, { stages: new Set(), hasProposal: false, topStage: null })
      const e = m.get(o.account_id)
      e.stages.add(o.stage)
      if (o.proposal_link) e.hasProposal = true
      if (o.stage !== 'perdido') {
        if (!e.topStage || order.indexOf(o.stage) > order.indexOf(e.topStage)) e.topStage = o.stage
      }
    })
    m.forEach((e, accountId) => {
      e.temp = accountConsolidatedTemp(accountId, accountServices)
    })
    return m
  }, [accountServices])

  // Cargos distintos (para o filtro de cargo).
  const cargos = useMemo(() => {
    const set = new Set()
    accounts.forEach((a) => (a.contacts || []).forEach((c) => c.role && set.add(c.role)))
    return [...set].sort()
  }, [accounts])

  // Sugestões de "Detalhes da origem" já usadas na base. Quando há uma origem
  // selecionada, sugere só os detalhes daquela origem — é a associação entre os
  // dois campos valendo também no filtro.
  const detalhesDeOrigem = useMemo(() => {
    const set = new Set()
    accounts.forEach((a) => {
      if (!a.origin_details) return
      if (leadSource && a.lead_source !== leadSource) return
      set.add(a.origin_details.trim())
    })
    return [...set].sort((x, y) => x.localeCompare(y, 'pt-BR'))
  }, [accounts, leadSource])

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q.toLowerCase())) return false
      if (classification && a.classification !== classification) return false
      if (segment && a.segment !== segment) return false
      if (size && a.account_size !== size) return false
      const info = oppInfo.get(a.id)
      if (temp !== '' && String(info?.temp ?? '') !== String(temp)) return false
      if (stage && !info?.stages?.has(stage)) return false
      if (cargo && !(a.contacts || []).some((c) => c.role === cargo)) return false
      if (proposalStatus === 'com' && !info?.hasProposal) return false
      if (proposalStatus === 'sem' && info?.hasProposal) return false
      if (serviceId && !(svcByAccount.get(a.id)?.has(serviceId))) return false
      if (leadSource && a.lead_source !== leadSource) return false
      if (originDetails && !semAcento(a.origin_details).includes(semAcento(originDetails))) return false
      if (abmOnly && !ABM_ACTIVE.includes(a.classification)) return false
      return true
    })
  }, [accounts, q, classification, segment, size, temp, stage, cargo, proposalStatus, serviceId, leadSource, originDetails, abmOnly, svcByAccount, oppInfo])

  const counts = useMemo(() => {
    const c = { total: accounts.length, abm: 0 }
    accounts.forEach((a) => ABM_ACTIVE.includes(a.classification) && c.abm++)
    return c
  }, [accounts])

  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id))
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allSelected) filtered.forEach((a) => next.delete(a.id))
      else filtered.forEach((a) => next.add(a.id))
      return next
    })
  }
  function toggleOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <>
      <PageHeader
        title="Contas (ABM)"
        subtitle={`${counts.total} contas importadas · ${counts.abm} em gestão ABM ativa`}
        actions={
          <button className="btn-primary" onClick={() => setNewAccount(true)}>
            <Plus size={16} /> Nova conta
          </button>
        }
      />

      <div className="space-y-4 p-6">
        {/* Filtros */}
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-ink-400" size={18} />
              <input className="input pl-10" placeholder="Buscar conta pelo nome…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex shrink-0 items-center gap-2 rounded-lg border border-ink-300 px-3 py-2 text-sm font-medium text-ink-700">
              <input type="checkbox" checked={abmOnly} onChange={(e) => setAbmOnly(e.target.checked)} className="h-4 w-4 rounded border-ink-300 text-brand-500" />
              Só ABM ativa
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Select label="Classificação" value={classification} onChange={setClassification} allLabel="Todas"
              options={Object.entries(CLASSIFICATIONS).map(([k, v]) => [k, v.label])} />
            <Select label="Segmento" value={segment} onChange={setSegment} allLabel="Todos" options={Object.entries(SEGMENTS)} />
            <Select label="Porte" value={size} onChange={setSize} allLabel="Todos" options={Object.entries(ACCOUNT_SIZES)} />
            <Select label="Etapa do funil" value={stage} onChange={setStage} allLabel="Todas"
              options={Object.entries(CRM_STAGES).map(([k, v]) => [k, v.label])} />
            <Select label="Termômetro" value={temp} onChange={setTemp} allLabel="Todos"
              options={THERMOMETER_LEVELS.map((k) => [String(k), THERMOMETER[k].label])}
              hint={
                <InfoTip>
                  <div className="space-y-1">
                    {THERMOMETER_LEVELS.map((k) => (
                      <div key={k}><span className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${THERMOMETER[k].color}`} /><b>{THERMOMETER[k].short}:</b> {THERMOMETER[k].help}</div>
                    ))}
                  </div>
                </InfoTip>
              } />
            <Select label="Cargo do contato" value={cargo} onChange={setCargo} allLabel="Todos" options={cargos.map((c) => [c, c])} />
            <Select label="Proposta" value={proposalStatus} onChange={setProposalStatus} allLabel="Todas"
              options={[['com', 'Com proposta enviada'], ['sem', 'Sem proposta']]} />
            <Select label="Serviço de interesse" value={serviceId} onChange={setServiceId} allLabel="Todos"
              options={services.map((s) => [s.id, s.name])} />
            <Select label="Origem do lead" value={leadSource} onChange={setLeadSource} allLabel="Todas"
              options={Object.entries(LEAD_SOURCES)} />
            <TextFilter label="Detalhes da origem" value={originDetails} onChange={setOriginDetails}
              options={detalhesDeOrigem} listId="filtro-detalhes-origem"
              placeholder={detalhesDeOrigem.length ? 'Qualquer trecho…' : 'Nada cadastrado ainda'} />
          </div>
        </div>

        {/* Barra de ação em massa */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-medium text-brand-700">{selected.size} conta(s) selecionada(s)</span>
            <div className="flex items-center gap-2">
              <button className="btn-primary text-sm" onClick={() => setBulk(true)}><Users size={16} /> Criar ação ABM em massa</button>
              <button className="btn-ghost text-sm" onClick={() => setSelected(new Set())}><X size={16} /> Limpar</button>
            </div>
          </div>
        )}

        {/* Tabela */}
        <div className="card overflow-hidden">
          {isLoading && <div className="p-8 text-center text-sm text-ink-500">Carregando…</div>}
          {error && <div className="p-8 text-center text-sm text-rose-600">Erro ao carregar contas: {error.message}</div>}
          {!isLoading && !error && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-3">
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-ink-300 text-brand-500" />
                  </th>
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3">Classificação</th>
                  <th className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      Etapa
                      <InfoTip>Etapa mais avançada entre as oportunidades abertas da conta.</InfoTip>
                    </span>
                  </th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-center">Contatos</th>
                  <th className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1">
                      Termômetro
                      <InfoTip>
                        <div className="space-y-1">
                          {THERMOMETER_LEVELS.map((k) => (
                            <div key={k}><span className={`mr-1 inline-block h-2 w-2 rounded-full align-middle ${THERMOMETER[k].color}`} /><b>{THERMOMETER[k].short}:</b> {THERMOMETER[k].help}</div>
                          ))}
                        </div>
                      </InfoTip>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} className={`border-b border-ink-100 last:border-0 hover:bg-ink-50/60 ${selected.has(a.id) ? 'bg-brand-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} className="h-4 w-4 rounded border-ink-300 text-brand-500" />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={`/contas/${a.id}`} className="flex items-center gap-2.5 font-semibold text-ink-900 hover:text-brand-600">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-100 text-ink-500"><Building2 size={16} /></span>
                        <span>{a.name}{a.site && <span className="ml-1 inline-flex items-center text-ink-400"><ExternalLink size={12} /></span>}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3"><ClassificationBadge value={a.classification} /></td>
                    <td className="px-4 py-3">
                      {oppInfo.get(a.id)?.topStage ? <StageBadge value={oppInfo.get(a.id).topStage} /> : <span className="text-xs text-ink-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {a.owner_id
                        ? (rosterById.get(a.owner_id)?.full_name || rosterById.get(a.owner_id)?.email || '—')
                        : <span className="text-xs text-ink-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-600">{(a.contacts || []).length}</td>
                    <td className="px-4 py-3 text-center"><ThermometerBadge value={oppInfo.get(a.id)?.temp} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-500">Nenhuma conta com os filtros atuais.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-center text-xs text-ink-400">{filtered.length} de {accounts.length} contas</p>
      </div>

      {bulk && (
        <BulkTaskModal
          accountIds={[...selected]}
          onClose={(created) => { setBulk(false); if (created) setSelected(new Set()) }}
        />
      )}

      {newAccount && (
        <AccountEditModal
          onClose={() => setNewAccount(false)}
          // recém-criada: abre a conta para seguir com estratégia/oportunidades
          onCreated={(id) => navigate(`/contas/${id}`)}
        />
      )}
    </>
  )
}
