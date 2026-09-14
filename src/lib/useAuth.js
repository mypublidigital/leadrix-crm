import { useEffect, useState } from 'react'
import { supabase, createIsolatedClient } from './supabase'
import { DEMO_MODE } from './data'

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
  const isAdmin =
    DEMO_MODE ||
    user?.app_metadata?.role === 'admin' ||
    user?.user_metadata?.role === 'admin'

  return {
    session,
    loading,
    user,
    isAdmin,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
    isAuthenticated: DEMO_MODE || Boolean(session),
  }
}
