// Edge Function: captura de lead por foto (pré-CRM — reunião 13/07).
// Recebe { image_base64, media_type }, sobe a foto no bucket 'captures',
// extrai nome/empresa/cargo/e-mail/telefone com Claude (visão) e grava na
// pré-base (pre_leads). Retorna a linha criada.
//
// Cenário: feira/evento — tira foto do cartão de visita, da tela de contato
// do WhatsApp ou do crachá; sobe com calma depois; a IA estrutura os dados.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/hmac.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = Deno.env.get('ANTHROPIC_CAPTURE_MODEL') || 'claude-haiku-4-5-20251001'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const PROMPT = `A imagem é um cartão de visita, uma tela de contato (WhatsApp/celular) ou um crachá, capturado num evento de negócios no Brasil.
Extraia os dados de contato. Responda SOMENTE com JSON válido, sem markdown:
{"name": "...", "company": "...", "role": "...", "email": "...", "phone": "...", "notes": "..."}
Regras: campos não visíveis → null. "phone" no formato +55 quando possível. "notes" = qualquer outra informação útil visível (site, cidade, segmento). Não invente dados.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const admin = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    // identifica o usuário (verify_jwt já garante autenticação)
    const authHeader = req.headers.get('Authorization') || ''
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await caller.auth.getUser()

    const { image_base64, media_type = 'image/jpeg' } = await req.json()
    if (!image_base64) return json({ error: 'image_base64 obrigatório' }, 400)

    // 1) sobe a foto no bucket privado
    const ext = media_type.includes('png') ? 'png' : 'jpg'
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`
    const bytes = Uint8Array.from(atob(image_base64), (c) => c.charCodeAt(0))
    const { error: upErr } = await admin.storage.from('captures').upload(path, bytes, { contentType: media_type })
    if (upErr) throw upErr

    // 2) extrai os dados com Claude (visão)
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    })
    const ai = await resp.json()
    const text = ai?.content?.[0]?.text || '{}'
    let extracted: Record<string, unknown> = {}
    try {
      // pega o primeiro bloco {...} mesmo que venha com cercas/comentários ao redor
      const match = text.match(/\{[\s\S]*?\}/)
      extracted = JSON.parse(match ? match[0] : text)
    } catch {
      extracted = { notes: text }
    }

    // 3) grava na pré-base
    const { data: row, error } = await admin
      .from('pre_leads')
      .insert({
        photo_path: path,
        name: extracted.name ?? null,
        company: extracted.company ?? null,
        role: extracted.role ?? null,
        email: extracted.email ?? null,
        phone: extracted.phone ?? null,
        notes: extracted.notes ?? null,
        raw_extraction: extracted,
        created_by: user?.id ?? null,
      })
      .select('*')
      .single()
    if (error) throw error

    return json({ ok: true, pre_lead: row })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
