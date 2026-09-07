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
