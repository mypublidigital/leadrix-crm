// Base de conhecimento da Leadrix — fonte única para taxonomia, filtros,
// sugestões ABM, gerador de conteúdo e contexto enviado aos agentes.
//
// Origem: https://www.leadrix.com.br (páginas /pilares e /mercados/*),
// levantado em set/2026. Onde o site NÃO traz a informação, o item está
// marcado com `proposto: true` — revisar com o time comercial. Os
// microssegmentos são editáveis em Configurações (esta lista é só o ponto de
// partida).

// ── Os quatro pilares de entrega ────────────────────────────────
export const PILLARS = {
  'estruturas-hibridas': {
    id: 'estruturas-hibridas',
    label: 'Estruturas Organizacionais Híbridas',
    short: 'Estruturas Híbridas',
    color: 'bg-sky-100 text-sky-800',
    chart: '#2D7FF9',
    promise: 'Redesenhar papéis, responsabilidades e rotinas para que pessoas, agentes, sistemas e dados operem como partes de uma mesma organização.',
    solves: 'Tarefas duplicadas, decisões sem responsável e ganhos de produtividade não realizados quando ferramentas entram sem revisão do trabalho.',
    deliverables: [
      'Mapeamento de funções, atividades, decisões e conhecimentos críticos',
      'Redesenho de papéis entre pessoas, agentes e sistemas',
      'Modelo de supervisão, responsabilidade e tratamento de exceções',
      'Indicadores de capacidade, qualidade, adoção e produtividade',
    ],
  },
  'agentes-processos': {
    id: 'agentes-processos',
    label: 'Agentes e Processos Automatizados para Eficiência',
    short: 'Agentes e Processos',
    color: 'bg-indigo-100 text-indigo-800',
    chart: '#1A54BF',
    promise: 'Desenhar agentes e automatizar fluxos para reduzir desperdício, retrabalho, custo e tempo, preservando supervisão humana nas decisões que exigem julgamento.',
    solves: 'Processos manuais (planilhas, e-mails, conferências) que geram variabilidade e deixam dados disponíveis sem virar ação.',
    deliverables: [
      'Diagnóstico e redesenho de processos com agentes',
      'Priorização por impacto, custo, prazo, risco e maturidade',
      'Integração de agentes, documentos, dados e sistemas',
      'Regras, exceções, supervisão e indicadores de desempenho',
    ],
  },
  'educacao-adocao': {
    id: 'educacao-adocao',
    label: 'Educação e Adoção Produtiva',
    short: 'Educação e Adoção',
    color: 'bg-emerald-100 text-emerald-800',
    chart: '#48AD46',
    promise: 'Formar líderes e equipes para usar IA no trabalho real, com métodos, ferramentas autorizadas, critérios de qualidade e indicadores por função.',
    solves: 'Treinamentos genéricos que não mudam rotina, uso não autorizado de ferramentas e desigualdade de maturidade entre áreas.',
    deliverables: [
      'Curso de Formação Leadrix e Workshop Mensal Leadrix',
      'Workshops personalizados por função',
      'Formação de multiplicadores e acompanhamento de adoção',
      'Playbook de IA com métodos, segurança, qualidade e indicadores',
    ],
  },
  'novos-negocios': {
    id: 'novos-negocios',
    label: 'Novos Negócios, Linhas de Receita e Spin-offs',
    short: 'Novos Negócios',
    color: 'bg-amber-100 text-amber-800',
    chart: '#B7791F',
    promise: 'Transformar conhecimento, dados, ativos e capacidades em produtos, serviços, experiências e empresas derivadas que abrem novas fontes de crescimento.',
    solves: 'Estratégias de IA presas à redução de custo, sem explorar vantagens que mudam o modelo de receita.',
    deliverables: [
      'Mapeamento de ativos, conhecimentos e oportunidades',
      'Construção e priorização de teses de negócios',
      'Prototipação, validação e tese econômico-financeira',
      'Modelo de implantação, parceria, nova unidade ou spin-off',
    ],
  },
}
export const PILLAR_IDS = Object.keys(PILLARS)

// Portas de entrada (site: /pilares). Cada uma puxa um pilar líder.
export const ENTRY_DOORS = {
  margem: { label: 'Margem e Capacidade', pillar: 'agentes-processos', help: 'Começa pela eficiência operacional.' },
  adocao: { label: 'Adoção e Liderança', pillar: 'educacao-adocao', help: 'Começa por educação e redesenho do trabalho.' },
  crescimento: { label: 'Crescimento e Diferenciação', pillar: 'novos-negocios', help: 'Começa por novos negócios.' },
}

// ── Os quatro macrossegmentos (mercados) ────────────────────────
// `personas`, `pains` e `indicators` vêm do site; `micro` é o ponto de partida
// dos filtros (Serviços B2B vem do site; os demais são propostos).
export const MARKETS = {
  'servicos-b2b': {
    id: 'servicos-b2b',
    label: 'Serviços B2B',
    personas: ['Sócio(a)', 'CEO', 'Diretor(a) de Operações'],
    pains: [
      'Conhecimento estratégico disperso entre profissionais, arquivos e métodos',
      'Margens pressionadas por retrabalho e preparação manual',
      'Prazos de entrega incompatíveis com a velocidade exigida pelos clientes',
      'Uso informal de IA sem critérios de segurança ou qualidade',
      'Dificuldade em converter metodologia própria em produtos recorrentes',
    ],
    useCases: {
      'estruturas-hibridas': 'Distribuir o trabalho entre especialistas, agentes e sistemas',
      'agentes-processos': 'Automatizar pesquisa, documentos, CRM e relatórios',
      'educacao-adocao': 'Formação por função com Playbook de IA que orienta ferramentas',
      'novos-negocios': 'Estruturar produtos digitais e receitas recorrentes a partir da metodologia',
    },
    indicators: ['Horas por entrega', 'Margem por serviço', 'Prazo médio', 'Capacidade por equipe', 'Adoção de ferramentas', 'Receita de novas ofertas'],
    entry: 'Diagnóstico Leadrix combinado a workshop executivo ou in company',
    micro: [
      'Consultorias', 'Assessorias', 'Agências', 'Escritórios especializados', 'Serviços profissionais',
    ],
  },
  industria: {
    id: 'industria',
    label: 'Indústria',
    personas: ['Diretor(a) de Operações', 'Diretor(a) de Transformação', 'Diretor(a) de Excelência', 'Diretor(a) de Unidade de Negócio'],
    pains: [
      'Processos administrativos dependentes de planilhas, e-mails e conferência manual',
      'Informação dispersa entre ERP, sistemas internos, documentos e conhecimento pessoal',
      'Decisões reativas em estoque, suprimentos, qualidade, manutenção e comercial',
      'Muitas provas de conceito sem critério comparável de prioridade e escala',
      'Baixa adesão das áreas operacionais quando a tecnologia chega antes da formação',
    ],
    useCases: {
      'estruturas-hibridas': 'Redesenhar funções entre pessoas, copilotos, agentes e sistemas',
      'agentes-processos': 'Integrar automação, análise e decisão com supervisão proporcional ao risco',
      'educacao-adocao': 'Formações por função, multiplicadores internos e Playbook de IA',
      'novos-negocios': 'Serviços preditivos, produtos de dados e capacidades digitais derivadas',
    },
    indicators: ['Custo por processo', 'Tempo de ciclo', 'Erro e retrabalho', 'Qualidade', 'Capacidade liberada', 'Prazo de retorno'],
    entry: 'Diagnóstico de processos priorizado por custo, risco e prazo de retorno',
    micro: [
      'Alimentos e bebidas', 'Química e farmacêutica', 'Metalmecânica e autopeças', 'Bens de consumo',
      'Agroindústria', 'Construção e materiais', 'Têxtil e confecção', 'Embalagens e plásticos',
    ],
    microProposto: true,
  },
  'varejo-franquias': {
    id: 'varejo-franquias',
    label: 'Varejo e Franquias',
    personas: ['Diretor(a) de Operações', 'Diretor(a) de Rede', 'Diretor(a) de Expansão', 'Diretor(a) Comercial', 'Diretor(a) de Transformação'],
    pains: [
      'Desempenho e maturidade digital muito diferentes entre lojas e unidades',
      'Dados de vendas, CRM, estoque e atendimento atrasados ou sem contexto',
      'Sobrecarga de consultores de campo, backoffice, gerentes e franqueados',
      'Campanhas, rotinas e padrões que se degradam na execução na ponta',
      'Tecnologias abandonadas por complexidade, sem valor demonstrado',
    ],
    useCases: {
      'estruturas-hibridas': 'Copilotos e agentes para vendedores, gerentes e consultores de campo',
      'agentes-processos': 'Automação em CRM, atendimento, estoque, campanhas e relatórios',
      'educacao-adocao': 'Trilhas por função, workshops in company e Playbook de IA para a rede',
      'novos-negocios': 'Monetização de distribuição, dados e relacionamento com clientes',
    },
    indicators: ['Conversão por unidade', 'Tempo de atendimento', 'Aderência ao processo', 'Adoção por perfil', 'Margem por unidade', 'Tempo de treinamento'],
    entry: 'Diagnóstico da rede com piloto em unidades de referência',
    micro: [
      'Supermercados e varejo alimentar', 'Moda e calçados', 'Farmácias e drogarias', 'Óticas',
      'Materiais de construção', 'Food service e restaurantes', 'Franquias de serviços', 'Eletro e eletrônicos',
    ],
    microProposto: true,
  },
  'empresas-digitais': {
    id: 'empresas-digitais',
    label: 'Empresas Digitais',
    personas: ['CEO', 'COO', 'Líder de Produto', 'Líder de Tecnologia', 'Líder de Growth', 'Líder de Operações'],
    pains: [
      'Experimentos paralelos competindo por dados, orçamento e atenção',
      'Funcionalidades fáceis de copiar, sem diferenciação defensável',
      'Custo de tecnologia crescendo mais que o valor entregue',
      'Automações localizadas que não transformam o processo da organização',
      'Tensão entre velocidade, segurança, propriedade intelectual e dependência de fornecedores',
    ],
    useCases: {
      'estruturas-hibridas': 'Reorganizar times incorporando agentes com autonomia e supervisão',
      'agentes-processos': 'Redesenhar fluxos integrando agentes, dados e sistemas',
      'educacao-adocao': 'Formação avançada por área com Playbook operacional',
      'novos-negocios': 'Produtos baseados em dados, distribuição e capacidades próprias',
    },
    indicators: ['Custo de aquisição', 'Custo de servir', 'Tempo de ciclo de produto', 'Retenção', 'Receita por cliente', 'Receita de produtos baseados em IA'],
    entry: 'Diagnóstico executivo seguido de tese priorizada por impacto, velocidade de teste e escala',
    micro: [
      'SaaS B2B', 'E-commerce e marketplaces', 'Fintechs', 'Healthtechs', 'Edtechs',
      'Logtechs e mobilidade', 'Mídia e conteúdo digital',
    ],
    microProposto: true,
  },
}
export const MARKET_IDS = Object.keys(MARKETS)

// Mapa simples id → rótulo (usado em selects e no importador).
export const SEGMENT_LABELS = Object.fromEntries(MARKET_IDS.map((k) => [k, MARKETS[k].label]))

// Microssegmentos iniciais no formato de tabela editável (Config).
export function defaultMicroSegments() {
  const rows = []
  MARKET_IDS.forEach((m) => {
    MARKETS[m].micro.forEach((label, i) => {
      rows.push({
        id: `${m}--${slug(label)}`,
        segment: m,
        label,
        sort: i + 1,
        proposto: Boolean(MARKETS[m].microProposto),
      })
    })
  })
  return rows
}

export function slug(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

// ── Voz da marca (para o gerador de conteúdo e os agentes) ──────
export const BRAND_VOICE = {
  person: 'Primeira pessoa do plural ("nós", "a Leadrix") para falar da empresa; "você / sua empresa" para o leitor.',
  tone: 'Consultivo, sênior e anti-hype. Credibilidade vem de método, governança e impacto mensurável — nunca de adjetivos.',
  favor: ['método', 'governança', 'impacto mensurável', 'diagnóstico', 'priorização', 'resultado', 'margem', 'capacidade', 'adoção'],
  avoid: ['revolucionário', 'mágico', 'disruptivo', 'o futuro chegou', 'emojis', 'excesso de exclamações', 'percentuais inventados'],
  moves: [
    'Contrastar a pergunta errada com a certa ("A pergunta não é qual ferramenta usar; é o que muda na operação, na decisão e no resultado").',
    'Nomear o risco real ("O risco não é não usar IA. É usar IA sem método e chamar isso de inovação").',
    'Fechar com um passo concreto e consultivo, nunca "compre agora".',
  ],
  ctas: [
    'Agendar diagnóstico', 'Começar pelo diagnóstico', 'Falar com a Leadrix',
    'Mapear oportunidades de IA', 'Conversar com um especialista', 'Conhecer os quatro pilares',
  ],
  tagline: 'Lidere seu mercado com IA',
  closer: 'É aí que a Leadrix entra.',
  principles: [
    'Negócio antes da tecnologia: problema, consequência e indicador orientam a escolha técnica.',
    'Quatro pilares conectados: avançam como um sistema, cada um aumenta a força dos demais.',
    'Implantação acompanhada: responsáveis, riscos e critérios de escala entram no desenho desde o diagnóstico.',
  ],
  cycle: 'Organizar × Automatizar × Educar × Adotar × Crescer',
}

// ── Prioridade ABM por mercado ──────────────────────────────────
// Do Contexto Estratégico de ABM: por onde começar, com que perfil de conta,
// qual a tensão principal e qual a oferta de entrada.
export const MARKET_ABM = {
  'servicos-b2b': {
    priority: 'muito_alta',
    profile: 'Escritórios, consultorias, assessorias, agências e empresas profissionais cujo crescimento depende da contratação de especialistas.',
    tension: 'Escalar conhecimento sem ampliar a estrutura na mesma proporção.',
    entryOffer: 'Diagnóstico de capacidade, processos e conhecimento.',
  },
  industria: {
    priority: 'muito_alta',
    profile: 'Empresas com processos documentais, administrativos e operacionais fragmentados entre ERP, planilhas, e-mails e pessoas.',
    tension: 'Aumentar produtividade, previsibilidade e integração.',
    entryOffer: 'Diagnóstico de processos, dados e sistemas.',
  },
  'varejo-franquias': {
    priority: 'alta',
    profile: 'Redes com várias unidades, dispersão de desempenho, dificuldade de treinamento e forte dependência da execução na ponta.',
    tension: 'Distribuir capacidade com padrão e comprovar resultado por unidade.',
    entryOffer: 'Diagnóstico da rede, formação da liderança e piloto.',
  },
  'empresas-digitais': {
    priority: 'seletiva',
    profile: 'Negócios em escala com muitas iniciativas de IA, custos crescentes e dificuldade de conectar produto, operação e monetização.',
    tension: 'Converter experimentação em arquitetura e vantagem competitiva.',
    entryOffer: 'Avaliação rápida do portfólio e sprint executivo.',
  },
}

export const MARKET_PRIORITY = {
  muito_alta: { label: 'Prioridade muito alta', color: 'bg-accent-100 text-accent-800', order: 0 },
  alta: { label: 'Prioridade alta', color: 'bg-sky-100 text-sky-700', order: 1 },
  seletiva: { label: 'Entrada seletiva', color: 'bg-ink-100 text-ink-600', order: 2 },
}

// Tese central do programa (usada nos agentes e nas telas de apoio).
export const ABM_THESIS = {
  statement: 'A Leadrix usa ABM para selecionar empresas médias nas quais consiga formular uma hipótese concreta de transformação, mobilizar o grupo decisor e iniciar a relação por uma entrega de menor risco, capaz de gerar evidência para projetos maiores.',
  positioning: 'A Leadrix transforma a adoção de inteligência artificial em capacidade empresarial mensurável, redesenhando trabalho, processos, governança e fontes de crescimento.',
  question: 'Onde esta empresa está perdendo margem, capacidade, qualidade, velocidade ou oportunidade de receita porque sua forma de operar ainda não incorporou adequadamente a IA?',
  principles: [
    'Contas antes de leads.',
    'Problemas econômicos antes de ferramentas.',
    'Grupo decisor antes de um contato isolado.',
    'Diagnóstico e evidência antes de projetos extensos.',
    'Entrada por uma dor e expansão pelos quatro pilares.',
  ],
  targetRevenue: 'Empresas de aproximadamente R$ 50 milhões a R$ 1 bilhão de faturamento: complexidade suficiente para justificar transformação, sem estrutura interna de grande corporação.',
  distribution: '10 a 12 contas de nível 1 (1:1) · 25 a 35 de nível 2 (1:few) · demais em relacionamento editorial e monitoramento.',
}
