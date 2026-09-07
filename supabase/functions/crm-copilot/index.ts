// Edge Function: co-piloto ABM conversacional (briefing §8.5).
// Modelo: última versão do Claude Sonnet. Base de conhecimento embutida no system
// prompt (ABM + Consulcard + catálogo de serviços). Respostas didáticas.
//
// Body: { accountId, messages: [{role:'user'|'assistant', content}] }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/hmac.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const MODEL = Deno.env.get('ANTHROPIC_COPILOT_MODEL') || 'claude-sonnet-4-6'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const KNOWLEDGE = `Você é o co-piloto de ABM da Consulcard.

# Sobre a Consulcard
Consultoria especializada em mercado financeiro, meios de pagamento, banking e
regulatório (BACEN/COSIF). Atua como parceira estratégica de fintechs, bancos,
cooperativas, instituições de pagamento e sociedades de crédito. O ERP Consulcard
tem dois módulos: o CRM (relacionamento/ABM, upstream) e o Consulcard Projetos
(execução dos projetos, downstream — recebe o handoff no fechamento).

# Metodologia ABM (Account Based Marketing)
Cada cliente é uma conta-alvo com estratégia individual. Princípios:
- A conta é a unidade de trabalho; nada é genérico.
- Toques planejados conta a conta (ligação, reunião, almoço, evento, conteúdo,
  podcast, landing page, viagem).
- Funil: lead → qualificado → proposta → negociação → fechado (→ stand by/perdido).
- Foco em decisores e influenciadores; relacionamento de longo prazo.

# Catálogo de serviços (âncoras têm ticket alto)
Contábil/Regulatório (setup-contabil âncora, revisao-cosif, mapeamento-bacen),
Meios de Pagamento (emissor-cartao âncora, migracao-processadora,
estruturacao-adquirencia, setup-bandeira, operacao-cartao, otimizacao-tarifas),
Banking/Conta Digital (baas âncora, conta-digital, pld-aml, kyc-onboarding),
Consultoria Estratégica (diagnostico, estrategia-produto, modelo-negocio,
transformacao-digital), Open Finance (pix-implantacao, open-finance-assessoria),
Revisão Operacional (mandates-bandeira, suporte-regulatorio).

# Como responder
- Seja DIDÁTICO e EXPLICATIVO: ensine o raciocínio de ABM, não só a resposta.
- Sempre considere o contexto da conta na tela (estágio, serviços de interesse,
  histórico de interações, estratégia).
- Sugira próximas ações concretas e acionáveis.
- Use markdown leve (negrito, listas). Responda em português do Brasil.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
  try {
    const { accountId, messages = [] } = await req.json()
    const { data: a } = await supabase
      .from('accounts')
      .select('*, contacts(*), account_strategy(*), account_services(*, service:services(*)), interactions(*), tasks(*)')
      .eq('id', accountId)
      .single()

    const ctx = a
      ? {
          conta: a.name, classificacao: a.classification, estagio: a.crm_stage,
          segmento: a.segment, porte: a.account_size,
          termometro_comercial: a.commercial_temp != null ? `${a.commercial_temp}%` : null,
          macro_categorias: a.macro_categories,
          estrategia: a.account_strategy?.[0] || null,
          servicos_interesse: (a.account_services || []).map((s: any) => ({ servico: s.service?.name, valor: s.estimated_value_brl, interesse: s.interest })),
          contatos: (a.contacts || []).map((c: any) => ({ nome: c.name, cargo: c.role, email: c.email })),
          interacoes_recentes: (a.interactions || []).slice(0, 8).map((i: any) => i.summary),
        }
      : { aviso: 'conta não encontrada' }

    const system = `${KNOWLEDGE}\n\n# Contexto da conta na tela\n${JSON.stringify(ctx, null, 2)}`

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1500,
        system,
        messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      }),
    })
    const data = await resp.json()
    const reply = data?.content?.[0]?.text || 'Não consegui gerar uma resposta.'
    return json({ reply })
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
