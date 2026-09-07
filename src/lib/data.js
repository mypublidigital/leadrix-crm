// Camada de acesso a dados. Dois modos:
//   - Supabase configurado → consulta as tabelas do CRM.
//   - Modo demo (sem creds)  → store gravável em localStorage (demoStore.js).
// As páginas só consomem estas funções, sem saber qual modo está ativo.

import { supabase, isSupabaseConfigured } from './supabase'
import { loadState, saveState, mutate, uid, resetState } from './demoStore'

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
  { name: 'Carlos Mendes', company: 'PagFácil', role: 'Diretor de Produto', email: 'carlos@pagfacil.com.br', phone: '+55 11 98888-1111' },
  { name: 'Fernanda Lima', company: 'Banco Azul', role: 'Head de Inovação', email: 'fernanda.lima@bancoazul.com.br', phone: '+55 11 97777-2222' },
  { name: 'Ricardo Souza', company: 'CoopCred', role: 'Gerente Comercial', email: 'ricardo@coopcred.coop.br', phone: '+55 41 96666-3333' },
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

// Testa o endpoint de catálogo (consumido pelo Consulcard Projetos).
export async function testCatalog() {
  if (DEMO_MODE) {
    const s = loadState()
    return { source: 'consulcard-crm (demo)', count: s.services.length, services: s.services }
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

export async function createTask(task) {
  if (DEMO_MODE) {
    return mutate((s) => {
      s.tasks.push({ id: uid(), service_ids: [], ...task })
    })
  }
  const { service_ids, ...row } = task
  const { error } = await supabase.from('tasks').insert(row)
  if (error) throw error
}

export async function updateTask(id, patch) {
  if (DEMO_MODE) {
    return mutate((s) => {
      const t = s.tasks.find((x) => x.id === id)
      if (t) Object.assign(t, patch)
    })
  }
  const { service_ids, account, ...row } = patch
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

// ── Handoff (fechar deal → operacional) ───────────────────────
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
        project_url: `https://consulcard-app.vercel.app/projects/${projectId}`,
        signed_at: new Date().toISOString(),
      })
      return { ok: true, simulated: true, project_url: `https://consulcard-app.vercel.app/projects/${projectId}` }
    })
  }
  return invokeFn('crm-handoff', { accountId, ...payload })
}

export function getDeals() {
  if (DEMO_MODE) return loadState().deals
  return []
}
