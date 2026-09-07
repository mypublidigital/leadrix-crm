// Gera src/demo/accounts.json a partir da planilha real, para o "modo demo"
// do front funcionar antes de existir o projeto Supabase do CRM.
//
//   npm run gen:demo      (usa BASE_XLSX_PATH ou o default de Downloads)

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseBase } from './parse-base.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const xlsxPath =
  process.env.BASE_XLSX_PATH ||
  'C:\\Users\\marck\\Downloads\\Base_Consolidada_Final.xlsx'

const accounts = parseBase(xlsxPath)

// Atribui ids estáveis (slug) e estágio de funil inicial para a demo.
function slugify(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const usedIds = new Set()
function uniqueId(name) {
  let base = `demo-${slugify(name)}`
  let id = base
  let n = 2
  while (usedIds.has(id)) id = `${base}-${n++}`
  usedIds.add(id)
  return id
}

const enriched = accounts.map((a, i) => ({
  id: uniqueId(a.name),
  ...a,
  crm_stage: a.classification === 'lead' ? 'lead' : 'qualificado',
  segment: null,
  account_size: null,
  health: a.classification === 'lead' ? null : 'verde',
  owner_id: null,
  created_at: new Date(2026, 0, 1 + (i % 28)).toISOString(),
}))

const outDir = resolve(__dirname, '..', 'src', 'demo')
mkdirSync(outDir, { recursive: true })
const outFile = resolve(outDir, 'accounts.json')
writeFileSync(outFile, JSON.stringify(enriched, null, 2), 'utf8')

console.log(`OK: ${enriched.length} contas -> ${outFile}`)
const byClass = enriched.reduce((m, a) => ((m[a.classification] = (m[a.classification] || 0) + 1), m), {})
console.log('Por classificação:', byClass)
