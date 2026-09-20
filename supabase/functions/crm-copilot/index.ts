// Edge Function: co-piloto ABM conversacional da conta.
//
// Body: { accountId, messages: [{role:'user'|'assistant', content}] }
// A conta é lida do banco (fonte de verdade); o conhecimento fixo da Leadrix,
// dos pilares, dos mercados e de ABM vai no system prompt cacheado.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/hmac.ts'
import { requireUser, authErrorResponse } from '../_shared/auth.ts'
import { askClaude, errorMessage } from '../_shared/claude.ts'
import { LEADRIX_KNOWLEDGE } from '../_shared/leadrix-knowledge.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const ROLE = `Você é o co-piloto de ABM da Leadrix, usado pelo time comercial dentro do CRM.

Como responder:
- Considere sempre a conta na tela: mercado, microssegmento, nível ABM, comitê de compra mapeado, oportunidades por pilar e etapa, histórico de interações e estratégia.
- Ensine o raciocínio de ABM por trás da recomendação, sem aula longa.
- Termine com próximas ações concretas (quem, qual canal, qual mensagem, qual indicador).
- Quando faltar informação para recomendar bem, diga o que falta em vez de supor.
- Markdown leve (negrito e listas). Português do Brasil.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // A chave anon é pública: exige usuário logado, não só um JWT válido.
    await requireUser(req)
    const { accountId, messages = [] } = await req.json()
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
    const { data: a } = await supabase
      .from('accounts')
      .select('name, classification, segment, micro_segment, abm_tier, entry_door, account_size, site, contacts(name, role), account_strategy(*), account_services(stage, estimated_value_brl, stage_entered_at, service:services(name, macro_label)), interactions(summary, date)')
      .eq('id', accountId)
      .single()

    const ctx = a
      ? {
          conta: a.name,
          classificacao: a.classification,
          mercado: a.segment,
          microssegmento: a.micro_segment,
          nivel_abm: a.abm_tier,
          porta_de_entrada: a.entry_door,
          porte: a.account_size,
          site: a.site,
          contatos: a.contacts,
          estrategia: a.account_strategy?.[0] || null,
          oportunidades: (a.account_services || []).map((s: any) => ({
            servico: s.service?.name, pilar: s.service?.macro_label, etapa: s.stage,
            valor: s.estimated_value_brl, na_etapa_desde: s.stage_entered_at,
          })),
          interacoes_recentes: (a.interactions || [])
            .sort((x: any, y: any) => String(y.date).localeCompare(String(x.date)))
            .slice(0, 8)
            .map((i: any) => i.summary),
        }
      : { aviso: 'conta não encontrada' }

    const { text } = await askClaude({
      knowledge: `${ROLE}\n\n${LEADRIX_KNOWLEDGE}`,
      context: `# Conta na tela (hoje: ${new Date().toISOString().slice(0, 10)})\n${JSON.stringify(ctx, null, 2)}`,
      messages: messages.filter((m: any) => m.role === 'user' || m.role === 'assistant').map((m: any) => ({ role: m.role, content: String(m.content) })),
      maxTokens: 4000,
      effort: 'medium',
    })
    return json({ reply: text || 'Não consegui gerar uma resposta.' })
  } catch (e) {
    const denied = authErrorResponse(e, corsHeaders)
    if (denied) return denied
    return json({ error: errorMessage(e) }, 500)
  }
})

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
