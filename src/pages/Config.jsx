import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, KeyRound, Trash2, Plus, Briefcase, Users, XCircle, ShieldCheck, RefreshCw, Layers } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import Modal from '../components/Modal'
import {
  listUsers, createUser, resetUserPassword, removeUser, setUserAdmin,
  listLostReasons, addLostReason, removeLostReason,
  listServices, createService, testCatalog,
  addMicroSegment, removeMicroSegment,
} from '../lib/data'
import SalesCostSettings from '../components/SalesCostSettings'
import { useMicroSegments } from '../lib/hooks'
import { MARKETS, MARKET_IDS } from '../data/leadrix'
import { DEMO_MODE } from '../lib/data'
import { useAuth } from '../lib/useAuth'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
import { servicesByMacro, SERVICES_CATALOG } from '../data/servicesCatalog'
import { formatBRL } from '../lib/constants'

function Card({ icon: Icon, title, desc, children }) {
  return (
    <div className="card p-5">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-ink-900"><Icon size={16} className="text-brand-500" /> {title}</h2>
        {desc && <p className="mt-0.5 text-xs text-ink-500">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function UsersCard() {
  const qc = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: listUsers })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [admin, setAdmin] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [credential, setCredential] = useState(null) // {email, password, label}
  const [aExcluir, setAExcluir] = useState(null) // usuário aguardando confirmação
  const [excluindo, setExcluindo] = useState(false)

  async function add() {
    if (!email) return
    setErr(''); setBusy(true)
    try {
      const r = await createUser({ name, email, admin })
      qc.invalidateQueries({ queryKey: ['users'] })
      setCredential({ email, password: r.password, label: 'Usuário criado' })
      setName(''); setEmail(''); setAdmin(false)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  async function reset(u) {
    setErr('')
    try {
      const r = await resetUserPassword({ id: u.id, email: u.email })
      setCredential({ email: u.email, password: r.password, label: 'Senha redefinida' })
    } catch (e) { setErr(e.message) }
  }
  async function toggleAdmin(u) {
    try { await setUserAdmin(u.id, u.role !== 'admin'); qc.invalidateQueries({ queryKey: ['users'] }) }
    catch (e) { setErr(e.message) }
  }
  // Exclusão de usuário é irreversível e não tem desfazer: só executa depois da
  // confirmação, e o aviso nomeia quem será apagado — "tem certeza?" sozinho não
  // protege de ter clicado na lixeira da linha errada.
  async function confirmarExclusao() {
    if (!aExcluir) return
    setExcluindo(true); setErr('')
    try {
      await removeUser(aExcluir.id)
      qc.invalidateQueries({ queryKey: ['users'] })
      setAExcluir(null)
    } catch (e) {
      setErr(e.message)
      setAExcluir(null)
    } finally {
      setExcluindo(false)
    }
  }

  return (
    <Card icon={Users} title="Usuários" desc="Cadastre por nome e e-mail — o sistema gera a senha automaticamente para você repassar.">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input className="input" placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          Administrador (pode gerenciar usuários)
        </label>
        <button className="btn-primary" onClick={add} disabled={busy || !email}><UserPlus size={16} /> {busy ? 'Criando…' : 'Criar'}</button>
      </div>

      {credential && (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <div className="font-semibold text-emerald-800">{credential.label} — repasse estas credenciais:</div>
          <div className="mt-1 font-mono text-ink-800">{credential.email}</div>
          <div className="font-mono text-lg font-bold text-ink-900">{credential.password}</div>
          <div className="mt-1 flex gap-2">
            <button className="btn-outline text-xs" onClick={() => navigator.clipboard?.writeText(`${credential.email} / ${credential.password}`)}>Copiar</button>
            <button className="btn-ghost text-xs" onClick={() => setCredential(null)}>Ocultar</button>
          </div>
        </div>
      )}
      {err && <p className="mt-2 text-xs text-rose-600">{err}</p>}

      <ul className="mt-3 divide-y divide-ink-100">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-ink-900">{u.full_name || '—'}</span>
              {u.role === 'admin' && <span className="chip ml-1 bg-brand-50 text-brand-600">admin</span>}
              <span className="block truncate text-xs text-ink-500">{u.email}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <button className="btn-ghost text-xs" onClick={() => toggleAdmin(u)}>{u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}</button>
              <button className="btn-ghost text-xs" onClick={() => reset(u)}><KeyRound size={14} /> Reset</button>
              <button
                className="rounded p-1 text-ink-300 hover:bg-rose-50 hover:text-rose-500"
                onClick={() => setAExcluir(u)}
                title={`Apagar ${u.full_name || u.email}`}
                aria-label={`Apagar ${u.full_name || u.email}`}
              >
                <Trash2 size={14} />
              </button>
            </span>
          </li>
        ))}
        {users.length === 0 && <li className="py-2 text-sm text-ink-400">Nenhum usuário cadastrado ainda.</li>}
      </ul>

      {aExcluir && (
        <Modal
          title="Apagar usuário"
          onClose={() => !excluindo && setAExcluir(null)}
          footer={
            <>
              <button className="btn-ghost" onClick={() => setAExcluir(null)} disabled={excluindo}>Cancelar</button>
              <button
                className="btn-primary bg-rose-600 hover:bg-rose-700"
                onClick={confirmarExclusao}
                disabled={excluindo}
                autoFocus
              >
                {excluindo ? 'Apagando…' : 'Apagar usuário'}
              </button>
            </>
          }
        >
          <p className="text-sm text-ink-700">
            Tem certeza que deseja apagar este usuário?
          </p>
          <div className="mt-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
            <div className="text-sm font-semibold text-ink-900">{aExcluir.full_name || 'Sem nome'}</div>
            <div className="font-mono text-xs text-ink-600">{aExcluir.email}</div>
            {aExcluir.role === 'admin' && (
              <span className="chip mt-1 inline-block bg-brand-50 text-brand-600">administrador</span>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-500">
            Ele perde o acesso imediatamente e a ação não pode ser desfeita.
          </p>
        </Modal>
      )}
    </Card>
  )
}

function LostReasonsCard() {
  const qc = useQueryClient()
  const { data: reasons = [] } = useQuery({ queryKey: ['lost-reasons'], queryFn: listLostReasons })
  const [label, setLabel] = useState('')
  async function add() { if (!label.trim()) return; await addLostReason(label.trim()); qc.invalidateQueries({ queryKey: ['lost-reasons'] }); setLabel('') }
  async function del(id) { await removeLostReason(id); qc.invalidateQueries({ queryKey: ['lost-reasons'] }) }
  return (
    <Card icon={XCircle} title="Motivos de não-venda" desc="Lista usada ao marcar uma negociação como Perdida.">
      <div className="flex gap-2">
        <input className="input" placeholder="Novo motivo…" value={label} onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary shrink-0" onClick={add}><Plus size={16} /></button>
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {reasons.map((r) => (
          <li key={r.id} className="chip group bg-ink-100 text-ink-700">
            {r.label}
            <button className="ml-1 text-ink-400 hover:text-rose-500" onClick={() => del(r.id)}><Trash2 size={12} /></button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ServicesCard() {
  const qc = useQueryClient()
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: listServices })
  const macros = servicesByMacro(SERVICES_CATALOG)
  const [f, setF] = useState({ macro_id: macros[0].macro_id, name: '', service_id: '', complexity: 3, suggested_value_brl: '', anchor: false })
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function add() {
    if (!f.name || !f.service_id) return
    const macro = macros.find((m) => m.macro_id === f.macro_id)
    await createService({ ...f, macro_label: macro.macro_label, complexity_range: String(f.complexity) })
    qc.invalidateQueries({ queryKey: ['services'] })
    setF((p) => ({ ...p, name: '', service_id: '' }))
  }
  return (
    <Card icon={Briefcase} title="Serviços (4 pilares)" desc={`Catálogo com ${services.length} serviços organizados pelos quatro pilares. Cadastre novos serviços com valor sugerido.`}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select className="input" value={f.macro_id} onChange={set('macro_id')}>
          {macros.map((m) => <option key={m.macro_id} value={m.macro_id}>{m.macro_label}</option>)}
        </select>
        <input className="input" placeholder="Nome do serviço" value={f.name} onChange={set('name')} />
        <input className="input" placeholder="id (ex.: novo-servico)" value={f.service_id} onChange={set('service_id')} />
        <input type="number" className="input" placeholder="Valor sugerido" value={f.suggested_value_brl} onChange={set('suggested_value_brl')} />
        <select className="input" value={f.complexity} onChange={set('complexity')}>
          {[1, 2, 3, 4, 5].map((c) => <option key={c} value={c}>Complexidade {c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-700">
          <input type="checkbox" className="h-4 w-4 rounded border-ink-300 text-brand-500" checked={f.anchor} onChange={set('anchor')} /> Projeto âncora
        </label>
      </div>
      <button className="btn-primary mt-2" onClick={add}><Plus size={16} /> Cadastrar serviço</button>
      <p className="mt-2 text-xs text-ink-400">{services.length} serviços ativos · ticket sugerido médio {formatBRL(services.reduce((s, x) => s + Number(x.suggested_value_brl || 0), 0) / (services.length || 1))}</p>
    </Card>
  )
}

function MicroSegmentsCard() {
  const qc = useQueryClient()
  const { data: micros = [] } = useMicroSegments()
  const [segment, setSegment] = useState(MARKET_IDS[0])
  const [label, setLabel] = useState('')
  const [err, setErr] = useState('')

  async function add() {
    setErr('')
    try {
      await addMicroSegment(segment, label)
      setLabel('')
      qc.invalidateQueries({ queryKey: ['micro-segments'] })
    } catch (e) {
      setErr(e.message)
    }
  }
  async function del(m) {
    await removeMicroSegment(m.id)
    qc.invalidateQueries({ queryKey: ['micro-segments'] })
  }

  return (
    <Card icon={Layers} title="Mercados e microssegmentos"
      desc="Os quatro mercados vêm do site da Leadrix. Os microssegmentos alimentam os filtros, o Radar ABM e o gerador de conteúdo — ajuste à carteira real.">
      <div className="flex flex-wrap gap-2">
        <select className="input w-auto" value={segment} onChange={(e) => setSegment(e.target.value)}>
          {MARKET_IDS.map((k) => <option key={k} value={k}>{MARKETS[k].label}</option>)}
        </select>
        <input className="input min-w-[180px] flex-1" placeholder="Novo microssegmento…" value={label}
          onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="btn-primary shrink-0" onClick={add} disabled={!label.trim()}><Plus size={16} /></button>
      </div>
      {err && <p className="mt-1 text-xs text-rose-600">{err}</p>}
      <div className="mt-3 space-y-3">
        {MARKET_IDS.map((k) => (
          <div key={k}>
            <div className="eyebrow mb-1">{MARKETS[k].label}{MARKETS[k].microProposto ? ' · lista inicial proposta' : ' · do site'}</div>
            <ul className="flex flex-wrap gap-1.5">
              {micros.filter((m) => m.segment === k).map((m) => (
                <li key={m.id} className="chip bg-ink-100 text-ink-700">
                  {m.label}
                  <button className="ml-1 text-ink-400 hover:text-rose-500" onClick={() => del(m)} aria-label={`Remover ${m.label}`}><Trash2 size={12} /></button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-400">Remover um microssegmento não apaga o valor gravado nas contas; ele só deixa de aparecer nos filtros.</p>
    </Card>
  )
}

function IntegrationCard() {
  return (
    <Card icon={ShieldCheck} title="Integração (handoff)" desc="Envio do projeto fechado para um sistema de projetos — fica dormente até existir um do lado da Leadrix.">
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between"><dt className="text-ink-500">Modo</dt><dd className="font-medium">{DEMO_MODE ? 'Demo (sem Supabase)' : 'Supabase conectado'}</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">Onboarding</dt><dd className="font-mono text-xs">/functions/v1/crm-onboarding</dd></div>
        <div className="flex justify-between"><dt className="text-ink-500">Assinatura</dt><dd className="font-medium">HMAC-SHA256</dd></div>
      </dl>
      <p className="mt-2 text-xs text-ink-400">
        Segredo <code>CRM_WEBHOOK_SECRET</code> e URLs ficam em Edge Function Secrets (não no front).
        Teste de handoff e log de webhooks completos entram quando o Supabase for conectado.
      </p>
    </Card>
  )
}

function CatalogSyncCard() {
  const [result, setResult] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const url = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/catalog` : '(defina VITE_SUPABASE_URL)'

  async function test() {
    setBusy(true); setErr(''); setResult(null)
    try { setResult(await testCatalog()) } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Card icon={RefreshCw} title="Catálogo de serviços via API"
      desc="O CRM é a fonte de verdade dos serviços. Um sistema de projetos pode consumir este catálogo para manter as mesmas nomenclaturas.">
      <div className="space-y-2 text-sm">
        <div>
          <div className="label">Endpoint do catálogo (GET)</div>
          <code className="block break-all rounded-lg bg-ink-50 p-2 text-xs">{url}</code>
        </div>
        <p className="text-xs text-ink-500">
          O sistema consumidor chama este endpoint com o header <code>X-Catalog-Key</code> (segredo
          compartilhado, fora do app).
        </p>
        <button className="btn-outline" onClick={test} disabled={busy}>
          <RefreshCw size={16} /> {busy ? 'Testando…' : 'Testar catálogo'}
        </button>
        {result && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
            OK — {result.count} serviços expostos (source: {result.source}).
          </div>
        )}
        {err && <p className="text-xs text-rose-600">{err}</p>}
      </div>
    </Card>
  )
}

export default function Config() {
  const { isAdmin, can } = useAuth()
  return (
    <>
      <PageHeader title="Configurações" subtitle="Custo de venda, mercados e microssegmentos, usuários, motivos de não-venda, serviços e integrações." />
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-2">
        {can('costs.edit') && <SalesCostSettings />}
        <MicroSegmentsCard />
        {isAdmin && <UsersCard />}
        <LostReasonsCard />
        <ServicesCard />
        <CatalogSyncCard />
        <IntegrationCard />
      </div>
    </>
  )
}
