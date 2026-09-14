import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Quando as credenciais não estão configuradas o app entra em "modo demo"
// (lê dados de exemplo locais) para permitir desenvolver a UI antes de
// existir o projeto Supabase do CRM. Ver src/lib/data.js.
export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes('SEU-REF'))

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

// Cliente descartável, sem sessão persistida.
//
// A troca de senha feita a partir da tela de login precisa autenticar antes de
// gravar. Se usasse o cliente principal, esse login já colocaria o app inteiro
// como autenticado, a tela de login sairia do ar no meio do fluxo e não haveria
// onde mostrar o erro caso a gravação falhasse — pior, o usuário entraria
// achando que trocou a senha. Aqui a sessão nasce e morre dentro da operação.
export function createIsolatedClient() {
  if (!isSupabaseConfigured) return null
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
