// Geração de conteúdo integrada ao ABM: blog posts, posts de LinkedIn,
// carrosséis de Instagram e e-mails 1:1.
//
// - Produção: Edge Function `crm-content` (Claude) recebe o briefing e o
//   contexto (voz da marca, mercado, pilar, conta) montado AQUI — a Edge
//   Function não precisa conhecer a taxonomia.
// - Demo: modelos determinísticos com a mesma estrutura, para validar o fluxo
//   sem chave de API. `variant` alterna as aberturas ao pedir "Gerar outra".

import { DEMO_MODE, invokeFn } from './data'
import { MARKETS, PILLARS, BRAND_VOICE } from '../data/leadrix'
import { ABM_THEORY, CONTENT_FORMATS } from '../data/abmPlaybook'
import { CRM_STAGES } from './constants'

export { CONTENT_FORMATS }

export const CONTENT_STATUS = {
  rascunho: { label: 'Rascunho', color: 'bg-ink-100 text-ink-600' },
  revisao: { label: 'Em revisão', color: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', color: 'bg-sky-100 text-sky-700' },
  publicado: { label: 'Publicado', color: 'bg-emerald-100 text-emerald-700' },
}

// Estágio do funil → objetivo de conteúdo (topo, meio, fundo, expansão).
export const FUNNEL_OBJECTIVE = {
  lead: 'Topo: gerar reconhecimento do problema e autoridade da Leadrix.',
  qualificado: 'Meio: ajudar a conta a priorizar e mostrar o método.',
  proposta: 'Fundo: reduzir risco percebido com prova e governança.',
  negociacao: 'Fundo: dar segurança ao comitê para decidir.',
  standby: 'Reativação: trazer um fato novo e relevante.',
  fechado: 'Expansão: mostrar resultado e o próximo pilar.',
}

/** Contexto enviado ao agente de conteúdo (e usado pelos modelos demo). */
export function buildContentContext(brief, account) {
  const market = MARKETS[brief.segment] || null
  const pillar = PILLARS[brief.pillar] || null
  return {
    marca: {
      nome: 'Leadrix',
      o_que_faz: 'Consultoria que transforma inteligência artificial em decisões, processos, capacidades e crescimento para empresas médias e grandes, na interseção entre gestão, pessoas e tecnologia.',
      voz: BRAND_VOICE,
    },
    abm: { principios: ABM_THEORY.principles, niveis: ABM_THEORY.tiers },
    mercado: market && {
      nome: market.label,
      microssegmento: brief.micro_segment || null,
      decisores: market.personas,
      dores: market.pains,
      indicadores: market.indicators,
      caso_de_uso_do_pilar: pillar ? market.useCases[pillar.id] : null,
      porta_de_entrada: market.entry,
    },
    pilar: pillar && { nome: pillar.label, promessa: pillar.promise, resolve: pillar.solves, entregas: pillar.deliverables },
    conta: account && brief.personalize
      ? {
          nome: account.name,
          nivel_abm: account.abm_tier || null,
          contatos: (account.contacts || []).map((c) => ({ nome: c.name, cargo: c.role })),
          estrategia: account.account_strategy?.[0] || null,
        }
      : null,
    etapa_funil: brief.stage ? { etapa: CRM_STAGES[brief.stage]?.label, objetivo: FUNNEL_OBJECTIVE[brief.stage] } : null,
  }
}

export async function generateContent(brief, account) {
  const context = buildContentContext(brief, account)
  if (!DEMO_MODE) {
    const data = await invokeFn('crm-content', { brief, context })
    return { ...data, generated_by: 'ia' }
  }
  await new Promise((r) => setTimeout(r, 700))
  const gen = TEMPLATES[brief.format] || TEMPLATES.linkedin
  return { ...gen(brief, context, account), generated_by: 'modelo' }
}

// ── Modelos demo ────────────────────────────────────────────────
const pick = (arr, n) => arr[Math.abs(n) % arr.length]
// Minúscula só na primeira letra — e nunca em sigla/marca ("SaaS", "TI").
const lower1 = (s) => (s && !/^.[A-Z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

// Como chamar o público no texto: "consultorias", "empresas de moda e calçados"…
const PLURAL_TYPES = /^(consultorias|assessorias|agências|escritórios|serviços profissionais|fintechs|healthtechs|edtechs|logtechs|óticas|farmácias|supermercados|franquias)/i
const MARKET_AUDIENCE = {
  'servicos-b2b': 'empresas de serviços B2B',
  industria: 'indústrias',
  'varejo-franquias': 'redes de varejo e franquias',
  'empresas-digitais': 'empresas digitais',
}
const firstName = (s) => String(s || '').trim().split(/\s+/)[0] || ''

function scope(brief, ctx) {
  const micro = brief.micro_segment || null
  const marketName = ctx.mercado?.nome || 'empresas médias e grandes'
  return {
    audience: micro
      ? (PLURAL_TYPES.test(micro) ? lower1(micro) : `empresas de ${lower1(micro)}`)
      : MARKET_AUDIENCE[brief.segment] || lower1(marketName),
    audienceTitle: micro || marketName,
    pains: ctx.mercado?.dores || ['Processos manuais que consomem margem', 'Uso de IA disperso e sem método', 'Pilotos que não escalam'],
    indicators: ctx.mercado?.indicadores || ['Margem', 'Capacidade', 'Qualidade', 'Risco', 'Receita'],
    useCase: ctx.mercado?.caso_de_uso_do_pilar || ctx.pilar?.promessa || 'aplicar IA com método e governança',
    pillar: ctx.pilar,
    persona: brief.persona || ctx.mercado?.decisores?.[0] || 'liderança executiva',
  }
}

const hashtagsFor = (brief, ctx) => {
  const base = ['#InteligenciaArtificial', '#IAAplicada', '#Gestao']
  const byPillar = {
    'estruturas-hibridas': '#OrganizacaoHibrida',
    'agentes-processos': '#AgentesDeIA',
    'educacao-adocao': '#AdocaoDeIA',
    'novos-negocios': '#NovosNegocios',
  }
  const byMarket = {
    'servicos-b2b': '#ServicosB2B', industria: '#Industria', 'varejo-franquias': '#Varejo', 'empresas-digitais': '#EmpresasDigitais',
  }
  return [...base, byPillar[brief.pillar], byMarket[brief.segment]].filter(Boolean)
}

const TEMPLATES = {
  blog(brief, ctx) {
    const s = scope(brief, ctx)
    const v = brief.variant || 0
    const title = brief.angle && brief.angle.length < 90
      ? brief.angle.replace(/\.$/, '')
      : pick([
          `IA em ${s.audience}: o que muda quando o método vem antes da ferramenta`,
          `${s.audienceTitle}: como priorizar iniciativas de IA por margem, capacidade e risco`,
          `Da planilha ao agente: um roteiro realista de IA para ${s.audience}`,
        ], v)
    const pillarName = s.pillar?.nome || 'os quatro pilares da Leadrix'
    const body = [
      `# ${title}`,
      '',
      `A pergunta que mais ouvimos em ${s.audience} é "qual ferramenta de IA vamos usar?". A pergunta certa é outra: **o que muda na operação, na decisão e no resultado?** Quando a resposta não está clara, a IA vira mais uma camada de complexidade — e o investimento não aparece em nenhum indicador.`,
      '',
      `## O problema real`,
      '',
      `Em conversas com executivos deste mercado (${s.persona}), três tensões aparecem com frequência:`,
      '',
      ...s.pains.slice(0, 3).map((p) => `- **${p}.**`),
      '',
      `Nenhuma delas se resolve comprando licença. Todas passam por redesenhar como o trabalho acontece.`,
      '',
      `## Por que ferramenta sozinha não resolve`,
      '',
      `O risco não é deixar de usar IA. O risco é usar IA sem método e chamar isso de inovação. Pilotos isolados competem por dados e atenção, cada área escolhe uma solução e ninguém consegue comparar resultado. Por isso partimos de um princípio simples: **negócio antes da tecnologia** — problema, consequência e indicador orientam a escolha técnica.`,
      '',
      `## Como abordamos: ${pillarName}`,
      '',
      s.pillar ? `${s.pillar.promessa} Na prática, para ${s.audience}, isso significa ${lower1(s.useCase)}.` : `Trabalhamos quatro pilares conectados: estruturas organizacionais híbridas, agentes e processos automatizados, educação e adoção produtiva e novos negócios.`,
      '',
      ...(s.pillar ? ['O trabalho costuma incluir:', '', ...s.pillar.entregas.map((d) => `- ${d}`), ''] : []),
      `## Indicadores que mostram se está funcionando`,
      '',
      `Sem indicador não há decisão. Para ${s.audience}, os que mais pesam são:`,
      '',
      ...s.indicators.map((i) => `- ${i}`),
      '',
      `Defina a linha de base antes de começar. É ela que transforma "achamos que melhorou" em resultado mensurável.`,
      '',
      `## Por onde começar`,
      '',
      `1. **Diagnóstico:** mapear processos, decisões e dados, e estimar impacto em margem, capacidade, qualidade, risco e receita.`,
      `2. **Priorização:** classificar as iniciativas em fazer primeiro, testar, escalar ou evitar.`,
      `3. **Piloto acompanhado:** implantar com responsáveis, supervisão humana e critério de escala definidos desde o início.`,
      `4. **Adoção:** formar as pessoas que vão operar o novo processo, com playbook e indicadores por função.`,
      '',
      `## Conclusão`,
      '',
      `IA gera resultado quando entra como parte do desenho da organização, não como projeto paralelo. Se a liderança consegue apontar o indicador que vai mudar, o caminho está certo. ${BRAND_VOICE.closer}`,
      '',
      `**Agende um diagnóstico com a Leadrix.**`,
    ].join('\n')
    return {
      title,
      body,
      meta_description: `Como ${s.audience} podem aplicar IA com método: dores reais, indicadores e um roteiro em quatro passos, do diagnóstico à adoção.`.slice(0, 158),
      hashtags: hashtagsFor(brief, ctx),
      cta: 'Agendar diagnóstico',
    }
  },

  linkedin(brief, ctx) {
    const s = scope(brief, ctx)
    const v = brief.variant || 0
    const hook = pick([
      `A maioria das iniciativas de IA em ${s.audience} não falha por tecnologia. Falha por falta de método.`,
      `"Qual ferramenta de IA vamos usar?" é a pergunta errada para ${s.audience}.`,
      `${s.pains[0]}. Soa familiar?`,
    ], v)
    const body = [
      hook,
      '',
      `Conversando com executivos deste mercado (${s.persona}), o padrão se repete:`,
      '',
      ...s.pains.slice(0, 3).map((p) => `→ ${p}`),
      '',
      `A pergunta certa é: o que muda na operação, na decisão e no resultado?`,
      '',
      s.pillar
        ? `É aqui que entra ${s.pillar.nome.toLowerCase()}: ${lower1(s.useCase)}, com supervisão humana e indicador definido antes de começar.`
        : `É aqui que entram os quatro pilares conectados: estruturas híbridas, agentes e processos, educação e adoção, novos negócios.`,
      '',
      `O que medir: ${s.indicators.slice(0, 3).map(lower1).join(', ')}.`,
      '',
      `Sem hype. Com método, governança e resultado mensurável.`,
      '',
      `Qual desses indicadores mais pesa na sua operação este ano?`,
    ].join('\n')
    return { title: hook, body, hashtags: hashtagsFor(brief, ctx), cta: 'Comentar ou falar com a Leadrix' }
  },

  instagram(brief, ctx) {
    const s = scope(brief, ctx)
    const slides = [
      `IA em ${s.audience}: comece pela pergunta certa`,
      `A pergunta errada: "qual ferramenta vamos usar?"`,
      `A pergunta certa: "o que muda na operação, na decisão e no resultado?"`,
      `O que trava hoje:\n${s.pains.slice(0, 3).map((p) => `• ${p}`).join('\n')}`,
      s.pillar ? `${s.pillar.nome}\n${s.pillar.promessa}` : 'Quatro pilares conectados: organizar, automatizar, educar e crescer.',
      `O que medir:\n${s.indicators.slice(0, 4).map((i) => `• ${i}`).join('\n')}`,
      `Diagnóstico antes da solução. Sempre.\nLeadrix — Lidere seu mercado com IA`,
    ]
    const body = [
      ...slides.map((t, i) => `**Slide ${i + 1}**\n${t}`),
      '',
      '**Legenda**',
      `IA sem método vira custo. Em ${s.audience}, o ganho aparece quando problema, consequência e indicador vêm antes da ferramenta. Arraste para ver por onde começar e fale com a Leadrix para um diagnóstico.`,
    ].join('\n\n')
    return { title: slides[0], body, hashtags: hashtagsFor(brief, ctx), cta: 'Agendar diagnóstico' }
  },

  email(brief, ctx, account) {
    const s = scope(brief, ctx)
    const v = brief.variant || 0
    const contact = (account?.contacts || []).find((c) => brief.persona && String(c.role || '').toLowerCase().includes(String(brief.persona).split(' ').pop().toLowerCase()))
      || (account?.contacts || []).find((c) => c.is_primary) || null
    const name = firstName(contact?.name) || 'tudo bem'
    const company = brief.personalize && account ? account.name : `sua empresa`
    const subject = pick([
      `${s.indicators[0]} em ${company}: uma pergunta antes de falar de IA`,
      `Ideia para ${company} sobre ${lower1(s.pains[0]).slice(0, 60)}`,
      `${company} + IA com método: 30 minutos?`,
    ], v)
    const body = [
      `Assunto: ${subject}`,
      '',
      `Olá, ${name}.`,
      '',
      `Tenho acompanhado ${s.audience} e um ponto aparece em quase toda conversa: ${lower1(s.pains[0])}.`,
      '',
      `Na Leadrix, antes de qualquer ferramenta, olhamos para o indicador que precisa mudar — ${lower1(s.indicators[0])}, ${lower1(s.indicators[1] || s.indicators[0])} — e desenhamos o caminho a partir dele.`,
      '',
      s.pillar ? `Para ${company}, imagino que o ponto de partida seja ${lower1(s.useCase)}.` : '',
      '',
      `Faz sentido reservarmos 30 minutos para um diagnóstico rápido? Se não for o momento, me diga e retomo em outra data.`,
      '',
      `Um abraço,`,
      `Equipe Leadrix`,
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n')
    return { title: subject, body, hashtags: [], cta: 'Agendar diagnóstico' }
  },
}
