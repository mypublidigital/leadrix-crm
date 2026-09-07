// Edge Function: cancelamento de deal fechado (briefing §9.8).
// Chama o operacional para mover o projeto para 'closed' com tag 'cancelado'.
// POST { accountId, reason }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signBody, corsHeaders } from '../_shared/hmac.ts'

const CANCEL_URL = Deno.env.get('OPERACIONAL_CANCEL_URL')!
const SECRET = Deno.env.get('CRM_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    const { accountId, reason } = await req.json()
    const { data: deal } = await supabase
      .from('deals')
      .select('id, external_handoff_id')
      .eq('account_id', accountId)
      .eq('stage', 'fechado')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!deal) return json({ ok: false, error: 'deal fechado não encontrado' }, 404)

    const payload = { external_id: deal.external_handoff_id, reason: reason || 'cancelado pelo CRM' }
    const raw = JSON.stringify(payload)
    const ts = Math.floor(Date.now() / 1000).toString()
    const res = await fetch(CANCEL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Consulcard-Signature': await signBody(SECRET, raw, ts),
        'X-Consulcard-Timestamp': ts,
      },
      body: raw,
    })
    const body = await res.json().catch(() => ({}))

    await supabase.from('deals').update({ stage: 'perdido', handoff_status: 'cancelado', lost_reason: reason })
      .eq('id', deal.id)
    await supabase.from('accounts').update({ crm_stage: 'perdido', health: 'vermelho' }).eq('id', accountId)
    await supabase.from('webhook_logs').insert({
      direction: 'out', deal_id: deal.id, endpoint: CANCEL_URL, status_code: res.status,
      request: payload, response: body,
    })
    return json({ ok: true, ...body }, res.status)
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
