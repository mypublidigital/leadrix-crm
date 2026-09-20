// Perfis de acesso do CRM.
//
//   admin     — tudo, inclusive usuários e exclusão de oportunidades.
//   marketing — tudo, menos o módulo de usuários.
//   vendas    — sem usuários e sem o módulo de custo: vê resultados
//               (leads, ganhos, receita, conversão), não o custo nem o ROI.
//
// Aqui é só a regra da interface. A garantia de verdade está no banco (RLS e
// políticas da migração 0011): esconder botão não protege quem chama a API.

export const ROLES = {
  admin: { label: 'Administrador', help: 'Acesso total, incluindo usuários, custos e exclusão de oportunidades.' },
  marketing: { label: 'Marketing', help: 'Tudo menos o cadastro de usuários.' },
  vendas: { label: 'Vendas', help: 'Sem usuários e sem custos — vê os resultados comerciais.' },
}

export const ROLE_IDS = Object.keys(ROLES)

const MATRIX = {
  'users.manage': ['admin'],
  'costs.view': ['admin', 'marketing'],
  'costs.edit': ['admin', 'marketing'],
  'opportunity.delete': ['admin'],
  'templates.manage': ['admin', 'marketing'],
  'email.send': ['admin', 'marketing', 'vendas'],
  'results.view': ['admin', 'marketing', 'vendas'],
  'content.manage': ['admin', 'marketing', 'vendas'],
  'settings.view': ['admin', 'marketing', 'vendas'],
}

export function can(role, action) {
  const allowed = MATRIX[action]
  if (!allowed) return false
  return allowed.includes(role || 'vendas')
}

/** Papel válido a partir do metadado do usuário (default: o mais restrito). */
export function normalizeRole(raw) {
  const r = String(raw || '').toLowerCase()
  if (r === 'admin' || r === 'administrador') return 'admin'
  if (r === 'marketing') return 'marketing'
  return 'vendas'
}
