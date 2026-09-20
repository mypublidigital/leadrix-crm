// Contexto estratégico de ABM da Leadrix (documento "Contexto_Estratégico_ABM_Leadrix").
//
// Este arquivo traduz o documento em estruturas que as telas usam:
// pontuação da conta ideal (ICP), sinais de intenção, campanhas por problema,
// jornada comercial, estrutura da mensagem, ativos de conteúdo e métricas.
// As jogadas do dia a dia ficam em abmPlaybook.js.

// ── Pontuação da conta ideal (ICP) ──────────────────────────────
// Cada dimensão vale de 0 ao seu peso; a soma define o nível da conta.
// Bloqueadores impedem a priorização, qualquer que seja a pontuação.
export const ICP_DIMENSIONS = [
  { id: 'tensao', label: 'Tensão econômica', weight: 25, what: 'Pressão sobre margem, capacidade, prazo, qualidade, custo de servir ou crescimento.' },
  { id: 'complexidade', label: 'Complexidade operacional', weight: 20, what: 'Vários sistemas, unidades, áreas, documentos, transferências manuais ou conhecimento disperso.' },
  { id: 'estagio_ia', label: 'Estágio de IA', weight: 15, what: 'Ferramentas e testes já existem, mas o resultado ainda não aparece de forma mensurável.' },
  { id: 'implantacao', label: 'Condições de implantação', weight: 15, what: 'Responsável pelo processo, dados acessíveis, liderança envolvida e possibilidade de piloto.' },
  { id: 'momento', label: 'Momento de compra', weight: 10, what: 'Planejamento estratégico, troca de sistema, expansão, restrição de contratação ou meta de produtividade.' },
  { id: 'expansao', label: 'Potencial de expansão', weight: 10, what: 'Possibilidade de avançar por dois ou mais pilares da Leadrix.' },
  { id: 'acesso', label: 'Acesso e proximidade de prova', weight: 5, what: 'Relacionamentos, parceiros, caso semelhante ou reputação setorial transferível.' },
]

export const ICP_BLOCKERS = [
  'Sem patrocinador executivo ou responsável pelo processo',
  'Interesse limitado a comprar uma ferramenta ou palestra isolada',
  'Empresa pequena demais para capturar valor suficiente',
  'Tecnologicamente avançada o bastante para internalizar toda a entrega',
  'Sem acesso a dados, processos e responsáveis',
  'Demanda de desenvolvimento sob encomenda, sem aderência ao método',
]

export const ICP_BANDS = [
  { min: 80, tier: '1:1', label: 'Nível 1 — abordagem individual', color: 'bg-accent-100 text-accent-800' },
  { min: 65, tier: '1:few', label: 'Nível 2 — campanha por problema', color: 'bg-sky-100 text-sky-700' },
  { min: 50, tier: '1:many', label: 'Relacionamento e monitoramento', color: 'bg-amber-100 text-amber-700' },
  { min: 0, tier: null, label: 'Fora da operação ativa', color: 'bg-rose-100 text-rose-700' },
]

export function icpTotal(scores) {
  const s = scores || {}
  return ICP_DIMENSIONS.reduce((sum, d) => sum + Math.min(Math.max(Number(s[d.id]) || 0, 0), d.weight), 0)
}

export function icpBand(total, blockers) {
  const list = blockers || []
  if (list.length) return Object.assign({}, ICP_BANDS[ICP_BANDS.length - 1], { blocked: true })
  return ICP_BANDS.find((b) => total >= b.min) || ICP_BANDS[ICP_BANDS.length - 1]
}

// ── Sinais de intenção ──────────────────────────────────────────
// O ABM é ativado por acontecimentos. Um sinal não gera apresentação
// comercial: gera uma hipótese sobre o que está acontecendo e qual indicador
// está sendo afetado.
export const INTENT_SIGNALS = [
  { id: 'meta_produtividade', label: 'Meta de produtividade, margem ou crescimento sem ampliar equipe' },
  { id: 'expansao', label: 'Expansão de unidades, aquisição ou reorganização operacional' },
  { id: 'troca_sistema', label: 'Implantação ou troca de ERP, CRM, plataforma de dados ou canais' },
  { id: 'nova_lideranca', label: 'Contratação de liderança de transformação, inovação, tecnologia ou operações' },
  { id: 'programa_ia', label: 'Programa corporativo de IA sem critério comum de priorização' },
  { id: 'uso_nao_autorizado', label: 'Crescimento do uso não autorizado de ferramentas de IA' },
  { id: 'poc_parada', label: 'Iniciativas de IA que ficam em prova de conceito' },
  { id: 'dificuldade_contratar', label: 'Dificuldade de contratar profissionais especializados' },
  { id: 'terceirizacao', label: 'Processos terceirizados de alto custo e baixa diferenciação' },
  { id: 'regulatorio', label: 'Mudança regulatória ou exigência de cliente que aumenta documentação' },
  { id: 'educacao_solta', label: 'Programa de educação em IA sem conexão com processos e indicadores' },
]

export const SIGNAL_LABEL = Object.fromEntries(INTENT_SIGNALS.map((s) => [s.id, s.label]))

// ── Campanhas: nascem de problemas, não de produtos ─────────────
export const CAMPAIGNS = {
  'crescer-sem-estrutura': {
    label: 'Crescer sem ampliar a estrutura na mesma proporção',
    markets: ['servicos-b2b'],
    thesis: 'Automatizar trabalho preparatório e transformar conhecimento em capacidade organizacional.',
    entry: 'Diagnóstico de trabalho intelectual e capacidade.',
  },
  'experimentacao-portfolio': {
    label: 'Da experimentação ao portfólio',
    markets: ['servicos-b2b', 'industria', 'varejo-franquias', 'empresas-digitais'],
    thesis: 'Organizar iniciativas dispersas e priorizar as que podem gerar impacto mensurável.',
    entry: 'Avaliação do portfólio e workshop executivo.',
  },
  'ia-no-fluxo': {
    label: 'IA no fluxo real da operação',
    markets: ['industria'],
    thesis: 'Redesenhar processos antes de adicionar novas ferramentas.',
    entry: 'Diagnóstico de processos, dados e sistemas.',
  },
  'capacidade-por-unidade': {
    label: 'Capacidade com padrão em cada unidade',
    markets: ['varejo-franquias'],
    thesis: 'Combinar automação, formação e gestão por unidade.',
    entry: 'Diagnóstico de rede e piloto controlado.',
  },
  autopilot: {
    label: 'Comprar o trabalho pronto (Autopilot)',
    markets: ['servicos-b2b', 'industria', 'varejo-franquias', 'empresas-digitais'],
    thesis: 'Substituir atividades recorrentes por serviços operados com IA e supervisão humana.',
    entry: 'Avaliação de oportunidade para Autopilot.',
    // Sem estas condições, "Autopilot" vira nome sofisticado para projeto
    // customizado com margem imprevisível.
    requires: [
      'Recorrência e volume suficientes',
      'Entrada e saída definidas',
      'Alta proporção de trabalho baseado em regras',
      'Poucas decisões que exigem julgamento',
      'Indicador verificável',
      'Orçamento interno ou terceirizado identificável',
      'Exceções encaminháveis para supervisão humana',
    ],
  },
}

export const CAMPAIGN_IDS = Object.keys(CAMPAIGNS)

// ── Jornada comercial por conta (seis movimentos) ───────────────
export const JOURNEY = [
  { id: 'sinal', label: 'Sinal e hipótese de conta', stages: ['lead'], what: 'Identificar o acontecimento, o problema provável, o indicador afetado e os decisores envolvidos.' },
  { id: 'conteudo', label: 'Conteúdo executivo específico', stages: ['lead'], what: 'Entregar uma interpretação aplicável àquela empresa ou ao seu grupo setorial, sem catálogo de soluções.' },
  { id: 'conversa', label: 'Conversa de diagnóstico', stages: ['qualificado'], what: 'Validar se a hipótese existe, entender prioridades e reconhecer dependências organizacionais.' },
  { id: 'diagnostico', label: 'Diagnóstico pago ou workshop de trabalho', stages: ['proposta'], what: 'Transformar percepções em processos, linha de base, prioridades e responsáveis.' },
  { id: 'piloto', label: 'Piloto com prova de valor', stages: ['negociacao'], what: 'Testar a hipótese com critérios de continuidade, correção ou interrupção.' },
  { id: 'expansao', label: 'Implantação e expansão', stages: ['fechado', 'standby'], what: 'Avançar para automação, redesenho, educação, governança, operação assistida, Autopilot ou novos negócios.' },
]

export function journeyForStage(stage) {
  return JOURNEY.filter((j) => j.stages.includes(stage))
}

// ── Estrutura da mensagem (voz Sábio e Explorador) ──────────────
export const MESSAGE_STRUCTURE = [
  'Apresentar um sinal ou tensão empresarial verificável.',
  'Formular uma hipótese sobre processo ou organização.',
  'Relacionar a hipótese a uma consequência econômica.',
  'Demonstrar por que a situação merece investigação.',
  'Convidar para uma decisão específica.',
]

export const MESSAGE_MODEL = 'Observamos que a empresa está passando por [sinal verificável]. Em operações com essa configuração, o desafio costuma aparecer quando [hipótese de processo ou organização], afetando [indicador provável]. A Leadrix está analisando como empresas desse setor podem comparar processos, dados e capacidade antes de ampliar investimentos em IA. Gostaríamos de avaliar com vocês quais atividades merecem prioridade e quais ainda não justificam implantação.'

// A mensagem não presume que a dor existe: apresenta hipótese que o executivo
// pode confirmar, corrigir ou rejeitar.
export const MESSAGE_RULE = 'Nunca presuma a dor: apresente uma hipótese verificável, sem fabricar intimidade.'

// ── Ativos de conteúdo que sustentam a conversa ─────────────────
export const CONTENT_ASSETS = [
  'Memorando executivo por mercado',
  'Mapa de oportunidades de IA por processo',
  'Diagnóstico de maturidade orientado a resultado',
  'Matriz de priorização por impacto, custo, prazo, risco e maturidade',
  'Mapa de oportunidades de Autopilot',
  'Modelo de justificativa de investimento',
  'Material sobre estruturas organizacionais híbridas',
  'Guia de governança operacional e Playbook de IA',
  'Caso por linha de base, intervenção, supervisão, resultado e limitações',
  'Roteiro de workshop por campanha',
]

// ── Métricas que comandam a operação (por conta, não por contato) ──
export const ABM_METRICS = {
  cobertura: ['Contas com grupo decisor mapeado', 'Contatos relevantes por conta', 'Contas com hipótese de valor documentada'],
  engajamento: ['Contas com interação de duas ou mais áreas', 'Participação de executivos em reuniões, eventos ou diagnósticos', 'Evolução de contato isolado para discussão corporativa'],
  conversao: ['Contas que avançam para conversa de diagnóstico', 'Diagnósticos que viram piloto ou implantação', 'Tempo entre primeiro engajamento e oportunidade', 'Taxa de vitória e valor médio por grupo de contas'],
  expansao: ['Receita adicional nas contas existentes', 'Pilares contratados por cliente', 'Projetos que viram operação assistida ou recorrência'],
  warning: 'Downloads, impressões e taxas de abertura ajudam a interpretar atividade, mas não comandam a operação. Uma conta com três decisores envolvidos vale mais que cem leads de conteúdo genérico.',
}
