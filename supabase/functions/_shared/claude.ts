// Cliente Claude compartilhado pelas Edge Functions (co-piloto e conteúdo).
//
// - Modelo configurável por ANTHROPIC_MODEL (padrão: claude-opus-5).
// - `fallbacks: "default"`: se os classificadores de segurança recusarem o
//   pedido, a própria API reexecuta num modelo substituto em vez de devolver a
//   recusa. Sem isso, um texto de marketing legítimo poderia voltar vazio.
// - O conhecimento fixo (marca, ABM) vai em `system` com cache: o prefixo é o
//   mesmo em toda chamada, então as seguintes leem do cache.

import Anthropic from 'npm:@anthropic-ai/sdk'

const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-5'

let client: Anthropic | null = null
function getClient() {
  if (!client) client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  return client
}

type Msg = { role: 'user' | 'assistant'; content: string }

export async function askClaude(opts: {
  knowledge: string          // bloco estável (cacheado)
  context?: string           // bloco variável (conta, briefing)
  messages: Msg[]
  maxTokens?: number
  effort?: 'low' | 'medium' | 'high'
  jsonSchema?: Record<string, unknown>
}) {
  const system: any[] = [{ type: 'text', text: opts.knowledge, cache_control: { type: 'ephemeral' } }]
  if (opts.context) system.push({ type: 'text', text: opts.context })

  const params: any = {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 8000,
    system,
    messages: opts.messages,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: {
      effort: opts.effort ?? 'medium',
      ...(opts.jsonSchema ? { format: { type: 'json_schema', schema: opts.jsonSchema } } : {}),
    },
  }

  const response = await getClient().beta.messages.create(params)

  if (response.stop_reason === 'refusal') {
    throw new Error('O modelo não gerou este conteúdo. Reformule o briefing e tente de novo.')
  }
  const text = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
  if (response.stop_reason === 'max_tokens' && opts.jsonSchema) {
    throw new Error('A resposta ficou longa demais e foi cortada. Tente um formato mais curto.')
  }
  return { text, model: response.model }
}

export function errorMessage(e: unknown) {
  if (e instanceof Anthropic.RateLimitError) return 'Limite de uso da IA atingido. Tente em alguns instantes.'
  if (e instanceof Anthropic.AuthenticationError) return 'Chave da IA inválida ou ausente (ANTHROPIC_API_KEY).'
  if (e instanceof Anthropic.APIError) return `Falha na IA (${e.status}).`
  return e instanceof Error ? e.message : String(e)
}
