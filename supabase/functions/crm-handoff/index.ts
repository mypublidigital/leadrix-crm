// Edge Function: dispara o handoff do CRM → Consulcard Projetos (briefing §9).
// - Monta o payload a partir da conta + serviços de interesse.
// - Assina com HMAC-SHA256, envia com idempotência (external_id) e retry/backoff.
// - Grava project_id/project_url no deal e loga em webhook_logs.
//
// Body esperado: { accountId, manager_email, contract_value_brl, billing_model, segment, size, name }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signBody, corsHeaders } from '../_shared/hmac.ts'

const ONBOARDING_URL = Deno.env.get('OPERACIONAL_ONBOARDING_URL')!
const SECRET = Deno.env.get('CRM_WEBHOOK_SECRET')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const BACKOFF_MS = [1000, 5000, 30000, 300000]

// Infere macro_category/project_type/complexity do serviço-âncora de maior valor.
function pickProject(accountServices: any[]) {
  if (!accountServices.length) return null
  const sorted = [...accountServices].sort(
    (a, b) => (b.service?.anchor ? 1 : 0) - (a.service?.anchor ? 1 : 0) ||
      Number(b.estimated_value_brl) - Number(a.estimated_value_brl),
  )
  const top = sorted[0].service
  return {
    macro_category: top.macro_id,
    project_type: top.service_id,
    complexity: top.complexity,
    size: `P${top.complexity}`,
  }
}

async function postWithRetry(rawBody: string): Promise<Response> {
  const ts = Math.floor(Date.now() / 1000).toString()
  const signature = await signBody(SECRET, rawBody, ts)
  let lastErr: unknown
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const res = await fetch(ONBOARDING_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Consulcard-Signature': signature,
          'X-Consulcard-Timestamp': ts,
        },
        body: rawBody,
      })
      // 2xx (inclui 200 idempotente) → sucesso; 4xx → não adianta retry
      if (res.status < 500) return res
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (e) {
      lastErr = e
    }
    if (attempt < BACKOFF_MS.length) await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]))
  }
  throw lastErr
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    const input = await req.json()
    const { data: account } = await supabase
      .from('accounts')
      .select('*, contacts(*), account_services(*, service:services(*))')
      .eq('id', input.accountId)
      .single()
    if (!account) return json({ ok: false, error: 'conta não encontrada' }, 404)

    const project = pickProject(account.account_services || [])
    const externalId = `deal-${account.id}`

    const payload = {
      external_id: externalId,
      name: input.name || `Projeto — ${account.name}`,
      client: {
        legal_name: account.name,
        trade_name: account.trade_name,
        cnpj: account.cnpj,
        segment: input.segment || account.segment,
        size: input.size || account.account_size,
        contacts: (account.contacts || []).map((c: any) => ({
          name: c.name, role: c.role, email: c.email, phone: c.phone,
        })),
      },
      project: {
        macro_category: project?.macro_category,
        project_type: project?.project_type,
        size: project?.size,
        complexity: project?.complexity,
        manager_email: input.manager_email,
        start_date: new Date().toISOString().slice(0, 10),
        tags: account.macro_categories || [],
      },
      commercial: {
        contract_value_brl: input.contract_value_brl,
        billing_model: input.billing_model || 'milestone',
        signed_at: new Date().toISOString(),
      },
      source: { crm: 'consulcard-crm', deal_url: `https://crm.consulcard.com.br/contas/${account.id}` },
    }

    const rawBody = JSON.stringify(payload)
    const res = await postWithRetry(rawBody)
    const body = await res.json().catch(() => ({}))

    // upsert do deal (idempotência por external_handoff_id)
    const dealRow = {
      account_id: account.id,
      title: payload.name,
      stage: 'fechado',
      value_brl: input.contract_value_brl,
      manager_email: input.manager_email,
      macro_category: project?.macro_category,
      project_type: project?.project_type,
      complexity: project?.complexity,
      signed_at: payload.commercial.signed_at,
      external_handoff_id: externalId,
      handoff_status: body.ok ? 'sucesso' : 'erro',
      project_id: body.project_id ?? null,
      project_url: body.project_url ?? null,
    }
    const { data: deal } = await supabase
      .from('deals')
      .upsert(dealRow, { onConflict: 'external_handoff_id' })
      .select('id')
      .single()

    await supabase.from('accounts').update({ crm_stage: 'fechado', health: 'verde' }).eq('id', account.id)
    await supabase.from('webhook_logs').insert({
      direction: 'out', deal_id: deal?.id, endpoint: ONBOARDING_URL,
      status_code: res.status, request: payload, response: body,
    })

    return json({ ok: body.ok ?? res.ok, ...body }, res.status)
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
