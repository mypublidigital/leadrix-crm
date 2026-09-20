// Edge Function: webhook de retorno do operacional (briefing §9.7).
// O sistema de projetos notifica mudanças de status do projeto; o CRM atualiza a
// saúde da conta no pós-venda. Autenticado por HMAC (mesmo segredo do handoff).
//
// POST { project_id, external_id, status, timestamp }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verifyBody, corsHeaders } from '../_shared/hmac.ts'

const SECRET = Deno.env.get('CRM_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const raw = await req.text()
  const sig = req.headers.get('X-Leadrix-Signature') || ''
  const ts = req.headers.get('X-Leadrix-Timestamp') || ''
  if (!(await verifyBody(SECRET, raw, ts, sig))) {
    return json({ ok: false, error: 'assinatura inválida' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    const { external_id, status } = JSON.parse(raw)
    const { data: deal } = await supabase
      .from('deals')
      .select('id, account_id')
      .eq('external_handoff_id', external_id)
      .single()

    if (deal) {
      // Pós-venda: registra a mudança de status do projeto. (A "Saúde" foi
      // substituída pelo termômetro comercial, que é pré-venda; o histórico de
      // status fica no log para acompanhamento.)
      await supabase.from('webhook_logs').insert({
        direction: 'in', deal_id: deal.id, endpoint: '/projects/status',
        status_code: 200, request: { external_id, status },
      })
    }
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
