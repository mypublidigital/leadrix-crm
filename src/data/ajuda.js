// ╔══════════════════════════════════════════════════════════════╗
// ║  Textos de instrução do sistema                                ║
// ║                                                                ║
// ║  Fonte única das etiquetas de mouse-over e do glossário da tela ║
// ║  de Instruções. Ficam juntos de propósito: etiqueta e manual    ║
// ║  que divergem ensinam errado.                                  ║
// ║                                                                ║
// ║  Regra de escrita: diga o que o campo faz e o que muda na tela  ║
// ║  quando ele muda. Etiqueta não é lugar de teoria — a teoria     ║
// ║  está em Instruções.                                           ║
// ╚══════════════════════════════════════════════════════════════╝

// ── Filtros de segmentação (usados no Radar, Contas e Pipeline) ──
export const FILTRO_TIPS = {
  mercado:
    'Macrossegmento da conta: Serviços B2B, Indústria, Varejo e Franquias, Empresas Digitais ou Outros. Define as personas, as dores e os indicadores que o Radar usa para montar a sugestão.',
  micro:
    'Nicho dentro do mercado (ex.: "Logística e transporte" na Indústria). É o que permite a campanha 1:few — várias contas do mesmo nicho recebem a mesma tese. A lista é editável em Configurações.',
  pilar:
    'Pilar de entrega da Leadrix a que o serviço da oportunidade pertence: Estruturas Híbridas, Agentes e Processos, Educação e Adoção ou Novos Negócios. Filtrar por pilar mostra só as oportunidades daquela frente.',
}

// ── Radar ABM ───────────────────────────────────────────────────
export const RADAR_TIPS = {
  // Indicadores do topo
  kpiCriticas:
    'Quantas oportunidades passaram de 2× o SLA da etapa. É a fila que precisa de decisão hoje: ou avança, ou vai para stand by, ou é perdida.',
  kpiRisco:
    'Soma do valor estimado das oportunidades críticas ou paradas, fora das já fechadas. Serve para priorizar pelo dinheiro em jogo, não só pelo atraso.',
  kpiCobertura:
    'Média de personas do comitê de compra com contato mapeado na conta. Abaixo de 60% a venda depende de uma pessoa só — se ela sai, a oportunidade morre.',
  kpiJogadas:
    'Total de ações sugeridas nas oportunidades listadas. Uma jogada descartada desaparece por 30 dias e volta se o problema persistir.',

  // Filtros próprios do Radar
  aging:
    'Quanto tempo a oportunidade está parada na etapa, comparado ao SLA. "Pedindo ação" (padrão) esconde o que está no prazo e mostra atenção, crítico e parado.',
  nivel:
    'Nível ABM da conta: 1:1 estratégico, 1:few por problema ou 1:many relacionamento. Ele libera ou bloqueia as jogadas de alto investimento — viagem e jantar só aparecem em 1:1 e 1:few. Conta sem nível é tratada como 1:few.',
  dono:
    'Responsável pela oportunidade, não pela conta. Uma mesma conta pode ter oportunidades de donos diferentes; filtre pelo seu nome para ver só a sua fila.',
  noPrazo:
    'Marcado, inclui também as oportunidades dentro do SLA, com jogadas proativas para manter o ritmo. Fica desabilitado quando você escolhe uma faixa de aging específica.',

  // Como a lista é construída
  sla:
    'Prazo esperado em cada etapa, em dias. É a régua do aging: 14 dias de SLA em Proposta significa que no 15º dia a oportunidade entra em Atenção. Editável em Configurações → Custo de venda.',
  faixas:
    'Faixas do aging pela razão dias ÷ SLA: até 1× está no prazo, até 2× atenção, até 3× crítico, acima de 3× parado. Quanto mais severa a faixa, mais intensa a jogada sugerida.',
  urgencia:
    'A ordem da lista não é só o atraso: o Radar multiplica a faixa de aging pelo valor da oportunidade, pelo nível ABM e por pesos extras quando há sinal de intenção ativo ou o comitê depende de uma pessoa só.',

  // Cartão de sugestão
  comite:
    'Personas esperadas no mercado da conta. Em verde, quem já tem contato cadastrado; em tracejado, quem falta. Uma conta só é considerada desenvolvida com patrocinador econômico, responsável operacional e aprovador técnico ou de risco.',
  sinal:
    'Acontecimento registrado na conta que justifica a abordagem agora (troca de ERP, nova liderança de tecnologia, expansão, meta de produtividade). Jogadas que dependem de sinal só aparecem quando existe um.',
  campanha:
    'Tese comercial escolhida para a conta. Ela dá o ângulo da mensagem e do conteúdo, para a abordagem não virar apresentação de portfólio.',
  persona:
    'Para quem é esta jogada e qual contato da conta corresponde. "Sem contato mapeado" significa que o primeiro passo é descobrir a pessoa, não executar a ação.',
  custo:
    'Horas estimadas × custo-hora médio de quem executa, mais as despesas do tipo de ação. Ao criar a ação esse custo entra no custo de venda da oportunidade.',
  jogada:
    'Ação recomendada com objetivo, justificativa pela teoria ABM e passos de execução. "Criar ação" lança na agenda com o esforço e o custo já preenchidos.',
  descartar:
    'Oculta a jogada nesta oportunidade por 30 dias. Use quando a ação não cabe no caso — não some para sempre, volta se a situação continuar.',
}

// ── Glossário (tela de Instruções) ──────────────────────────────
export const GLOSSARIO = [
  { termo: 'ABM', def: 'Account Based Marketing. Tratar cada conta de alto valor como um mercado próprio, em vez de disparar a mesma campanha para todos.' },
  { termo: 'Aging', def: 'Dias que a oportunidade está parada na etapa atual, lidos sempre em relação ao SLA daquela etapa.' },
  { termo: 'Nível ABM', def: 'Quanto esforço a conta merece: 1:1 (individual), 1:few (campanha por problema) ou 1:many (relacionamento em escala).' },
  { termo: 'ICP', def: 'Ideal Customer Profile. Pontuação de 0 a 100 em 7 dimensões que diz o quanto a conta se parece com o cliente ideal da Leadrix.' },
  { termo: 'Comitê de compra', def: 'Conjunto de papéis que decidem juntos uma compra B2B. Mapear todos é o que a teoria ABM chama de multi-threading.' },
  { termo: 'Sinal de intenção', def: 'Acontecimento na conta que abre uma janela de abordagem: troca de sistema, nova liderança, expansão, meta de produtividade.' },
  { termo: 'Jogada (play)', def: 'Ação recomendada pelo Radar, com objetivo, passos, persona-alvo e custo estimado.' },
  { termo: 'Pilar', def: 'Uma das quatro frentes de entrega da Leadrix. A primeira venda entra por um pilar e a expansão acontece pelos outros.' },
  { termo: 'Microssegmento', def: 'Nicho dentro do macrossegmento. É a unidade da campanha 1:few.' },
  { termo: 'Termômetro', def: 'Probabilidade de fechamento definida à mão pelo dono da oportunidade, de 0% a 100%.' },
  { termo: 'SLA da etapa', def: 'Prazo esperado em dias para a oportunidade sair daquela etapa. Configurável.' },
  { termo: 'Custo de conversão', def: 'Tudo que foi gasto para ganhar uma venda: horas das pessoas, despesas, rateio de custos fixos e comissão de indicação.' },
  { termo: 'Land and expand', def: 'Entrar por um serviço e crescer na conta pelos pilares conectados, em vez de tentar vender tudo de uma vez.' },
]
