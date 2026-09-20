// Guarda de autenticação das Edge Functions.
//
// `verify_jwt = true` não basta: a chave anon do projeto é pública (vai no
// bundle do front) e também é um JWT válido. Sem esta checagem, qualquer pessoa
// com a chave anon poderia chamar as funções — gastando IA ou, pior, disparando
// e-mail pela conta da Leadrix.
//
// Aqui exigimos um usuário de verdade: o token do Authorization é validado
// contra o Auth do projeto e precisa corresponder a um usuário logado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

export type CrmUser = { id: string; email: string | null; role: string }

/** @throws Response 401 quando não há usuário autenticado. */
export async function requireUser(req: Request): Promise<CrmUser> {
  const auth = req.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) throw unauthorized('Faça login para usar este recurso.')

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) throw unauthorized('Sessão inválida ou expirada.')

  const meta = (data.user.app_metadata || {}) as Record<string, unknown>
  const role = typeof meta.role === 'string' && meta.role ? meta.role : 'vendas'
  return { id: data.user.id, email: data.user.email ?? null, role }
}

/** Restringe a função a determinados perfis do CRM. */
export function requireRole(user: CrmUser, roles: string[]) {
  if (!roles.includes(user.role)) {
    throw new Response(JSON.stringify({ error: 'Seu perfil não tem acesso a este recurso.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Converte a exceção do guard numa resposta com CORS. */
export function authErrorResponse(e: unknown, corsHeaders: Record<string, string>) {
  if (e instanceof Response) {
    return new Response(e.body, { status: e.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  return null
}
