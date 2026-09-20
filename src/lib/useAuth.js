import { useEffect, useState } from 'react'
import { supabase, createIsolatedClient } from './supabase'
import { DEMO_MODE } from './data'
import { can, normalizeRole } from './permissions'

// Troca de senha a partir da tela de login: autentica com a senha atual (a que
// o sistema gerou) e grava a nova. Roda num cliente isolado para não deixar o
// app autenticado no meio do caminho — ver createIsolatedClient.
export async function trocarSenha(email, senhaAtual, senhaNova) {
  const tmp = createIsolatedClient()
  if (!tmp) return { error: { message: 'Autenticação não configurada neste ambiente.' } }
  try {
    const { error: erroLogin } = await tmp.auth.signInWithPassword({ email, password: senhaAtual })
    if (erroLogin) return { error: erroLogin }
    const { error: erroGravacao } = await tmp.auth.updateUser({ password: senhaNova })
    return { error: erroGravacao || null }
  } finally {
    // encerra a sessão temporária mesmo se algo acima falhar
    await tmp.auth.signOut().catch(() => {})
  }
}

// Em modo demonstração não há login: o papel fica no navegador para dar para
// conferir como cada perfil vê o sistema.
const DEMO_ROLE_KEY = 'leadrix-demo-role'
const demoRole = () => {
  try {
    return normalizeRole(localStorage.getItem(DEMO_ROLE_KEY) || 'admin')
  } catch {
    return 'admin'
  }
}

export function setDemoRole(role) {
  try {
    localStorage.setItem(DEMO_ROLE_KEY, normalizeRole(role))
  } catch {
    /* ignore */
  }
  window.location.reload()
}

// Hook de sessão do Supabase Auth. Em modo demo não há auth (retorna liberado).
export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(!DEMO_MODE)

  useEffect(() => {
    if (DEMO_MODE) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const user = session?.user || null
  // O papel vem de app_metadata (definido pelo admin, não editável pelo usuário).
  const role = DEMO_MODE
    ? demoRole()
    : normalizeRole(user?.app_metadata?.role || user?.user_metadata?.role)

  return {
    session,
    loading,
    user,
    role,
    isAdmin: role === 'admin',
    can: (action) => can(role, action),
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    isAuthenticated: DEMO_MODE || Boolean(session),
  }
}
