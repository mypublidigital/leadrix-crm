// Edge Function admin: gestão de usuários do CRM (briefing §3 — auth por Supabase
// com gestão via service-role). Ações: list | create | reset | set_admin | delete.
//
// - create: recebe { name, email, admin? }, GERA uma senha forte e a devolve para
//   o admin repassar (fluxo igual ao sistema de projetos).
// - reset: gera uma nova senha e a devolve (não depende de e-mail/link).
// Protegida: exige chamador autenticado com papel admin.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/hmac.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

// Gera uma senha forte e legível: 3 blocos + dígitos + símbolo.
function genPassword(): string {
  const words = ['Sol', 'Rio', 'Mar', 'Luz', 'Céu', 'Ouro', 'Vento', 'Norte', 'Forte', 'Nova', 'Alfa', 'Beta']
  const w = () => words[Math.floor(Math.random() * words.length)]
  const n = Math.floor(1000 + Math.random() * 9000)
  const sym = '!@#$%&'[Math.floor(Math.random() * 6)]
  return `${w()}${w()}${n}${sym}`
}

// Traduz erros conhecidos da Admin API do Supabase Auth para mensagens
// amigáveis. Sem isso, o cliente exibiria o texto técnico da exceção
// (ex.: "AuthApiError: A user with this email address has already been
// registered") em vez de algo que o usuário entenda.
function friendlyAuthError(error: any): string {
  const code = error?.code || ''
  const message = String(error?.message || error || '')
  if (code === 'email_exists' || /already.*(registered|exists)/i.test(message)) {
    return 'Este e-mail já está cadastrado.'
  }
  if (code === 'weak_password' || /password.*weak/i.test(message)) {
    return 'Senha muito fraca. Tente novamente.'
  }
  if (code === 'validation_failed' || /invalid.*email/i.test(message)) {
    return 'E-mail inválido.'
  }
  return message || 'Ocorreu um erro inesperado. Tente novamente.'
}

function userView(u: any) {
  return {
    id: u.id,
    email: u.email,
    full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
    role: u.app_metadata?.role || null,
    created_at: u.created_at,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    // valida o chamador (precisa ser admin)
    const authHeader = req.headers.get('Authorization') || ''
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await caller.auth.getUser()
    if (!user) return json({ error: 'não autenticado' }, 401)

    const { action, name, email, id, admin: makeAdmin } = await req.json()

    // "roster": lista leve (id, nome, e-mail) para seleção de responsável/dono.
    // Disponível a QUALQUER usuário autenticado (não exige admin).
    if (action === 'roster') {
      const { data, error } = await admin.auth.admin.listUsers()
      if (error) throw error
      return json({
        users: data.users.map((u) => ({
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || u.user_metadata?.name || null,
        })),
      })
    }

    const isAdmin = user.app_metadata?.role === 'admin' || user.user_metadata?.role === 'admin'
    if (!isAdmin) return json({ error: 'Apenas administradores podem gerenciar usuários.' }, 403)

    if (action === 'list') {
      const { data, error } = await admin.auth.admin.listUsers()
      if (error) throw error
      return json({ users: data.users.map(userView) })
    }

    if (action === 'create') {
      if (!email) return json({ error: 'E-mail obrigatório.' }, 400)
      const password = genPassword()
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name || null },
        app_metadata: makeAdmin ? { role: 'admin' } : {},
      })
      // Status 200 mesmo em erro esperado (ex.: e-mail duplicado): garante que
      // o corpo {error: "..."} chegue ao cliente como `data.error`, sem
      // depender da extração de FunctionsHttpError.context num status não-2xx.
      if (error) return json({ error: friendlyAuthError(error) }, 200)
      return json({ ok: true, id: data.user?.id, password, full_name: name || null })
    }

    if (action === 'reset') {
      // reset por id ou email → gera nova senha e devolve
      let uid = id
      if (!uid && email) {
        const { data } = await admin.auth.admin.listUsers()
        uid = data.users.find((u) => u.email === email)?.id
      }
      if (!uid) return json({ error: 'Usuário não encontrado.' }, 200)
      const password = genPassword()
      const { error } = await admin.auth.admin.updateUserById(uid, { password })
      if (error) return json({ error: friendlyAuthError(error) }, 200)
      return json({ ok: true, password })
    }

    if (action === 'set_admin') {
      const { error } = await admin.auth.admin.updateUserById(id, {
        app_metadata: { role: makeAdmin ? 'admin' : null },
      })
      if (error) return json({ error: friendlyAuthError(error) }, 200)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: friendlyAuthError(error) }, 200)
      return json({ ok: true })
    }

    return json({ error: 'ação inválida' }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
