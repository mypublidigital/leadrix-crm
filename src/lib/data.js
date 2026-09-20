// Camada de acesso a dados. Dois modos:
//   - Supabase configurado → consulta as tabelas do CRM.
//   - Modo demo (sem creds)  → store gravável em localStorage (demoStore.js).
// As páginas só consomem estas funções, sem saber qual modo está ativo.

import { supabase, isSupabaseConfigured } from './supabase'
import { loadState, mutate, uid, resetState } from './demoStore'
import { withDefaults } from './costs'
import { slug } from '../data/leadrix'

export const DEMO_MODE = !isSupabaseConfigured
export { resetState }

// Invoca uma Edge Function e extrai uma mensagem amigável do erro.
//
// supabase-js só expõe `data` quando a function responde 2xx: em qualquer
// outro status ele devolve um FunctionsHttpError genérico ("Edge Function
// returned a non-2xx status code") e o corpo real — {error: "mensagem"} —
// fica escondido em `error.context` (a Response bruta). Sem isso, qualquer
// status não-2xx (401/403/404/409/500...) vaza a mensagem técnica para o
// usuário em vez do texto amigável que a function tentou enviar.
// `body` é o payload JSON enviado como corpo; para outras opções do
// supabase-js (ex.: { method: 'GET' }), passe-as em `options`.
export async function invokeFn(name, body, options) {
  const { data, error } = await supabase.functions.invoke(name, body !== undefined ? { body, ...options } : options)
  if (error) {
    let message = error.message
    try {
      const parsed = await error.context?.json?.()
      if (parsed?.error) message = parsed.error
    } catch {
      // corpo não era JSON (ex.: erro de rede) — mantém a mensagem genérica
    }
    throw new Error(message)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

// ── Contas ────────────────────────────────────────────────────
export async function listAccounts() {
  if (DEMO_MODE) return structuredClone(loadState().accounts)
  const { data, error } = await supabase
    .from('accounts')
    .select('*, contacts(*)')
    .order('name')
  if (error) throw error
  return data
}

export async function getAccount(id) {
  if (DEMO_MODE) {
    const s = loadState()
    const a = s.accounts.find((x) => x.id === id)
    if (!a) return null
    const account_services = s.account_services
      .filter((as) => as.account_id === id)
      .map((as) => ({ ...as, service: s.services.find((sv) => sv.id === as.service_id) || null }))
    return structuredClone({
      ...a,
      account_strategy: s.strategies[id] ? [s.strategies[id]] : [],
      tasks: s.tasks.filter((t) => t.account_id === id),
      account_services,
      interactions: s.interactions.filter((i) => i.account_id === id),
    })
  }
  const { data, error } = await supabase
    .from('accounts')
    .select(
      '*, contacts(*), account_strategy(*), tasks(*), interactions(*), account_services(*, service:services(*))',
    )
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function updateAccountStage(id, stage) {
  return updateAccount(id, { crm_stage: stage })
}

// Cria uma conta manualmente (cadastro pela tela de Contas).
// O banco tem índice único em lower(name), então a duplicidade é checada antes
// para devolver uma mensagem legível em vez do erro cru do Postgres.
export async function createAccount({ contacts = [], ...row }) {
  const name = String(row.name || '').trim()
  if (!name) throw new Error('Informe o nome da conta.')

  if (DEMO_MODE) {
    return mutate((s) => {
      if (s.accounts.some((a) => a.name.toLowerCase() === name.toLowerCase())) {
        throw new Error('Já existe uma conta com esse nome.')
      }
      const account = {
        id: `man-${uid()}`,
        crm_stage: 'lead',
        macro_categories: [], relationship_years: [], proposals: [],
        segment: null, account_size: null, owner_id: null,
        created_at: new Date().toISOString(),
        ...row,
        name,
        contacts: contacts.map((c) => ({ id: uid(), ...c })),
      }
      s.accounts.push(account)
      return { id: account.id }
    })
  }

  const { data: existing } = await supabase.from('accounts').select('id').ilike('name', name).maybeSingle()
  if (existing) throw new Error('Já existe uma conta com esse nome.')

  const { data, error } = await supabase
    .from('accounts')
    .insert({ ...row, name, crm_stage: row.crm_stage || 'lead' })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('Já existe uma conta com esse nome.')
    throw error
  }
  if (contacts.length) {
    const rows = contacts.map((c) => contactRow(c, data.id))
    const { error: cErr } = await supabase.from('contacts').insert(rows)
    if (cErr) throw cErr
  }
  return { id: data.id }
}

// Atualiza quaisquer campos da conta (edição completa + campos de pipeline).
export async function updateAccount(id, patch) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const a = s.accounts.find((x) => x.id === id)
      if (a) Object.assign(a, patch)
    })
  }
  const { contacts, account_strategy, tasks, interactions, account_services, ...row } = patch
  const { error } = await supabase.from('accounts').update(row).eq('id', id)
  if (error) throw error
}

// Substitui o conjunto de contatos da conta.
// Normaliza um contato para gravação. Duas regras que evitam perda de dados:
//
// 1) TODAS as linhas saem com exatamente as mesmas chaves. Num insert em lote,
//    o PostgREST usa a união das chaves e preenche com NULL explícito as que
//    faltam numa linha — então misturar um contato vindo do banco (que traz
//    `created_at`) com um recém-adicionado (que não traz) fazia o banco receber
//    `created_at: null` e recusar a gravação inteira (NOT NULL).
// 2) Colunas gerenciadas pelo banco (`id`, `created_at`) NUNCA são reenviadas —
//    quem as preenche é o default da tabela.
function contactRow(c, accountId) {
  const txt = (v) => {
    const s = String(v ?? '').trim()
    return s === '' ? null : s
  }
  return {
    account_id: accountId,
    name: txt(c.name),
    role: txt(c.role),
    email: txt(c.email),
    phone: txt(c.phone),
    birth_date: txt(c.birth_date),
    is_primary: Boolean(c.is_primary),
  }
}

// Substitui o conjunto de contatos da conta.
//
// A ordem é deliberada: INSERE os novos ANTES de apagar os antigos. Se a
// gravação falhar, os contatos originais continuam lá — o pior caso vira
// duplicata (recuperável) em vez de perda (irrecuperável). A versão anterior
// apagava primeiro: quando a regravação falhava, os contatos sumiam de vez.
export async function saveContacts(accountId, contacts) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const a = s.accounts.find((x) => x.id === accountId)
      if (a) a.contacts = contacts.map((c) => ({ ...c }))
    })
  }

  const { data: existing, error: readErr } = await supabase
    .from('contacts').select('id').eq('account_id', accountId)
  if (readErr) throw readErr
  const oldIds = (existing || []).map((r) => r.id)

  if (contacts.length) {
    const rows = contacts.map((c) => contactRow(c, accountId))
    const { error } = await supabase.from('contacts').insert(rows)
    if (error) throw error // nada foi apagado ainda
  }

  if (oldIds.length) {
    const { error } = await supabase.from('contacts').delete().in('id', oldIds)
    if (error) throw error
  }
}

// ── Motivos de não-venda (Config) ─────────────────────────────
export async function listLostReasons() {
  if (DEMO_MODE) return structuredClone(loadState().lost_reasons || []).sort((a, b) => a.sort - b.sort)
  const { data, error } = await supabase.from('lost_reasons').select('*').order('sort')
  if (error) throw error
  return data
}

export async function addLostReason(label) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.lost_reasons = s.lost_reasons || []
      s.lost_reasons.push({ id: uid(), label, active: true, sort: s.lost_reasons.length + 1 })
    })
  }
  const { error } = await supabase.from('lost_reasons').insert({ label })
  if (error) throw error
}

export async function removeLostReason(id) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.lost_reasons = (s.lost_reasons || []).filter((r) => r.id !== id)
    })
  }
  const { error } = await supabase.from('lost_reasons').delete().eq('id', id)
  if (error) throw error
}

// ── Usuários (Config) ─────────────────────────────────────────
// Cadastro por Nome + E-mail; o sistema GERA e devolve a senha (como no Projetos).
// Em produção via Edge Function admin (service role + gate de admin).
function genDemoPassword() {
  const w = ['Sol', 'Rio', 'Mar', 'Luz', 'Nova', 'Forte', 'Alfa', 'Norte']
  const p = () => w[Math.floor(Math.random() * w.length)]
  return `${p()}${p()}${Math.floor(1000 + Math.random() * 9000)}!`
}

export async function listUsers() {
  if (DEMO_MODE) {
    const s = loadState()
    return s.users || []
  }
  const data = await invokeFn('crm-admin-users', { action: 'list' })
  return data.users || []
}

// Retorna { id, password } — a senha gerada deve ser exibida ao admin.
export async function createUser({ name, email, admin = false }) {
  if (DEMO_MODE) {
    const password = genDemoPassword()
    mutate((s) => {
      s.users = s.users || []
      if (s.users.some((u) => u.email === email)) throw new Error('Este e-mail já está cadastrado.')
      s.users.push({ id: uid(), email, full_name: name || null, role: admin ? 'admin' : null, created_at: new Date().toISOString() })
    })
    return { ok: true, password, full_name: name || null }
  }
  return invokeFn('crm-admin-users', { action: 'create', name, email, admin })
}

// Retorna { password } gerada.
export async function resetUserPassword({ id, email }) {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 200))
    return { ok: true, password: genDemoPassword() }
  }
  return invokeFn('crm-admin-users', { action: 'reset', id, email })
}

export async function setUserAdmin(id, admin) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const u = (s.users || []).find((x) => x.id === id)
      if (u) u.role = admin ? 'admin' : null
    })
  }
  return invokeFn('crm-admin-users', { action: 'set_admin', id, admin })
}

export async function removeUser(id) {
  if (DEMO_MODE) {
    return mutate((s) => { s.users = (s.users || []).filter((u) => u.id !== id) })
  }
  return invokeFn('crm-admin-users', { action: 'delete', id })
}

// ── Pré-CRM: captura de leads por foto (pré-base) ─────────────
const DEMO_NAMES = [
  { name: 'Carlos Mendes', company: 'Metalúrgica Serra Azul', role: 'Diretor de Operações', email: 'carlos.mendes@serraazul.ind.br', phone: '+55 11 98888-1111' },
  { name: 'Fernanda Lima', company: 'Rede Farma Bem', role: 'Diretora de Expansão', email: 'fernanda.lima@farmabem.com.br', phone: '+55 11 97777-2222' },
  { name: 'Ricardo Souza', company: 'Vértice Consultoria', role: 'Sócio', email: 'ricardo@verticeconsultoria.com.br', phone: '+55 41 96666-3333' },
]

// Envia a foto (base64) para extração. Retorna o pre_lead criado.
export async function capturePhoto(imageBase64, mediaType = 'image/jpeg', thumbDataUrl = null) {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 800))
    return mutate((s) => {
      s.pre_leads = s.pre_leads || []
      const fake = DEMO_NAMES[s.pre_leads.length % DEMO_NAMES.length]
      const row = {
        id: uid(), photo_path: null, thumb: thumbDataUrl, status: 'novo',
        ...fake, notes: 'Extraído em modo demo (simulado).',
        promoted_account_id: null, created_at: new Date().toISOString(),
      }
      s.pre_leads.unshift(row)
      return { ok: true, pre_lead: row }
    })
  }
  return invokeFn('crm-capture', { image_base64: imageBase64, media_type: mediaType })
}

export async function listPreLeads() {
  if (DEMO_MODE) return structuredClone(loadState().pre_leads || [])
  const { data, error } = await supabase
    .from('pre_leads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

// URL exibível da foto (signed URL em produção; dataURL no demo).
export async function preLeadPhotoUrl(pl) {
  if (DEMO_MODE) return pl.thumb || null
  if (!pl.photo_path) return null
  const { data } = await supabase.storage.from('captures').createSignedUrl(pl.photo_path, 3600)
  return data?.signedUrl || null
}

export async function updatePreLead(id, patch) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const p = (s.pre_leads || []).find((x) => x.id === id)
      if (p) Object.assign(p, patch)
    })
  }
  const { error } = await supabase.from('pre_leads').update(patch).eq('id', id)
  if (error) throw error
}

// Promove um pré-lead: cria (ou reutiliza) a Conta e adiciona o contato.
export async function promotePreLead(pl) {
  const accountName = (pl.company || pl.name || '').trim()
  if (!accountName) throw new Error('Informe ao menos empresa ou nome para promover.')
  const contact = {
    name: pl.name || null, role: pl.role || null,
    email: pl.email || null, phone: pl.phone || null, is_primary: false,
  }

  if (DEMO_MODE) {
    return mutate((s) => {
      let acc = s.accounts.find((a) => a.name.toLowerCase() === accountName.toLowerCase())
      if (!acc) {
        acc = {
          id: `cap-${uid()}`, name: accountName, classification: 'lead', crm_stage: 'lead',
          segment: null, account_size: null, macro_categories: [], relationship_years: [],
          proposals: [], contacts: [], observations: pl.notes || null, site: null,
          status_base: null, owner_id: null, created_at: new Date().toISOString(),
        }
        s.accounts.push(acc)
      }
      acc.contacts = acc.contacts || []
      if (contact.name || contact.email) acc.contacts.push({ id: uid(), ...contact, is_primary: acc.contacts.length === 0 })
      const p = (s.pre_leads || []).find((x) => x.id === pl.id)
      if (p) { p.status = 'promovido'; p.promoted_account_id = acc.id }
      return { account_id: acc.id }
    })
  }

  // Produção: reutiliza conta existente pelo nome (case-insensitive) ou cria.
  const { data: existing } = await supabase
    .from('accounts').select('id').ilike('name', accountName).maybeSingle()
  let accountId = existing?.id
  if (!accountId) {
    const { data: created, error } = await supabase
      .from('accounts')
      .insert({ name: accountName, classification: 'lead', crm_stage: 'lead', observations: pl.notes || null })
      .select('id').single()
    if (error) throw error
    accountId = created.id
  }
  if (contact.name || contact.email) {
    const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('account_id', accountId)
    const { error: cErr } = await supabase
      .from('contacts')
      .insert(contactRow({ ...contact, is_primary: (count || 0) === 0 }, accountId))
    if (cErr) throw cErr
  }
  const { error: upErr } = await supabase
    .from('pre_leads').update({ status: 'promovido', promoted_account_id: accountId }).eq('id', pl.id)
  if (upErr) throw upErr
  return { account_id: accountId }
}

export async function discardPreLead(id) {
  return updatePreLead(id, { status: 'descartado' })
}

// ── Importação de listas (CSV/Excel) ──────────────────────────
// Recebe contas já parseadas (mesmo shape do parser) e faz upsert por nome.
// Importa as contas já parseadas/validadas (parseUpload.js). Cada conta é
// gravada de forma independente: uma falha isolada (ex.: erro de rede pontual)
// não aborta o lote inteiro nem deixa de processar o resto do arquivo — só
// aquela conta entra em `errors`, para o usuário corrigir e reimportar.
// Na ATUALIZAÇÃO, campo vazio da planilha não apaga o que já está no CRM: só
// sobrescreve o que veio preenchido. Sem isso, reimportar uma planilha que não
// traz (ou traz em branco) segmento/porte/termômetro limpava o que tinha sido
// curado à mão no sistema. Vale também para valor recusado na validação, que
// chega aqui como null: preserva-se o que já existia em vez de zerar.
// Na CRIAÇÃO os nulos passam normalmente — conta nova nasce com os campos vazios.
function camposPreenchidos(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}

// Índice de contas existentes por nome, carregado de uma vez só.
//
// Antes o casamento era `ilike('name', nome)` por linha da planilha, o que dava
// dois problemas: (a) `%`, `_` e `*` são curinga no ilike, então um nome como
// "Grupo 100%" casava com contas erradas — e a importação atualizava a conta
// errada; (b) uma consulta por linha, ou seja ~100 idas ao banco por planilha.
// Aqui o nome é comparado como texto literal, em minúsculas, sem curinga.
async function indiceDeContasPorNome() {
  const porNome = new Map()
  const duplicados = new Set()
  const PAGINA = 1000
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase.from('accounts').select('id,name').range(de, de + PAGINA - 1)
    if (error) throw error
    for (const a of data) {
      const k = String(a.name || '').trim().toLowerCase()
      if (porNome.has(k)) duplicados.add(k)
      else porNome.set(k, a)
    }
    if (data.length < PAGINA) break // última página
  }
  return { porNome, duplicados }
}

export async function importAccounts(parsed) {
  if (DEMO_MODE) {
    return mutate((s) => {
      let created = 0, updated = 0
      for (const { warnings, linhas, ...a } of parsed) {
        const existing = s.accounts.find((x) => x.name.toLowerCase() === a.name.toLowerCase())
        if (existing) {
          Object.assign(existing, camposPreenchidos(a))
          updated++
        } else {
          s.accounts.push({
            id: `imp-${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${uid()}`,
            crm_stage: a.classification === 'lead' ? 'lead' : 'qualificado',
            segment: null, account_size: null, owner_id: null,
            created_at: new Date().toISOString(), ...a,
          })
          created++
        }
      }
      return { created, updated, errors: [] }
    })
  }

  // Produção: upsert por nome (usuário autenticado; RLS permite). Regrava contatos.
  let created = 0, updated = 0
  const errors = []
  const { porNome, duplicados } = await indiceDeContasPorNome()
  for (const { contacts, warnings, linhas, ...row } of parsed) {
    try {
      const chave = String(row.name || '').trim().toLowerCase()
      if (duplicados.has(chave)) {
        throw new Error('há mais de uma conta com este nome no CRM — resolva a duplicidade antes de importar')
      }
      const existing = porNome.get(chave)
      let accountId
      if (existing) {
        const { error } = await supabase.from('accounts').update(camposPreenchidos(row)).eq('id', existing.id)
        if (error) throw error
        accountId = existing.id
        updated++
      } else {
        const { data, error } = await supabase.from('accounts').insert(row).select('id').single()
        if (error) throw error
        accountId = data.id
        porNome.set(chave, { id: accountId, name: row.name }) // já existe para as próximas linhas
        created++
      }
      // Usa o mesmo caminho seguro da edição manual (insere antes de apagar).
      // Planilha SEM contatos preserva os que já existem, em vez de zerá-los:
      // boa parte das linhas da base não traz coluna de contato, e reimportar
      // apagaria contatos cadastrados à mão.
      if (contacts?.length) await saveContacts(accountId, contacts)
    } catch (e) {
      errors.push({ name: row.name, linhas, message: e.message || String(e) })
    }
  }
  return { created, updated, errors }
}

export async function saveStrategy(accountId, strategy) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.strategies[accountId] = { account_id: accountId, ...strategy, updated_at: new Date().toISOString() }
    })
  }
  const { error } = await supabase
    .from('account_strategy')
    .upsert({ account_id: accountId, ...strategy }, { onConflict: 'account_id' })
  if (error) throw error
}

// ── Serviços (catálogo) ───────────────────────────────────────
export async function listServices() {
  if (DEMO_MODE) return structuredClone(loadState().services)
  const { data, error } = await supabase.from('services').select('*').order('macro_label')
  if (error) throw error
  return data
}

export async function updateServiceValue(id, suggested_value_brl) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const sv = s.services.find((x) => x.id === id)
      if (sv) sv.suggested_value_brl = suggested_value_brl
    })
  }
  const { error } = await supabase.from('services').update({ suggested_value_brl }).eq('id', id)
  if (error) throw error
}

// Testa o endpoint de catálogo (consumido pelo sistema de projetos, quando existir).
export async function testCatalog() {
  if (DEMO_MODE) {
    const s = loadState()
    return { source: 'leadrix-crm (demo)', count: s.services.length, services: s.services }
  }
  return invokeFn('catalog', undefined, { method: 'GET' })
}

export async function createService(svc) {
  const row = {
    macro_id: svc.macro_id,
    macro_label: svc.macro_label,
    service_id: svc.service_id,
    name: svc.name,
    complexity: Number(svc.complexity) || 3,
    complexity_range: svc.complexity_range || String(svc.complexity || 3),
    anchor: Boolean(svc.anchor),
    suggested_value_brl: Number(svc.suggested_value_brl) || 0,
    active: true,
  }
  if (DEMO_MODE) {
    return mutate((s) => {
      s.services.push({ id: `svc-${row.service_id}`, ...row })
    })
  }
  const { error } = await supabase.from('services').insert(row)
  if (error) throw error
}

// ── Serviços de interesse do lead (conta ↔ serviço) ───────────
export async function listAccountServices(accountId) {
  if (DEMO_MODE) {
    const s = loadState()
    return s.account_services
      .filter((as) => as.account_id === accountId)
      .map((as) => ({ ...as, service: s.services.find((sv) => sv.id === as.service_id) || null }))
  }
  const { data, error } = await supabase
    .from('account_services')
    .select('*, service:services(*)')
    .eq('account_id', accountId)
  if (error) throw error
  return data
}

export async function listAllAccountServices() {
  if (DEMO_MODE) {
    const s = loadState()
    return s.account_services.map((as) => ({
      ...as,
      service: s.services.find((sv) => sv.id === as.service_id) || null,
    }))
  }
  const { data, error } = await supabase.from('account_services').select('*, service:services(*)')
  if (error) throw error
  return data
}

export async function addAccountService(accountId, service_id, estimated_value_brl, interest = 'interessado') {
  if (DEMO_MODE) {
    return mutate((s) => {
      if (s.account_services.some((as) => as.account_id === accountId && as.service_id === service_id)) return
      s.account_services.push({
        id: uid(), account_id: accountId, service_id, estimated_value_brl, interest, notes: null,
        stage: 'lead', commercial_temp: 0, owner_id: null,
        stage_entered_at: new Date().toISOString(), stage_history: [],
        created_at: new Date().toISOString(),
      })
    })
  }
  const { error } = await supabase
    .from('account_services')
    .upsert({ account_id: accountId, service_id, estimated_value_brl, interest }, { onConflict: 'account_id,service_id' })
  if (error) throw error
}

export async function updateAccountService(id, patch) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const as = s.account_services.find((x) => x.id === id)
      if (as) Object.assign(as, patch)
    })
  }
  const { service, account, ...row } = patch
  const { error } = await supabase.from('account_services').update(row).eq('id', id)
  if (error) throw error
}

// Move uma OPORTUNIDADE de etapa, gravando o histórico (aging/hemograma).
// extra: campos adicionais (standby_review_date, lost_reason, commercial_temp…).
export async function moveOpportunityStage(id, toStage, extra = {}) {
  const now = new Date().toISOString()
  const buildPatch = (opp) => {
    const history = Array.isArray(opp.stage_history) ? [...opp.stage_history] : []
    if (opp.stage && opp.stage !== toStage) {
      const enteredAt = opp.stage_entered_at || opp.created_at || now
      const days = Math.max(0, Math.round((new Date(now) - new Date(enteredAt)) / 86400000))
      history.push({ stage: opp.stage, entered_at: enteredAt, left_at: now, days })
    }
    return { stage: toStage, stage_entered_at: now, stage_history: history, ...extra }
  }

  if (DEMO_MODE) {
    return mutate((s) => {
      const opp = s.account_services.find((x) => x.id === id)
      if (opp) Object.assign(opp, buildPatch(opp))
    })
  }
  const { data: opp, error: e1 } = await supabase
    .from('account_services')
    .select('stage, stage_entered_at, stage_history, created_at')
    .eq('id', id)
    .single()
  if (e1) throw e1
  const { error } = await supabase.from('account_services').update(buildPatch(opp)).eq('id', id)
  if (error) throw error
}

// Lista leve de usuários (id, nome, e-mail) para seleção de dono/responsável.
export async function listRoster() {
  if (DEMO_MODE) {
    const s = loadState()
    return (s.users || []).map((u) => ({ id: u.id, email: u.email, full_name: u.full_name || null }))
  }
  const data = await invokeFn('crm-admin-users', { action: 'roster' })
  return data.users || []
}

export async function removeAccountService(id) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.account_services = s.account_services.filter((x) => x.id !== id)
    })
  }
  const { error } = await supabase.from('account_services').delete().eq('id', id)
  if (error) throw error
}

// ── Tarefas ───────────────────────────────────────────────────
export async function listTasks() {
  if (DEMO_MODE) {
    const s = loadState()
    return s.tasks.map((t) => ({ ...t, account: s.accounts.find((a) => a.id === t.account_id) || null }))
  }
  const { data, error } = await supabase.from('tasks').select('*, account:accounts(id,name)')
  if (error) throw error
  return data
}

// Devolve { id } — a ação ABM recém-criada recebe os lançamentos de custo.
export async function createTask(task) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const row = { id: uid(), service_ids: [], created_at: new Date().toISOString(), ...task }
      s.tasks.push(row)
      return { id: row.id }
    })
  }
  const { service_ids, ...row } = task
  const { data, error } = await supabase.from('tasks').insert(row).select('id').single()
  if (error) throw error
  return { id: data.id }
}

export async function updateTask(id, patch) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const t = s.tasks.find((x) => x.id === id)
      if (t) Object.assign(t, patch)
    })
  }
  const { service_ids, account, created_at, ...row } = patch
  const { error } = await supabase.from('tasks').update(row).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.tasks = s.tasks.filter((x) => x.id !== id)
    })
  }
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}

// ── Interações ────────────────────────────────────────────────
export async function addInteraction(accountId, { type, summary }) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.interactions.unshift({ id: uid(), account_id: accountId, type, summary, date: new Date().toISOString() })
    })
  }
  const { error } = await supabase.from('interactions').insert({ account_id: accountId, type, summary })
  if (error) throw error
}

// ── Microssegmentos (tabela editável, ligada aos 4 mercados) ──
export async function listMicroSegments() {
  if (DEMO_MODE) return structuredClone(loadState().micro_segments || []).sort((a, b) => a.sort - b.sort)
  const { data, error } = await supabase.from('micro_segments').select('id, segment, label, sort').order('sort')
  if (error) throw error
  return data
}

export async function addMicroSegment(segment, label) {
  const clean = String(label || '').trim()
  if (!segment || !clean) throw new Error('Informe o mercado e o nome do microssegmento.')
  const row = { id: `${segment}--${slug(clean)}`, segment, label: clean, sort: 999 }
  if (DEMO_MODE) {
    return mutate((s) => {
      s.micro_segments = s.micro_segments || []
      if (s.micro_segments.some((m) => m.id === row.id)) throw new Error('Esse microssegmento já existe neste mercado.')
      row.sort = s.micro_segments.filter((m) => m.segment === segment).length + 1
      s.micro_segments.push(row)
    })
  }
  const { error } = await supabase.from('micro_segments').insert(row)
  if (error) {
    if (error.code === '23505') throw new Error('Esse microssegmento já existe neste mercado.')
    throw error
  }
}

export async function removeMicroSegment(id) {
  if (DEMO_MODE) {
    return mutate((s) => { s.micro_segments = (s.micro_segments || []).filter((m) => m.id !== id) })
  }
  const { error } = await supabase.from('micro_segments').delete().eq('id', id)
  if (error) throw error
}

// ── Custo de venda: configuração ──────────────────────────────
// Em produção a configuração vive em quatro lugares: recursos, categorias de
// despesa, custos fixos (uma tabela cada) e `crm_settings` (chave → jsonb) para
// horas por tipo de ação, margem e SLA de aging.
export async function getSalesCostSettings() {
  if (DEMO_MODE) return withDefaults(structuredClone(loadState().sales_cost || null))
  const [res, cats, fixed, settings] = await Promise.all([
    supabase.from('sales_resources').select('id, name, role, user_id, monthly_cost, monthly_hours, hourly_cost, active, sort').order('sort'),
    supabase.from('sales_expense_categories').select('id, label, unit, default_cost, sort').order('sort'),
    supabase.from('sales_fixed_costs').select('id, label, monthly, sort').order('sort'),
    supabase.from('crm_settings').select('key, value'),
  ])
  for (const r of [res, cats, fixed, settings]) if (r.error) throw r.error
  const kv = Object.fromEntries((settings.data || []).map((r) => [r.key, r.value]))
  return withDefaults({
    resources: res.data,
    expense_categories: cats.data,
    fixed_costs: fixed.data,
    task_hours: kv.task_hours,
    margin_pct: kv.margin_pct,
    aging_sla: kv.aging_sla,
  })
}

// Grava uma lista inteira: primeiro upsert (nada se perde se falhar), depois
// remove o que saiu da lista — mesma ordem segura de saveContacts.
async function replaceList(table, rows, columns) {
  // Campo numérico apagado na tela chega como '' — no banco vira null.
  const clean = rows.map((r, i) => Object.fromEntries(columns.map((c) => [c, c === 'sort' ? i + 1 : (r[c] === '' || r[c] === undefined ? null : r[c])])))
  if (clean.length) {
    const { error } = await supabase.from(table).upsert(clean, { onConflict: 'id' })
    if (error) throw error
  }
  const { data: existing, error: readErr } = await supabase.from(table).select('id')
  if (readErr) throw readErr
  const keep = new Set(clean.map((r) => r.id))
  const stale = (existing || []).map((r) => r.id).filter((id) => !keep.has(id))
  if (stale.length) {
    const { error } = await supabase.from(table).delete().in('id', stale)
    if (error) throw error
  }
}

export async function saveSalesCostSettings(settings) {
  const s = withDefaults(settings)
  if (DEMO_MODE) return mutate((st) => { st.sales_cost = s })
  await replaceList('sales_resources', s.resources, ['id', 'name', 'role', 'user_id', 'monthly_cost', 'monthly_hours', 'hourly_cost', 'active', 'sort'])
  await replaceList('sales_expense_categories', s.expense_categories, ['id', 'label', 'unit', 'default_cost', 'sort'])
  await replaceList('sales_fixed_costs', s.fixed_costs, ['id', 'label', 'monthly', 'sort'])
  const { error } = await supabase.from('crm_settings').upsert([
    { key: 'task_hours', value: s.task_hours },
    { key: 'margin_pct', value: s.margin_pct },
    { key: 'aging_sla', value: s.aging_sla },
  ], { onConflict: 'key' })
  if (error) throw error
}

// ── Custo de venda: lançamentos (horas e despesas) ────────────
const COST_COLUMNS = 'id, account_id, opportunity_id, task_id, kind, resource_id, hours, hourly_cost, category_id, quantity, unit_cost, description, date, created_at'

function costRow(e) {
  const n = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v))
  return {
    account_id: e.account_id,
    opportunity_id: e.opportunity_id || null,
    task_id: e.task_id || null,
    kind: e.kind === 'hours' ? 'hours' : 'expense',
    resource_id: e.kind === 'hours' ? e.resource_id || null : null,
    hours: e.kind === 'hours' ? n(e.hours) : null,
    hourly_cost: e.kind === 'hours' ? n(e.hourly_cost) : null,
    category_id: e.kind === 'hours' ? null : e.category_id || null,
    quantity: e.kind === 'hours' ? null : n(e.quantity) ?? 1,
    unit_cost: e.kind === 'hours' ? null : n(e.unit_cost),
    description: String(e.description || '').trim() || null,
    date: e.date || new Date().toISOString().slice(0, 10),
  }
}

export async function listCostEntries({ accountId } = {}) {
  if (DEMO_MODE) {
    const all = structuredClone(loadState().cost_entries || [])
    return accountId ? all.filter((e) => e.account_id === accountId) : all
  }
  let q = supabase.from('cost_entries').select(COST_COLUMNS).order('date', { ascending: false })
  if (accountId) q = q.eq('account_id', accountId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function addCostEntries(entries) {
  const rows = entries.map(costRow).filter((r) => r.account_id && (r.kind === 'hours' ? r.hours > 0 : r.unit_cost > 0))
  if (!rows.length) return
  if (DEMO_MODE) {
    return mutate((s) => {
      s.cost_entries = s.cost_entries || []
      rows.forEach((r) => s.cost_entries.push({ id: uid(), created_at: new Date().toISOString(), ...r }))
    })
  }
  const { error } = await supabase.from('cost_entries').insert(rows)
  if (error) throw error
}

export async function deleteCostEntry(id) {
  if (DEMO_MODE) {
    return mutate((s) => { s.cost_entries = (s.cost_entries || []).filter((e) => e.id !== id) })
  }
  const { error } = await supabase.from('cost_entries').delete().eq('id', id)
  if (error) throw error
}

// Substitui os lançamentos de UMA ação ABM. Insere os novos antes de apagar os
// antigos: se a gravação falhar, o custo anterior continua registrado.
export async function replaceTaskCostEntries(taskId, entries) {
  const rows = entries.map((e) => costRow({ ...e, task_id: taskId }))
    .filter((r) => r.account_id && (r.kind === 'hours' ? r.hours > 0 : r.unit_cost > 0))
  if (DEMO_MODE) {
    return mutate((s) => {
      s.cost_entries = (s.cost_entries || []).filter((e) => e.task_id !== taskId)
      rows.forEach((r) => s.cost_entries.push({ id: uid(), created_at: new Date().toISOString(), ...r }))
    })
  }
  const { data: old, error: readErr } = await supabase.from('cost_entries').select('id').eq('task_id', taskId)
  if (readErr) throw readErr
  if (rows.length) {
    const { error } = await supabase.from('cost_entries').insert(rows)
    if (error) throw error
  }
  const oldIds = (old || []).map((r) => r.id)
  if (oldIds.length) {
    const { error } = await supabase.from('cost_entries').delete().in('id', oldIds)
    if (error) throw error
  }
}

// ── Conteúdo (biblioteca do estúdio) ──────────────────────────
const CONTENT_COLUMNS = 'id, format, title, body, meta_description, hashtags, cta, status, account_id, opportunity_id, play_id, segment, micro_segment, pillar, persona, stage, angle, generated_by, created_at, updated_at'

export async function listContents() {
  if (DEMO_MODE) {
    return structuredClone(loadState().contents || []).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))
  }
  const { data, error } = await supabase.from('content_items').select(CONTENT_COLUMNS).order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

export async function saveContent(item) {
  const now = new Date().toISOString()
  const row = {
    format: item.format, title: item.title || null, body: item.body || '',
    meta_description: item.meta_description || null, hashtags: item.hashtags || [], cta: item.cta || null,
    status: item.status || 'rascunho', account_id: item.account_id || null, opportunity_id: item.opportunity_id || null,
    play_id: item.play_id || null, segment: item.segment || null, micro_segment: item.micro_segment || null,
    pillar: item.pillar || null, persona: item.persona || null, stage: item.stage || null, angle: item.angle || null,
    generated_by: item.generated_by || null,
  }
  if (DEMO_MODE) {
    return mutate((s) => {
      s.contents = s.contents || []
      const existing = item.id && s.contents.find((c) => c.id === item.id)
      if (existing) { Object.assign(existing, row, { updated_at: now }); return { id: existing.id } }
      const created = { id: uid(), ...row, created_at: now, updated_at: now }
      s.contents.unshift(created)
      return { id: created.id }
    })
  }
  if (item.id) {
    const { error } = await supabase.from('content_items').update({ ...row, updated_at: now }).eq('id', item.id)
    if (error) throw error
    return { id: item.id }
  }
  const { data, error } = await supabase.from('content_items').insert(row).select('id').single()
  if (error) throw error
  return { id: data.id }
}

export async function deleteContent(id) {
  if (DEMO_MODE) return mutate((s) => { s.contents = (s.contents || []).filter((c) => c.id !== id) })
  const { error } = await supabase.from('content_items').delete().eq('id', id)
  if (error) throw error
}

// ── Sugestões ABM descartadas ─────────────────────────────────
export async function listAbmDismissals() {
  if (DEMO_MODE) return structuredClone(loadState().abm_dismissals || [])
  const { data, error } = await supabase.from('abm_dismissals').select('id, opportunity_id, play_id, reason, created_at')
  if (error) throw error
  return data
}

export async function dismissAbmPlay(opportunityId, playId, reason = null) {
  const row = { opportunity_id: opportunityId, play_id: playId, reason }
  if (DEMO_MODE) {
    return mutate((s) => {
      s.abm_dismissals = s.abm_dismissals || []
      s.abm_dismissals.push({ id: uid(), ...row, created_at: new Date().toISOString() })
    })
  }
  const { error } = await supabase.from('abm_dismissals').insert(row)
  if (error) throw error
}

// ── Mensageria: configuração do remetente ─────────────────────
// Guardada em crm_settings (chave 'email_settings'): nome de quem assina,
// assinatura, aliases autorizados do Gmail da Leadrix e alias padrão.
export const DEFAULT_EMAIL_SETTINGS = {
  from_name: 'Leadrix',
  from_email: 'marcelo@leadrix.com.br',
  default_alias: 'marcelo@leadrix.com.br',
  aliases: ['marcelo@leadrix.com.br'],
  signature: 'Equipe Leadrix\nLidere seu mercado com IA',
  auto_enabled: false, // trava geral dos envios automáticos
}

export async function listEmailSettings() {
  if (DEMO_MODE) return { ...DEFAULT_EMAIL_SETTINGS, ...(loadState().email_settings || {}) }
  const { data, error } = await supabase.from('crm_settings').select('value').eq('key', 'email_settings').maybeSingle()
  if (error) throw error
  return { ...DEFAULT_EMAIL_SETTINGS, ...(data?.value || {}) }
}

export async function saveEmailSettings(settings) {
  if (DEMO_MODE) return mutate((s) => { s.email_settings = { ...DEFAULT_EMAIL_SETTINGS, ...settings } })
  const { error } = await supabase.from('crm_settings').upsert({ key: 'email_settings', value: settings }, { onConflict: 'key' })
  if (error) throw error
}

// ── Mensageria: modelos ───────────────────────────────────────
const TEMPLATE_COLUMNS = 'id, name, event, subject, body, from_alias, auto, delay_days, active, created_at, updated_at'

export async function listEmailTemplates() {
  if (DEMO_MODE) return structuredClone(loadState().email_templates || [])
  const { data, error } = await supabase.from('email_templates').select(TEMPLATE_COLUMNS).order('name')
  if (error) throw error
  return data
}

export async function saveEmailTemplate(t) {
  const row = {
    name: String(t.name || '').trim() || 'Modelo sem nome',
    event: t.event || 'manual',
    subject: t.subject || '',
    body: t.body || '',
    from_alias: t.from_alias || null,
    auto: Boolean(t.auto),
    delay_days: Number(t.delay_days) || 0,
    active: t.active !== false,
  }
  if (DEMO_MODE) {
    return mutate((s) => {
      s.email_templates = s.email_templates || []
      const existing = t.id && s.email_templates.find((x) => x.id === t.id)
      if (existing) { Object.assign(existing, row, { updated_at: new Date().toISOString() }); return { id: existing.id } }
      const created = { id: uid(), ...row, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      s.email_templates.push(created)
      return { id: created.id }
    })
  }
  if (t.id) {
    const { error } = await supabase.from('email_templates').update({ ...row, updated_at: new Date().toISOString() }).eq('id', t.id)
    if (error) throw error
    return { id: t.id }
  }
  const { data, error } = await supabase.from('email_templates').insert(row).select('id').single()
  if (error) throw error
  return { id: data.id }
}

export async function deleteEmailTemplate(id) {
  if (DEMO_MODE) return mutate((s) => { s.email_templates = (s.email_templates || []).filter((t) => t.id !== id) })
  const { error } = await supabase.from('email_templates').delete().eq('id', id)
  if (error) throw error
}

// ── Mensageria: fila de mensagens ─────────────────────────────
const MESSAGE_COLUMNS = 'id, account_id, contact_id, opportunity_id, task_id, template_id, event, to_email, to_name, from_alias, subject, body, status, scheduled_at, sent_at, error, provider_message_id, created_at'

export async function listEmailMessages({ accountId } = {}) {
  if (DEMO_MODE) {
    const all = structuredClone(loadState().email_messages || [])
    const list = accountId ? all.filter((m) => m.account_id === accountId) : all
    return list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  }
  let q = supabase.from('email_messages').select(MESSAGE_COLUMNS).order('created_at', { ascending: false })
  if (accountId) q = q.eq('account_id', accountId)
  const { data, error } = await q
  if (error) throw error
  return data
}

export async function createEmailMessage(m) {
  const row = {
    account_id: m.account_id,
    contact_id: m.contact_id || null,
    opportunity_id: m.opportunity_id || null,
    task_id: m.task_id || null,
    template_id: m.template_id || null,
    event: m.event || 'manual',
    to_email: m.to_email,
    to_name: m.to_name || null,
    from_alias: m.from_alias || null,
    subject: m.subject || '',
    body: m.body || '',
    status: m.status || 'rascunho',
    scheduled_at: m.scheduled_at || null,
  }
  if (!row.account_id || !row.to_email) throw new Error('E-mail precisa de conta e destinatário.')
  if (DEMO_MODE) {
    return mutate((s) => {
      s.email_messages = s.email_messages || []
      const created = { id: uid(), ...row, sent_at: null, error: null, provider_message_id: null, created_at: new Date().toISOString() }
      s.email_messages.unshift(created)
      return { id: created.id }
    })
  }
  const { data, error } = await supabase.from('email_messages').insert(row).select('id').single()
  if (error) throw error
  return { id: data.id }
}

export async function updateEmailMessage(id, patch) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const m = (s.email_messages || []).find((x) => x.id === id)
      if (m) Object.assign(m, patch)
    })
  }
  const { error } = await supabase.from('email_messages').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteEmailMessage(id) {
  if (DEMO_MODE) return mutate((s) => { s.email_messages = (s.email_messages || []).filter((m) => m.id !== id) })
  const { error } = await supabase.from('email_messages').delete().eq('id', id)
  if (error) throw error
}

// ── Handoff (fechar deal → sistema de projetos) ───────────────
// Em demo, simula sucesso. Em produção chama a Edge Function crm-handoff.
export async function closeAndHandoff(accountId, payload) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const a = s.accounts.find((x) => x.id === accountId)
      if (a) {
        a.crm_stage = 'fechado'
        a.commercial_temp = 100
      }
      const projectId = `proj-${accountId.replace('demo-', '')}`
      s.deals.push({
        id: uid(),
        account_id: accountId,
        title: payload?.name || `Projeto — ${a?.name}`,
        stage: 'fechado',
        value_brl: payload?.contract_value_brl || null,
        handoff_status: 'sucesso',
        project_id: projectId,
        project_url: `https://projetos.leadrix.com.br/projects/${projectId}`,
        signed_at: new Date().toISOString(),
      })
      return { ok: true, simulated: true, project_url: `https://projetos.leadrix.com.br/projects/${projectId}` }
    })
  }
  return invokeFn('crm-handoff', { accountId, ...payload })
}

export function getDeals() {
  if (DEMO_MODE) return loadState().deals
  return []
}
