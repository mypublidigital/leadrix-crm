// Parser canônico da base de clientes (Base_Consolidada_Final.xlsx, aba
// "Base Consolidada"). Implementa as regras de importação do §4 do briefing.
//
// É usado por:
//   - scripts/import-base.mjs   (popula o Supabase via service role)
//   - scripts/gen-demo-data.mjs (gera JSON para o "modo demo" do front)
//
// Mantém uma única fonte de verdade para o parsing/normalização.

import XLSX from 'xlsx'

const SHEET_NAME = 'Base Consolidada'

/** Divide por "|" e limpa vazios. */
function splitPipe(value) {
  return String(value || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Títulos das Propostas vêm separados por quebra de linha (ou às vezes "|"). */
function splitTitles(value) {
  return String(value || '')
    .split(/\r?\n|\|/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** Normaliza tag de macro categoria: espaçamento e barras consistentes. */
function normalizeTag(tag) {
  return String(tag || '')
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Mapeia o texto de Classificação para o enum do CRM. */
export function mapClassification(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (v === 'cliente') return 'cliente'
  if (v === 'parceiro') return 'parceiro'
  if (v === 'cliente / parceiro' || v === 'cliente/parceiro') return 'cliente_parceiro'
  return 'lead' // vazio = lead histórico não classificado
}

function firstNonEmpty(rows, key) {
  for (const r of rows) {
    const v = String(r[key] || '').trim()
    if (v) return v
  }
  return null
}

/**
 * Lê o arquivo e devolve a lista de contas deduplicadas por "Cliente".
 * @param {string} filePath
 * @returns {Array<Account>}
 */
export function parseBase(filePath) {
  const wb = XLSX.readFile(filePath)
  const ws = wb.Sheets[SHEET_NAME] || wb.Sheets[wb.SheetNames[0]]
  if (!ws) throw new Error(`Aba "${SHEET_NAME}" não encontrada no arquivo.`)

  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  // Agrupa linhas por nome do cliente (case-insensitive, alinhado ao índice
  // unique lower(name) do banco — funde variantes "Sicredi" / "SICREDI").
  // Guarda o primeiro nome visto como display.
  const groups = new Map()
  for (const r of rows) {
    const name = String(r['Cliente'] || '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (!groups.has(key)) groups.set(key, { name, rows: [] })
    groups.get(key).rows.push(r)
  }

  const accounts = []
  for (const { name, rows: grp } of groups.values()) {
    // Macro categorias: união normalizada de todas as linhas.
    const macroSet = new Set()
    grp.forEach((r) => splitPipe(r['Macro Categorias']).forEach((t) => macroSet.add(normalizeTag(t))))

    // Anos de relacionamento: união ordenada.
    const yearsSet = new Set()
    grp.forEach((r) => splitPipe(r['Anos de Relacionamento']).forEach((y) => yearsSet.add(y)))
    const relationship_years = [...yearsSet].sort()

    // Propostas: zip de referências x títulos por índice.
    const proposals = []
    grp.forEach((r) => {
      const refs = splitPipe(r['Referências das Propostas'])
      const titles = splitTitles(r['Títulos das Propostas'])
      const n = Math.max(refs.length, titles.length)
      for (let i = 0; i < n; i++) {
        const ref = refs[i] || null
        const title = titles[i] || null
        if (!ref && !title) continue
        // evita duplicar a mesma referência já vista
        if (ref && proposals.some((p) => p.ref === ref)) continue
        proposals.push({ ref, title })
      }
    })

    // Contatos: dedup por (nome+email), primeiro vira principal.
    const contacts = []
    const seen = new Set()
    grp.forEach((r) => {
      const cname = String(r['Contato (Nome)'] || '').trim()
      const email = String(r['Contato (E-mail)'] || '').trim()
      const phone = String(r['Contato (Telefone)'] || '').trim()
      if (!cname && !email && !phone) return
      const key = `${cname.toLowerCase()}|${email.toLowerCase()}`
      if (seen.has(key)) return
      seen.add(key)
      contacts.push({
        name: cname || null,
        email: email || null,
        phone: phone || null,
        role: null,
        is_primary: false,
      })
    })
    if (contacts.length) contacts[0].is_primary = true

    accounts.push({
      name,
      site: firstNonEmpty(grp, 'Site'),
      classification: mapClassification(firstNonEmpty(grp, 'Classificação')),
      macro_categories: [...macroSet].sort(),
      relationship_years,
      proposals,
      status_base: firstNonEmpty(grp, 'Status'),
      observations: firstNonEmpty(grp, 'Observações'),
      contacts,
    })
  }

  return accounts
}
