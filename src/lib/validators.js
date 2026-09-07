// Validações reutilizáveis de dados de entrada (importador, formulários).

// E-mail: checagem pragmática de formato (não pretende ser RFC 5322 completo).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(email) {
  return EMAIL_RE.test(String(email || '').trim())
}

/** Mantém só dígitos. */
export function onlyDigits(v) {
  return String(v || '').replace(/\D/g, '')
}

/** Valida CNPJ (14 dígitos + dígitos verificadores, algoritmo oficial). */
export function isValidCNPJ(raw) {
  const d = onlyDigits(raw)
  if (d.length !== 14) return false
  if (/^(\d)\1{13}$/.test(d)) return false // todos os dígitos iguais (ex.: 00000000000000)

  const calcDigit = (base) => {
    const weights = base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = base.split('').reduce((s, digit, i) => s + Number(digit) * weights[i], 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const base12 = d.slice(0, 12)
  const d1 = calcDigit(base12)
  const d2 = calcDigit(base12 + d1)
  return d === base12 + String(d1) + String(d2)
}

/** Formata 14 dígitos como 00.000.000/0000-00 (assume entrada já válida). */
export function formatCNPJ(raw) {
  const d = onlyDigits(raw)
  if (d.length !== 14) return raw
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

// Normaliza texto para matching: minúsculas, sem acento, espaços colapsados.
export function normText(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Casa um valor de texto contra um domínio de enum { key: label }, aceitando
 * a própria key (com/sem hífen/espaço) ou a primeira palavra do label
 * (ex.: "PME" de "PME (<500 contas)"). Retorna a key ou null se não casar.
 */
export function matchEnumDomain(raw, domain) {
  const v = normText(raw).replace(/[-_]/g, ' ')
  if (!v) return null
  for (const [key, label] of Object.entries(domain)) {
    const keyNorm = normText(key).replace(/[-_]/g, ' ')
    const labelHead = normText(String(label).split('(')[0]).replace(/[-_]/g, ' ').trim()
    if (v === keyNorm || v === labelHead) return key
  }
  return null
}
