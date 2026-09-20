// Edge Function: envia o e-mail da fila pela conta Gmail da Leadrix.
//
// Body: { messageId, to, toName, fromAlias, subject, body }
//
// Credenciais (Edge Function Secrets), obtidas uma vez no Google Cloud:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET  — OAuth client (tipo "Desktop app")
//   GMAIL_REFRESH_TOKEN                   — gerado com o escopo
//                                           https://www.googleapis.com/auth/gmail.send
//   GMAIL_SENDER                          — e-mail da caixa (ex.: marcelo@leadrix.com.br)
//
// O alias remetente precisa estar cadastrado no Gmail (Configurações → Contas →
// "Enviar e-mail como") e verificado; o Google recusa um From não autorizado.
//
// Sem credencial configurada, devolve 400 com a explicação: a mensagem fica na
// fila do CRM com o erro visível, em vez de sumir.

import { corsHeaders } from '../_shared/hmac.ts'
import { requireUser, authErrorResponse } from '../_shared/auth.ts'

const CLIENT_ID = Deno.env.get('GMAIL_CLIENT_ID')
const CLIENT_SECRET = Deno.env.get('GMAIL_CLIENT_SECRET')
const REFRESH_TOKEN = Deno.env.get('GMAIL_REFRESH_TOKEN')
const SENDER = Deno.env.get('GMAIL_SENDER') || 'marcelo@leadrix.com.br'

async function accessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`Não foi possível autenticar no Gmail (${data.error || res.status}). Refaça o refresh token.`)
  }
  return data.access_token as string
}

// Cabeçalho com acento precisa de MIME encoded-word (RFC 2047).
function encodeHeader(value: string) {
  return /[^\x20-\x7E]/.test(value)
    ? `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(value)))}?=`
    : value
}

function rawMessage({ to, toName, from, fromName, subject, body }: Record<string, string>) {
  const lines = [
    `From: ${fromName ? `${encodeHeader(fromName)} <${from}>` : from}`,
    `To: ${toName ? `${encodeHeader(toName)} <${to}>` : to}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    // Corpo em base64 para não depender de quebra de linha nem escapar acento.
    btoa(String.fromCharCode(...new TextEncoder().encode(body))).replace(/(.{76})/g, '$1\r\n'),
  ]
  const mime = lines.join('\r\n')
  return btoa(String.fromCharCode(...new TextEncoder().encode(mime)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // A chave anon é pública: exige usuário logado, não só um JWT válido.
    await requireUser(req)
    const { to, toName, fromAlias, subject, body, fromName } = await req.json()
    if (!to || !subject) return json({ error: 'Informe destinatário e assunto.' }, 400)

    if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
      return json({
        error: 'Envio de e-mail não configurado: defina GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET e GMAIL_REFRESH_TOKEN nos secrets das Edge Functions.',
      }, 400)
    }

    const token = await accessToken()
    const raw = rawMessage({
      to, toName: toName || '', from: fromAlias || SENDER, fromName: fromName || 'Leadrix', subject, body: body || '',
    })

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    })
    const data = await res.json()
    if (!res.ok) {
      const detail = data?.error?.message || `status ${res.status}`
      // Alias não verificado é o erro mais comum aqui.
      return json({ error: `O Gmail recusou o envio: ${detail}` }, 502)
    }
    return json({ ok: true, provider_message_id: data.id, thread_id: data.threadId })
  } catch (e) {
    const denied = authErrorResponse(e, corsHeaders)
    if (denied) return denied
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
