// Catálogo de serviços do CRM, derivado da taxonomia oficial de projetos do
// Consulcard Projetos (briefing §10). Em produção, o ideal é sincronizar com o
// endpoint de catálogo do operacional (OPERACIONAL_CATALOG_URL) — este arquivo é
// a fonte de verdade local enquanto esse endpoint não existe, e também alimenta o
// seed do Supabase (supabase/migrations/0002_services.sql).
//
// suggested_value_brl: valor sugerido (editável), calibrado pela complexidade.
// Âncoras (complexidade 4-5) têm ticket alto; diagnósticos/curtos, ticket baixo.

export const SERVICES_CATALOG = [
  // contabil-regulatorio — Contábil/Regulatório
  { macro_id: 'contabil-regulatorio', macro_label: 'Contábil/Regulatório', service_id: 'setup-contabil', name: 'Setup contábil completo', complexity: 5, complexity_range: '4-5', anchor: true, suggested_value_brl: null },
  { macro_id: 'contabil-regulatorio', macro_label: 'Contábil/Regulatório', service_id: 'revisao-cosif', name: 'Revisão COSIF', complexity: 4, complexity_range: '3-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'contabil-regulatorio', macro_label: 'Contábil/Regulatório', service_id: 'mapeamento-bacen', name: 'Mapeamento BACEN', complexity: 4, complexity_range: '3-4', anchor: false, suggested_value_brl: null },

  // meios-pagamento — Meios de Pagamento
  { macro_id: 'meios-pagamento', macro_label: 'Meios de Pagamento', service_id: 'emissor-cartao', name: 'Emissor de cartão', complexity: 5, complexity_range: '4-5', anchor: true, suggested_value_brl: null },
  { macro_id: 'meios-pagamento', macro_label: 'Meios de Pagamento', service_id: 'migracao-processadora', name: 'Migração de processadora', complexity: 5, complexity_range: '4-5', anchor: false, suggested_value_brl: null },
  { macro_id: 'meios-pagamento', macro_label: 'Meios de Pagamento', service_id: 'otimizacao-tarifas', name: 'Otimização de tarifas', complexity: 3, complexity_range: '2-3', anchor: false, suggested_value_brl: null },
  { macro_id: 'meios-pagamento', macro_label: 'Meios de Pagamento', service_id: 'setup-bandeira', name: 'Setup de bandeira', complexity: 4, complexity_range: '3-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'meios-pagamento', macro_label: 'Meios de Pagamento', service_id: 'estruturacao-adquirencia', name: 'Estruturação de adquirência', complexity: 5, complexity_range: '4-5', anchor: false, suggested_value_brl: null },
  { macro_id: 'meios-pagamento', macro_label: 'Meios de Pagamento', service_id: 'operacao-cartao', name: 'Operação de cartão', complexity: 4, complexity_range: '2-4', anchor: false, suggested_value_brl: null },

  // banking-conta-digital — Banking/Conta Digital
  { macro_id: 'banking-conta-digital', macro_label: 'Banking/Conta Digital', service_id: 'conta-digital', name: 'Conta digital', complexity: 5, complexity_range: '4-5', anchor: false, suggested_value_brl: null },
  { macro_id: 'banking-conta-digital', macro_label: 'Banking/Conta Digital', service_id: 'baas', name: 'BaaS (Banking as a Service)', complexity: 5, complexity_range: '4-5', anchor: true, suggested_value_brl: null },
  { macro_id: 'banking-conta-digital', macro_label: 'Banking/Conta Digital', service_id: 'pld-aml', name: 'PLD/AML', complexity: 4, complexity_range: '3-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'banking-conta-digital', macro_label: 'Banking/Conta Digital', service_id: 'kyc-onboarding', name: 'KYC / Onboarding', complexity: 3, complexity_range: '2-3', anchor: false, suggested_value_brl: null },

  // consultoria-estrategica — Consultoria Estratégica
  { macro_id: 'consultoria-estrategica', macro_label: 'Consultoria Estratégica', service_id: 'diagnostico', name: 'Diagnóstico', complexity: 2, complexity_range: '1-3', anchor: false, suggested_value_brl: null },
  { macro_id: 'consultoria-estrategica', macro_label: 'Consultoria Estratégica', service_id: 'estrategia-produto', name: 'Estratégia de produto', complexity: 3, complexity_range: '2-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'consultoria-estrategica', macro_label: 'Consultoria Estratégica', service_id: 'modelo-negocio', name: 'Modelo de negócio', complexity: 3, complexity_range: '2-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'consultoria-estrategica', macro_label: 'Consultoria Estratégica', service_id: 'transformacao-digital', name: 'Transformação digital', complexity: 4, complexity_range: '2-4', anchor: false, suggested_value_brl: null },

  // open-finance — Open Finance/Pagamentos Instantâneos
  { macro_id: 'open-finance', macro_label: 'Open Finance/Pagamentos Instantâneos', service_id: 'pix-implantacao', name: 'Implantação Pix', complexity: 4, complexity_range: '3-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'open-finance', macro_label: 'Open Finance/Pagamentos Instantâneos', service_id: 'open-finance-assessoria', name: 'Assessoria Open Finance', complexity: 3, complexity_range: '2-4', anchor: false, suggested_value_brl: null },

  // revisao-operacional — Revisão Operacional
  { macro_id: 'revisao-operacional', macro_label: 'Revisão Operacional', service_id: 'mandates-bandeira', name: 'Mandates de bandeira', complexity: 3, complexity_range: '2-4', anchor: false, suggested_value_brl: null },
  { macro_id: 'revisao-operacional', macro_label: 'Revisão Operacional', service_id: 'suporte-regulatorio', name: 'Suporte regulatório', complexity: 3, complexity_range: '2-3', anchor: false, suggested_value_brl: null },
]

// Agrupa por macro categoria (para selects e telas).
export function servicesByMacro(list = SERVICES_CATALOG) {
  const map = new Map()
  for (const s of list) {
    if (!map.has(s.macro_id)) map.set(s.macro_id, { macro_id: s.macro_id, macro_label: s.macro_label, services: [] })
    map.get(s.macro_id).services.push(s)
  }
  return [...map.values()]
}
