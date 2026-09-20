// Catálogo de serviços da Leadrix, organizado pelos QUATRO PILARES de entrega
// (nível 1 = pilar, nível 2 = serviço). Derivado das entregas descritas em
// leadrix.com.br/pilares e /capacitacao.
//
// `macro_id` é o id do pilar (contrato com src/data/leadrix.js — não renomear
// sem migrar os dados). `suggested_value_brl` fica vazio de propósito: preço é
// decisão comercial da Leadrix e é preenchido na tela Serviços.

import { PILLARS } from './leadrix'

const s = (pillar, service_id, name, complexity, complexity_range, extra = {}) => ({
  macro_id: pillar,
  macro_label: PILLARS[pillar].label,
  service_id,
  name,
  complexity,
  complexity_range,
  anchor: false,
  suggested_value_brl: null,
  ...extra,
})

export const SERVICES_CATALOG = [
  // Estruturas Organizacionais Híbridas
  s('estruturas-hibridas', 'mapeamento-funcoes', 'Mapeamento de funções, decisões e conhecimentos críticos', 3, '2-3'),
  s('estruturas-hibridas', 'redesenho-papeis', 'Redesenho de papéis entre pessoas, agentes e sistemas', 4, '3-5', { anchor: true }),
  s('estruturas-hibridas', 'modelo-supervisao', 'Modelo de supervisão, responsabilidade e exceções', 3, '2-4'),
  s('estruturas-hibridas', 'indicadores-capacidade', 'Indicadores de capacidade, qualidade e produtividade', 2, '2-3'),

  // Agentes e Processos Automatizados para Eficiência
  s('agentes-processos', 'diagnostico-leadrix', 'Diagnóstico Leadrix (porta de entrada)', 2, '1-3', { entry: true }),
  s('agentes-processos', 'redesenho-processos-agentes', 'Diagnóstico e redesenho de processos com agentes', 3, '3-4'),
  s('agentes-processos', 'portfolio-priorizacao', 'Portfólio e priorização por impacto, custo, prazo e risco', 3, '2-3'),
  s('agentes-processos', 'implantacao-agentes', 'Implantação e integração de agentes, dados e sistemas', 5, '4-5', { anchor: true }),
  s('agentes-processos', 'governanca-agentes', 'Regras, exceções, supervisão e indicadores dos agentes', 3, '2-4'),

  // Educação e Adoção Produtiva
  s('educacao-adocao', 'workshop-gratuito', 'Workshop gratuito / Workshop Mensal Leadrix', 1, '1', { entry: true }),
  s('educacao-adocao', 'workshop-in-company', 'Workshop in company personalizado por função', 2, '2-3'),
  s('educacao-adocao', 'formacao-executiva', 'Formação Executiva em IA (Curso de Formação Leadrix)', 3, '2-3'),
  s('educacao-adocao', 'multiplicadores-adocao', 'Formação de multiplicadores e acompanhamento de adoção', 3, '3-4'),
  s('educacao-adocao', 'playbook-ia', 'Playbook de IA (métodos, segurança, qualidade e indicadores)', 3, '2-4', { anchor: true }),

  // Novos Negócios, Linhas de Receita e Spin-offs
  s('novos-negocios', 'mapeamento-ativos', 'Mapeamento de ativos, conhecimentos e oportunidades', 3, '2-3'),
  s('novos-negocios', 'teses-negocio', 'Construção e priorização de teses de negócio', 3, '3-4'),
  s('novos-negocios', 'prototipacao-validacao', 'Prototipação, validação e tese econômico-financeira', 4, '3-5'),
  s('novos-negocios', 'spin-off', 'Modelo de implantação, parceria, nova unidade ou spin-off', 5, '4-5', { anchor: true }),
]

// Agrupa por pilar (para selects e telas).
export function servicesByMacro(list = SERVICES_CATALOG) {
  const map = new Map()
  for (const sv of list) {
    if (!map.has(sv.macro_id)) map.set(sv.macro_id, { macro_id: sv.macro_id, macro_label: sv.macro_label, services: [] })
    map.get(sv.macro_id).services.push(sv)
  }
  return [...map.values()]
}
