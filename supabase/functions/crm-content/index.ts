// Edge Function: geração de conteúdo ABM (blog, LinkedIn, Instagram, e-mail 1:1).
//
// Body: { brief, context }  — montados em src/lib/content.js
//   brief:   { format, persona, stage, angle, personalize, variant, ... }
//   context: { marca, abm, mercado, pilar, conta, etapa_funil }
// Resposta: { title, body, meta_description, hashtags[], cta }

import { corsHeaders } from '../_shared/hmac.ts'
import { requireUser, authErrorResponse } from '../_shared/auth.ts'
import { askClaude, errorMessage } from '../_shared/claude.ts'
import { LEADRIX_KNOWLEDGE } from '../_shared/leadrix-knowledge.ts'

const ROLE = `Você é o redator sênior de conteúdo da Leadrix, integrado ao programa de Account Based Marketing.
Escreve peças que ajudam uma conta (ou um cluster de contas) a avançar no funil, sempre na voz da marca.

Regras:
- Use as dores, os decisores e os indicadores do mercado informado; nomeie o microssegmento quando houver.
- Conecte o texto ao pilar informado, mostrando o problema de negócio antes da solução.
- Ajuste a profundidade ao objetivo da etapa do funil.
- Nunca invente números, clientes, cases ou depoimentos. Onde um dado ajudaria, escreva de forma qualitativa.
- Conteúdo com dados de uma conta específica só quando o briefing pedir personalização; caso contrário, escreva para o segmento.
- Retorne apenas o JSON pedido.

Formatos:
- blog: 700 a 1.000 palavras em markdown, com um H1, 4 a 6 seções H2, lista onde ajudar a escanear, conclusão com CTA consultivo. meta_description até 155 caracteres.
- linkedin: 900 a 1.500 caracteres, gancho na primeira linha, parágrafos curtos, pergunta final para comentário, 3 a 5 hashtags no campo próprio (não no corpo).
- instagram: carrossel de 6 a 8 slides ("Slide N" + texto curto por slide) seguido de "Legenda" com até 600 caracteres; hashtags no campo próprio.
- email: e-mail 1:1 com a primeira linha "Assunto: ...", até 150 palavras, uma única pergunta ou pedido no final, assinatura "Equipe Leadrix" ou do dono da conta.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'body', 'meta_description', 'hashtags', 'cta'],
  properties: {
    title: { type: 'string', description: 'Título do post, gancho do LinkedIn, primeiro slide ou assunto do e-mail' },
    body: { type: 'string', description: 'Texto completo, pronto para revisão' },
    meta_description: { type: 'string', description: 'Só para blog; vazio nos demais formatos' },
    hashtags: { type: 'array', items: { type: 'string' } },
    cta: { type: 'string' },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // A chave anon é pública: exige usuário logado, não só um JWT válido.
    await requireUser(req)
    const { brief = {}, context = {} } = await req.json()
    if (!['blog', 'linkedin', 'instagram', 'email'].includes(brief.format)) {
      return json({ error: 'Formato inválido.' }, 400)
    }

    const request = [
      `Formato: ${brief.format}`,
      brief.persona ? `Persona-alvo: ${brief.persona}` : null,
      brief.angle ? `Ângulo / mensagem central: ${brief.angle}` : null,
      `Personalizar com dados da conta: ${brief.personalize ? 'sim' : 'não'}`,
      brief.variant ? `Esta é a versão ${Number(brief.variant) + 1}: use uma abertura e uma estrutura diferentes das anteriores.` : null,
    ].filter(Boolean).join('\n')

    const { text } = await askClaude({
      knowledge: `${ROLE}\n\n${LEADRIX_KNOWLEDGE}`,
      context: `# Contexto do briefing\n${JSON.stringify(context, null, 2)}`,
      messages: [{ role: 'user', content: request }],
      maxTokens: 12000,
      effort: 'medium',
      jsonSchema: SCHEMA,
    })

    const out = JSON.parse(text)
    return json({
      title: out.title,
      body: out.body,
      meta_description: brief.format === 'blog' ? out.meta_description : null,
      hashtags: out.hashtags || [],
      cta: out.cta,
    })
  } catch (e) {
    const denied = authErrorResponse(e, corsHeaders)
    if (denied) return denied
    return json({ error: errorMessage(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
