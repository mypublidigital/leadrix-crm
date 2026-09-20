// Playbook de Account Based Marketing da Leadrix.
//
// Três camadas, todas editáveis aqui sem mexer nas telas:
//   1. ABM_THEORY  — o referencial (vai no contexto dos agentes).
//   2. AGING       — SLA por etapa e faixas de aging que disparam sugestões.
//   3. PLAYS       — biblioteca de jogadas: para cada etapa × faixa de aging,
//                    o que fazer, por quê, com quem, quanto custa e que
//                    conteúdo gerar.
//
// A seleção das jogadas para uma oportunidade concreta está em src/lib/abm.js.

export const ABM_THEORY = {
  definition:
    'Account Based Marketing é a estratégia em que marketing e vendas tratam cada conta de alto valor como um mercado próprio: selecionam as contas pelo ICP, entendem o comitê de compra, personalizam a proposta de valor e orquestram toques coordenados em vários canais até a conta avançar.',
  principles: [
    'A conta é a unidade de trabalho: nada é genérico, toda ação responde ao momento daquela conta.',
    'Seleção antes da ação: contas escolhidas por fit (ICP), intenção e potencial, em níveis 1:1, 1:few e 1:many.',
    'Comitê de compra, não contato único: decisões B2B envolvem vários papéis — mapear e cobrir todos (multi-threading).',
    'Insight antes do pitch: pesquisar dores, indicadores e gatilhos da conta e do microssegmento antes de abordar.',
    'Orquestração multicanal: e-mail, LinkedIn, eventos, conteúdo e contato executivo em sequência planejada, não em rajada.',
    'Vendas e marketing alinhados: um plano por conta, metas comuns e leitura compartilhada do aging.',
    'Land and expand: a primeira venda é porta de entrada; a expansão acontece pelos pilares conectados.',
    'Medir engajamento e velocidade, não só volume: cobertura do comitê, tempo por etapa, taxa de avanço e ROI por conta.',
  ],
  tiers: {
    '1:1': 'Contas estratégicas. Plano individual, conteúdo e eventos sob medida, envolvimento de sócios. Investimento alto aceitável.',
    '1:few': 'Clusters de contas com a mesma dor (mesmo microssegmento). Conteúdo e eventos por cluster, personalização leve por conta.',
    '1:many': 'Contas do ICP em escala. Conteúdo por segmento, campanhas programáticas, convites para workshops abertos.',
  },
  buyingCommittee: {
    sponsor: 'Patrocinador econômico (CEO, sócio, diretor de unidade) — defende competitividade, margem, capacidade e crescimento. Evidência útil: memorando executivo, tese de valor e portfólio priorizado.',
    campeao: 'Campeão operacional (COO, operações) — defende produtividade, qualidade e nível de serviço. Evidência útil: mapa do processo, linha de base, meta e piloto.',
    pessoas: 'Pessoas / RH — defende adoção, competências e segurança de uso. Evidência útil: arquitetura de aprendizagem, Playbook e indicadores de adoção.',
    inovacao: 'Inovação, estratégia ou produto — defende priorização, velocidade e passagem para escala. Evidência útil: matriz de portfólio, critérios e plano de experimentação.',
    influenciador: 'CIO, CTO ou segurança — defende arquitetura, dados, integração e risco. Evidência útil: fluxo de dados, controles, integração e modelo de suporte.',
    financeiro: 'CFO / finanças — defende retorno, desembolso e previsibilidade. Evidência útil: justificativa de investimento, premissas e prazo de retorno.',
    bloqueador: 'Jurídico, privacidade ou compras — define limites de uso de dados, responsabilidades, escopo e condições. Evidência útil: matriz de riscos, critérios de aceite e modelo de acompanhamento.',
    usuario: 'Usuário — vive o processo que muda (gerentes, consultores, times de campo).',
  },
  // Uma conta não está desenvolvida enquanto depender de uma única pessoa.
  minimumCoverage: 'Pelo menos três integrantes do grupo decisor: um patrocinador econômico, um responsável operacional e um aprovador técnico ou de risco.',
  metrics: [
    'Cobertura do comitê de compra (personas engajadas / personas esperadas)',
    'Dias por etapa versus SLA (aging)',
    'Taxa de avanço de etapa e taxa de conversão',
    'Custo de venda por oportunidade e ROI por conta',
    'Expansão: receita de pilares adicionais em clientes ativos',
  ],
}

// SLA padrão (dias) em cada etapa. Editável em Config → Custo de venda & ABM.
export const DEFAULT_AGING_SLA = {
  lead: 14,
  qualificado: 21,
  proposta: 14,
  negociacao: 21,
  standby: 45,
  fechado: 60, // no fechado o "aging" conta o tempo desde o ganho → expansão
}

// Faixas de aging como múltiplo do SLA da etapa.
export const AGING_LEVELS = {
  no_prazo: { label: 'No prazo', upTo: 1, color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', weight: 0.4 },
  atencao: { label: 'Atenção', upTo: 2, color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500', weight: 1 },
  critico: { label: 'Crítico', upTo: 3, color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500', weight: 1.8 },
  parado: { label: 'Parado', upTo: Infinity, color: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500', weight: 2.6 },
}
export const AGING_LEVEL_ORDER = ['no_prazo', 'atencao', 'critico', 'parado']

export function agingLevel(days, sla) {
  const ratio = sla > 0 ? days / sla : 0
  const key = AGING_LEVEL_ORDER.find((k) => ratio <= AGING_LEVELS[k].upTo) || 'parado'
  return { key, ratio, ...AGING_LEVELS[key] }
}

// Pilar seguinte recomendado para expansão (os quatro pilares se reforçam).
export const NEXT_PILLAR = {
  'educacao-adocao': 'agentes-processos',
  'agentes-processos': 'estruturas-hibridas',
  'estruturas-hibridas': 'novos-negocios',
  'novos-negocios': 'educacao-adocao',
}

// Formatos do gerador de conteúdo (ver src/lib/content.js).
export const CONTENT_FORMATS = {
  blog: { label: 'Blog post', channel: 'Blog / site', icon: 'Newspaper' },
  linkedin: { label: 'Post LinkedIn', channel: 'LinkedIn', icon: 'Linkedin' },
  instagram: { label: 'Carrossel Instagram', channel: 'Instagram', icon: 'Instagram' },
  email: { label: 'E-mail ABM 1:1', channel: 'E-mail', icon: 'Mail' },
}

// ── Biblioteca de jogadas ───────────────────────────────────────
// stages: etapas em que a jogada vale · levels: faixas de aging
// tiers: níveis ABM em que faz sentido (vazio = todos)
// people: quantas pessoas da Leadrix participam (para o custo estimado)
// expenses: [{ category, qty }] ids das categorias de despesa (Config)
// content: formato + ângulo para o gerador de conteúdo
// role: papel do comitê de compra a ser trabalhado
export const PLAYS = [
  // LEAD ─────────────────────────────────────────────────────────
  {
    id: 'lead-insight-comite',
    title: 'Pesquisa da conta e mapa do comitê de compra',
    stages: ['lead'], levels: ['no_prazo', 'atencao'],
    task_type: 'outro', people: 1, role: 'sponsor',
    objective: 'Sair do contato único para um mapa com sponsor, campeão e influenciador técnico.',
    why: 'Em ABM o insight vem antes do pitch. Sem saber quem decide e qual indicador dói, qualquer abordagem vira genérica e o lead envelhece.',
    steps: [
      'Levantar notícias, vagas abertas e iniciativas digitais da conta nos últimos 6 meses.',
      'Identificar no LinkedIn as personas típicas do mercado e registrar como contatos.',
      'Anotar no caderno de estratégia a dor provável e o indicador que a mede.',
    ],
  },
  {
    id: 'lead-sequencia-personas',
    title: 'Sequência de toques personalizados por persona',
    stages: ['lead'], levels: ['atencao', 'critico'],
    task_type: 'linkedin', people: 1, role: 'campeao',
    objective: 'Abrir conversa com duas personas usando a dor do microssegmento, não a oferta.',
    why: 'Orquestração multicanal: um post de ponto de vista, um convite de conexão comentado e um e-mail curto criam familiaridade sem pressão.',
    steps: [
      'Dia 1: publicar post da Leadrix sobre a dor do microssegmento e marcar interesse.',
      'Dia 3: convite de conexão com nota citando o indicador da área da persona.',
      'Dia 7: e-mail curto oferecendo um diagnóstico de 30 minutos.',
    ],
    content: { format: 'linkedin', angle: 'Ponto de vista sobre a principal dor do microssegmento, com a pergunta certa a fazer antes de escolher ferramenta.' },
  },
  {
    id: 'lead-convite-workshop',
    title: 'Convite nominal para o Workshop Mensal Leadrix',
    stages: ['lead', 'standby'], levels: ['critico', 'parado', 'atencao'],
    task_type: 'workshop', people: 1, role: 'campeao',
    objective: 'Trazer a persona para uma experiência de aprendizado sem compromisso comercial.',
    why: 'Workshops são a porta de entrada natural da Leadrix: geram confiança pelo método, qualificam interesse real e criam reciprocidade.',
    steps: [
      'Enviar convite nominal destacando o caso de uso do segmento que será discutido.',
      'Confirmar presença por mensagem 2 dias antes.',
      'Registrar interação e perguntas feitas no workshop para o próximo toque.',
    ],
    expenses: [{ category: 'material', qty: 1 }],
    content: { format: 'email', angle: 'Convite pessoal para o workshop, ligando o tema à realidade da conta.' },
  },
  {
    id: 'lead-conteudo-segmento',
    title: 'Conteúdo de autoridade para o segmento e revisão do fit',
    stages: ['lead'], levels: ['parado'],
    task_type: 'conteudo', people: 1, role: 'sponsor',
    objective: 'Nutrir com um artigo de referência e decidir: segue no ABM ou volta para 1:many.',
    why: 'Lead parado muito além do SLA consome atenção. ABM exige disciplina de seleção: ou a conta ganha um motivo novo para conversar, ou sai do esforço 1:1.',
    steps: [
      'Publicar blog post sobre a dor do microssegmento e enviar com nota pessoal.',
      'Se não houver resposta em 14 dias, rebaixar o nível ABM para 1:many ou marcar como perdido (sem resposta).',
    ],
    content: { format: 'blog', angle: 'Guia prático: como empresas do microssegmento priorizam iniciativas de IA por margem, capacidade e risco.' },
  },

  // QUALIFICADO ──────────────────────────────────────────────────
  {
    id: 'qual-diagnostico',
    title: 'Oferecer o Diagnóstico Leadrix como porta de entrada',
    stages: ['qualificado'], levels: ['no_prazo', 'atencao'],
    task_type: 'diagnostico', people: 2, role: 'sponsor',
    objective: 'Converter interesse em um diagnóstico com impacto em margem, capacidade, qualidade, risco e receita.',
    why: 'A Leadrix começa pelo diagnóstico, sempre. Ele reduz o risco percebido, gera dado da própria conta e desenha a proposta com o cliente, não para ele.',
    steps: [
      'Propor diagnóstico executivo com escopo e duração claros.',
      'Levantar 3 processos candidatos e os indicadores atuais.',
      'Devolver o portfólio: fazer primeiro, testar, escalar, evitar.',
    ],
    expenses: [{ category: 'deslocamento', qty: 2 }],
  },
  {
    id: 'qual-briefing-executivo',
    title: 'Executive briefing com benchmark do microssegmento',
    stages: ['qualificado'], levels: ['atencao', 'critico'],
    task_type: 'reuniao', people: 2, role: 'sponsor',
    objective: 'Levar ao sponsor uma leitura do mercado dele com os indicadores que importam.',
    why: 'Conteúdo personalizado ao nível da conta (account insight) é o que diferencia ABM de prospecção. O executivo aceita reunião quando vai aprender algo sobre o próprio mercado.',
    steps: [
      'Montar one-pager com as dores e indicadores do microssegmento.',
      'Mostrar onde a conta provavelmente está versus o mercado.',
      'Fechar com a pergunta: qual desses indicadores mais pesa no resultado deste ano?',
    ],
    content: { format: 'blog', angle: 'Benchmark: onde a IA já muda margem e capacidade no microssegmento — e onde ainda é promessa.' },
  },
  {
    id: 'qual-multithreading',
    title: 'Multi-threading: envolver o segundo decisor',
    stages: ['qualificado', 'proposta'], levels: ['critico'],
    task_type: 'email', people: 1, role: 'influenciador',
    objective: 'Não depender de um único contato: abrir conversa com outra persona do comitê.',
    why: 'Oportunidades com um só contato morrem quando ele muda de prioridade. Cobrir o comitê de compra é o principal antídoto contra aging.',
    steps: [
      'Pedir ao contato atual uma apresentação para a área técnica ou de operações.',
      'Enviar e-mail personalizado para a nova persona com o caso de uso do pilar dela.',
    ],
    content: { format: 'email', angle: 'E-mail para a segunda persona do comitê, focado no indicador da área dela.' },
  },
  {
    id: 'qual-jantar-roundtable',
    title: 'Jantar executivo (roundtable) do microssegmento',
    stages: ['qualificado', 'negociacao'], levels: ['critico', 'parado'],
    tiers: ['1:1', '1:few'],
    task_type: 'jantar', people: 2, role: 'sponsor',
    objective: 'Reunir 4 a 8 executivos do mesmo microssegmento para discutir um tema, com a conta-alvo na mesa.',
    why: 'Eventos pequenos e fechados são a jogada clássica de ABM 1:few: criam relacionamento entre pares, posicionam a Leadrix como anfitriã do tema e destravam contas frias.',
    steps: [
      'Escolher tema a partir da dor comum do cluster.',
      'Convidar sponsor da conta-alvo e pares de contas não concorrentes.',
      'Enviar resumo da conversa para todos em até 48h.',
    ],
    expenses: [{ category: 'jantar', qty: 6 }, { category: 'deslocamento', qty: 2 }],
    content: { format: 'linkedin', angle: 'Aprendizados de uma mesa de executivos sobre IA com método (sem citar nomes).' },
  },
  {
    id: 'qual-reengajamento',
    title: 'Reengajamento com gatilho de mercado',
    stages: ['qualificado', 'standby'], levels: ['parado'],
    task_type: 'email', people: 1, role: 'campeao',
    objective: 'Reabrir a conversa com um fato novo, ou encerrar o ciclo com elegância.',
    why: 'Reativar exige relevância nova, não "passando para saber". Um e-mail de fechamento de ciclo também gera resposta e limpa o pipeline.',
    steps: [
      'Enviar conteúdo novo ligado a um gatilho (resultado trimestral, mudança regulatória, vaga aberta).',
      'Sem resposta em 10 dias: e-mail de encerramento de ciclo, deixando a porta aberta.',
    ],
    content: { format: 'email', angle: 'Reengajamento com gatilho de mercado e opção explícita de retomar mais tarde.' },
  },

  // PROPOSTA ─────────────────────────────────────────────────────
  {
    id: 'prop-business-case',
    title: 'Business case com os indicadores da conta',
    stages: ['proposta'], levels: ['no_prazo', 'atencao'],
    task_type: 'proposta', people: 2, role: 'sponsor',
    objective: 'Traduzir a proposta em impacto nos indicadores que o sponsor defende internamente.',
    why: 'O sponsor precisa vender a proposta para o board. Negócio antes da tecnologia: problema, consequência e indicador orientam a decisão.',
    steps: [
      'Montar o antes/depois dos indicadores do segmento com premissas explícitas.',
      'Mostrar critérios de escala e governança desde o início.',
    ],
  },
  {
    id: 'prop-revisao-sponsor',
    title: 'Reunião de revisão da proposta com o sponsor',
    stages: ['proposta'], levels: ['atencao', 'critico'],
    task_type: 'reuniao', people: 2, role: 'sponsor',
    objective: 'Entender o que falta para decidir e quem mais precisa ser convencido.',
    why: 'Proposta sem retorno quase sempre esconde uma objeção não dita ou um decisor ausente. Perguntar cedo evita meses de aging.',
    steps: [
      'Pedir 30 minutos para revisar premissas, não para "cobrar".',
      'Perguntar: quem mais participa da decisão e o que precisa ver?',
    ],
  },
  {
    id: 'prop-faseamento',
    title: 'Proposta faseada: começar por diagnóstico ou piloto',
    stages: ['proposta', 'negociacao'], levels: ['critico', 'parado'],
    task_type: 'proposta', people: 1, role: 'sponsor',
    objective: 'Reduzir o risco e o valor da primeira decisão para destravar a conta.',
    why: 'Land and expand: um primeiro passo menor, com critério de escala claro, costuma fechar mais rápido que o projeto completo — e abre os demais pilares depois.',
    steps: [
      'Separar a proposta em fase 1 (diagnóstico ou piloto) e fases seguintes condicionadas a indicadores.',
      'Apresentar critérios objetivos para seguir para a fase 2.',
    ],
  },
  {
    id: 'prop-prova-social',
    title: 'Prova social: caso e conversa com cliente de referência',
    stages: ['proposta', 'negociacao'], levels: ['critico'],
    task_type: 'conteudo', people: 1, role: 'influenciador',
    objective: 'Diminuir o risco percebido mostrando resultado em empresa parecida.',
    why: 'Na etapa de avaliação o comitê busca segurança. Evidência de par do mesmo segmento vale mais que qualquer argumento da Leadrix.',
    steps: [
      'Enviar caso (ou artigo) do mesmo pilar e segmento.',
      'Oferecer conversa de 20 minutos com um cliente de referência.',
    ],
    content: { format: 'blog', angle: 'Caso prático no formato problema → método → indicador, do pilar da oportunidade.' },
  },
  {
    id: 'prop-visita',
    title: 'Visita presencial ao sponsor',
    stages: ['proposta', 'negociacao'], levels: ['parado'],
    tiers: ['1:1'],
    task_type: 'viagem', people: 2, role: 'sponsor',
    objective: 'Recuperar a conta estratégica olho no olho, com agenda de trabalho e não de cobrança.',
    why: 'Em contas 1:1 o investimento presencial se justifica quando o valor está em risco. A visita sinaliza prioridade e costuma revelar o bloqueio real.',
    steps: [
      'Propor sessão de trabalho de 1h sobre o business case na sede da conta.',
      'Aproveitar a viagem para conhecer a operação (usuários do processo).',
    ],
    expenses: [{ category: 'passagem', qty: 2 }, { category: 'hospedagem', qty: 2 }, { category: 'almoco', qty: 3 }, { category: 'deslocamento', qty: 4 }],
  },

  // NEGOCIAÇÃO ───────────────────────────────────────────────────
  {
    id: 'neg-plano-mutuo',
    title: 'Plano mútuo de fechamento',
    stages: ['negociacao'], levels: ['no_prazo', 'atencao'],
    task_type: 'reuniao', people: 1, role: 'campeao',
    objective: 'Combinar com o campeão cada passo até a assinatura, com datas e donos.',
    why: 'O plano mútuo transforma "estamos avaliando" em compromissos verificáveis e mostra cedo onde a negociação vai travar.',
    steps: [
      'Listar etapas internas da conta: jurídico, compras, TI, aprovação.',
      'Acordar datas e quem da Leadrix apoia cada etapa.',
    ],
  },
  {
    id: 'neg-almoco-decisor',
    title: 'Almoço com o decisor econômico',
    stages: ['negociacao'], levels: ['atencao', 'critico'],
    tiers: ['1:1', '1:few'],
    task_type: 'almoco', people: 1, role: 'sponsor',
    objective: 'Tratar condições e prioridades fora da sala de reunião.',
    why: 'Na reta final a relação humana pesa. Um almoço com o sponsor alinha expectativas de resultado e de parceria de longo prazo.',
    steps: [
      'Levar o resumo dos indicadores acordados no business case.',
      'Ouvir as restrições reais (orçamento, calendário, risco).',
    ],
    expenses: [{ category: 'almoco', qty: 2 }, { category: 'deslocamento', qty: 2 }],
  },
  {
    id: 'neg-governanca-risco',
    title: 'Endereçar risco, segurança e LGPD com governança',
    stages: ['negociacao', 'proposta'], levels: ['critico', 'parado'],
    task_type: 'reuniao', people: 2, role: 'bloqueador',
    objective: 'Neutralizar o bloqueador técnico ou jurídico com o modelo de governança da Leadrix.',
    why: 'Quando a negociação para, muitas vezes é o bloqueador silencioso. Levar regras de uso, dados permitidos e supervisão humana transforma risco em critério de desenho.',
    steps: [
      'Reunião com TI, segurança ou jurídico apresentando o modelo de governança.',
      'Enviar documento de controles proporcionais ao risco do processo.',
    ],
    content: { format: 'blog', angle: 'Governança de IA sem burocracia: regras de uso, dados permitidos e supervisão humana proporcionais ao risco.' },
  },
  {
    id: 'neg-escalonamento',
    title: 'Escalonamento executivo: sócio Leadrix ↔ C-level da conta',
    stages: ['negociacao'], levels: ['parado'],
    task_type: 'reuniao', people: 2, role: 'sponsor',
    objective: 'Reposicionar a conversa no nível estratégico e decidir: fecha, reformula ou pausa.',
    why: 'Negociação parada além de 3× o SLA raramente se resolve no mesmo nível. Um contato entre sócios reancora o porquê e acelera a decisão.',
    steps: [
      'Sócio da Leadrix pede conversa de 30 minutos com o C-level.',
      'Levar duas alternativas: escopo completo ou fase 1 reduzida.',
    ],
  },

  // STAND BY ─────────────────────────────────────────────────────
  {
    id: 'standby-toque-relevancia',
    title: 'Toque de relevância antes da data de revisão',
    stages: ['standby'], levels: ['no_prazo', 'atencao', 'critico'],
    task_type: 'linkedin', people: 1, role: 'campeao',
    objective: 'Manter a Leadrix presente com baixa frequência e alto valor.',
    why: 'Stand by não é abandono. Toques espaçados de conteúdo útil mantêm a conta aquecida para a reativação.',
    steps: [
      'Compartilhar um conteúdo novo do pilar de interesse com comentário pessoal.',
      'Confirmar a data de revisão combinada.',
    ],
    content: { format: 'linkedin', angle: 'Aprendizado recente de implantação no pilar de interesse da conta.' },
  },

  // FECHADO (expansão) ───────────────────────────────────────────
  {
    id: 'exp-qbr',
    title: 'Revisão de resultados (QBR) com indicadores de adoção',
    stages: ['fechado'], levels: ['atencao', 'critico', 'parado'],
    task_type: 'reuniao', people: 2, role: 'sponsor',
    objective: 'Mostrar ao sponsor o resultado medido e abrir a conversa sobre o próximo passo.',
    why: 'ABM não termina no fechamento. Contas que veem resultado medido viram expansão e advocacy — a forma mais barata de crescer receita.',
    steps: [
      'Consolidar indicadores de antes e depois do projeto.',
      'Apresentar critérios de escala e o próximo pilar recomendado.',
    ],
  },
  {
    id: 'exp-pilar-conectado',
    title: 'Expansão para o próximo pilar conectado',
    stages: ['fechado'], levels: ['atencao', 'critico', 'parado'],
    task_type: 'reuniao', people: 1, role: 'campeao', expansion: true,
    objective: 'Abrir oportunidade no pilar que potencializa o que já foi entregue.',
    why: 'Os quatro pilares da Leadrix funcionam como sistema: cada um aumenta a força dos demais. Cross-sell baseado em resultado é land and expand na prática.',
    steps: [
      'Mostrar como o pilar entregue depende do próximo para escalar.',
      'Criar a oportunidade no pipeline já com o serviço de entrada do novo pilar.',
    ],
  },
  // JORNADA E CAMPANHAS (contexto estratégico) ───────────────────
  {
    id: 'lead-memorando-executivo',
    title: 'Memorando executivo do mercado',
    stages: ['lead'], levels: ['no_prazo', 'atencao'],
    task_type: 'conteudo', people: 1, role: 'sponsor', journey: 'conteudo',
    objective: 'Entregar uma interpretação aplicável à empresa (ou ao grupo setorial) antes de qualquer catálogo de soluções.',
    why: 'O segundo movimento da jornada é conteúdo executivo específico. Autoridade vem de mostrar que entendemos a operação daquele mercado, não de apresentar serviços.',
    steps: [
      'Escrever de 1 a 2 páginas: tensão do setor, hipótese de processo, indicador afetado.',
      'Enviar ao patrocinador econômico com uma pergunta de confirmação.',
      'Registrar a reação como validação (ou correção) da hipótese.',
    ],
    content: { format: 'blog', angle: 'Memorando executivo: a tensão do mercado, a hipótese de processo e o indicador que ela afeta.' },
  },
  {
    id: 'sinal-abordagem',
    title: 'Abordagem a partir de um sinal de intenção',
    stages: ['lead', 'qualificado'], levels: ['no_prazo', 'atencao', 'critico'],
    task_type: 'email', people: 1, role: 'sponsor', journey: 'sinal', requiresSignal: true,
    objective: 'Usar um acontecimento verificável da conta para abrir conversa com uma hipótese, não com uma oferta.',
    why: 'ABM é ativado por acontecimentos. O sinal vira hipótese sobre o que está acontecendo e sobre qual indicador está sendo afetado — e a mensagem convida o executivo a confirmar, corrigir ou rejeitar.',
    steps: [
      'Confirmar o sinal na fonte (notícia, vaga, comunicado, conversa).',
      'Escrever na estrutura: sinal → hipótese → consequência econômica → por que investigar → convite específico.',
      'Enviar e registrar na timeline da conta.',
    ],
    content: { format: 'email', angle: 'Mensagem a partir do sinal de intenção, na estrutura sinal → hipótese → consequência → convite.' },
  },
  {
    id: 'qual-conversa-diagnostico',
    title: 'Conversa de diagnóstico para validar a hipótese',
    stages: ['qualificado'], levels: ['no_prazo', 'atencao'],
    task_type: 'reuniao', people: 2, role: 'campeao', journey: 'conversa',
    objective: 'Validar se a hipótese existe, entender prioridades e mapear dependências organizacionais.',
    why: 'Terceiro movimento da jornada: antes de propor diagnóstico pago, confirmar o problema e quem precisa estar envolvido. Evita proposta bonita para dor inexistente.',
    steps: [
      'Levar a hipótese e os indicadores prováveis por escrito.',
      'Perguntar o que já tentaram e o que travou.',
      'Sair com responsável pelo processo, acesso a dados e próximo passo definidos.',
    ],
  },
  {
    id: 'comite-financeiro-juridico',
    title: 'Trazer CFO, jurídico e compras para a mesa',
    stages: ['proposta', 'negociacao'], levels: ['atencao', 'critico'],
    task_type: 'reuniao', people: 1, role: 'financeiro',
    objective: 'Antecipar as áreas que entram quando a oportunidade avança e evitar travas no fim.',
    why: 'O grupo decisor cresce conforme a oportunidade amadurece: finanças pede retorno e prazo, jurídico pede limites de uso de dados, compras pede escopo e critérios de aceite. Chamar antes é mais rápido que ser interrompido depois.',
    steps: [
      'Enviar ao CFO a justificativa de investimento com premissas e prazo de retorno.',
      'Enviar ao jurídico a matriz de riscos e o tratamento de dados.',
      'Alinhar com compras escopo, critérios de aceite e modelo de acompanhamento.',
    ],
  },
  {
    id: 'piloto-prova-valor',
    title: 'Piloto com prova de valor e critérios de continuidade',
    stages: ['negociacao'], levels: ['no_prazo', 'atencao'],
    task_type: 'proposta', people: 2, role: 'campeao', journey: 'piloto',
    objective: 'Testar a hipótese com linha de base, meta e critério explícito de continuar, corrigir ou interromper.',
    why: 'Quinto movimento da jornada. O piloto é o que gera evidência organizada por problema e indicador — a fragilidade que o ABM mais cobra na hora da decisão.',
    steps: [
      'Definir linha de base e indicador antes de começar.',
      'Combinar duração, responsáveis e supervisão humana.',
      'Escrever os critérios de continuidade, correção ou interrupção.',
    ],
  },
  {
    id: 'campanha-mesa-executiva',
    title: 'Mesa executiva fechada por problema (campanha)',
    stages: ['lead', 'qualificado'], levels: ['critico', 'parado'],
    tiers: ['1:few'],
    task_type: 'evento', people: 2, role: 'sponsor',
    objective: 'Reunir executivos de contas do mesmo problema em torno da tese da campanha.',
    why: 'Campanhas nascem de problemas, não de produtos. Uma mesa fechada por tese cria relacionamento entre pares e destrava várias contas do cluster de uma vez.',
    steps: [
      'Escolher a campanha e a tese de valor do cluster.',
      'Convidar de 6 a 10 executivos de contas não concorrentes.',
      'Enviar depois um registro com as prioridades discutidas.',
    ],
    expenses: [{ category: 'evento', qty: 1 }, { category: 'material', qty: 8 }],
    content: { format: 'linkedin', angle: 'Convite e leitura da tese da campanha, sem citar nomes das contas.' },
  },
  {
    id: 'autopilot-avaliacao',
    title: 'Avaliação de oportunidade para Autopilot',
    stages: ['qualificado', 'proposta', 'fechado'], levels: ['atencao', 'critico'],
    task_type: 'diagnostico', people: 2, role: 'campeao', requiresSignal: 'terceirizacao',
    objective: 'Verificar se alguma atividade recorrente pode virar serviço operado com IA e supervisão humana.',
    why: 'A campanha Autopilot exige disciplina: só funciona com recorrência, entrada e saída definidas, trabalho por regras, indicador verificável e orçamento identificável. Sem isso, vira projeto customizado com margem imprevisível.',
    steps: [
      'Listar as atividades terceirizadas ou repetitivas e seus volumes.',
      'Checar as sete condições de aderência ao modelo.',
      'Dimensionar orçamento atual e indicador de verificação.',
    ],
  },
  {
    id: 'exp-caso-cocriado',
    title: 'Caso de sucesso co-criado com o cliente',
    stages: ['fechado'], levels: ['critico', 'parado'],
    task_type: 'conteudo', people: 1, role: 'campeao',
    objective: 'Transformar o resultado em prova social para o microssegmento (advocacy).',
    why: 'Clientes satisfeitos são o canal mais crível para contas parecidas. O caso alimenta as jogadas de prova social das próximas oportunidades.',
    steps: [
      'Entrevistar o campeão sobre problema, método e indicador.',
      'Publicar com aprovação do cliente e distribuir para o cluster.',
    ],
    content: { format: 'blog', angle: 'Caso de sucesso: problema, método Leadrix e indicador que mudou.' },
  },
]
