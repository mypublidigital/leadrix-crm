// Edge Function: catálogo de serviços do CRM (fonte de verdade — §10 + decisão da
// reunião de que o CRM é onde os serviços são mantidos). O sistema de projetos
// CONSOME este endpoint para manter as mesmas nomenclaturas/taxonomia.
//
//   GET /functions/v1/catalog
//   Auth: header  X-Catalog-Key: <CRM_CATALOG_KEY>   (para o operacional)
//         ou  Authorization: Bearer <JWT de usuário CRM>  (para o botão de teste)
//
// Resposta: { version, generated_at, count, services: [...] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/hmac.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const CATALOG_KEY = Deno.env.get('CRM_CATALOG_KEY') || ''

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { ...corsHeaders, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-catalog-key' } })

  // Autoriza: chave compartilhada (operacional) OU usuário CRM autenticado (teste).
  const providedKey = req.headers.get('X-Catalog-Key') || ''
  let authorized = CATALOG_KEY && providedKey === CATALOG_KEY
  if (!authorized) {
    const authHeader = req.headers.get('Authorization') || ''
    if (authHeader.startsWith('Bearer ')) {
      const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
      const { data: { user } } = await caller.auth.getUser()
      authorized = Boolean(user)
    }
  }
  if (!authorized) return json({ error: 'não autorizado' }, 401)

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  const { data, error } = await supabase
    .from('services')
    .select('service_id, name, macro_id, macro_label, complexity, complexity_range, anchor, suggested_value_brl, active')
    .eq('active', true)
    .order('macro_label')
  if (error) return json({ error: String(error.message) }, 500)

  return json({
    version: 1,
    source: 'leadrix-crm',
    generated_at: new Date().toISOString(),
    count: data.length,
    services: data,
  })
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
