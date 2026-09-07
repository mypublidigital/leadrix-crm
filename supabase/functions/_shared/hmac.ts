// HMAC-SHA256 do corpo bruto + timestamp (briefing §9.5).
// Assinatura: sha256={hex(HMAC(secret, `${timestamp}.${rawBody}`))}

export async function signBody(secret: string, rawBody: string, timestamp: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`))
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `sha256=${hex}`
}

export async function verifyBody(
  secret: string,
  rawBody: string,
  timestamp: string,
  signature: string,
  maxSkewSec = 300,
): Promise<boolean> {
  const ts = Number(timestamp)
  if (!ts || Math.abs(Date.now() / 1000 - ts) > maxSkewSec) return false
  const expected = await signBody(secret, rawBody, timestamp)
  // comparação de tempo constante simples
  if (expected.length !== signature.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  return diff === 0
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
