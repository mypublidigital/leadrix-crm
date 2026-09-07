import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { DEMO_MODE } from './data'

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
