// Parser de upload (CSV/Excel) no navegador. Reaplica as regras de importação
// (§4) sobre um arquivo enviado pelo usuário. xlsx é importado dinamicamente
// para não pesar o bundle principal.
//
// Cada conta sai com `warnings: [{ linha, campo, msg }]` — problemas de dados
// (CNPJ inválido, classificação/porte/termômetro fora do domínio, e-mail mal
// formatado) nunca são gravados como estão: o campo problemático vira `null`
// (ou, no caso da classificação, cai no default seguro) e o motivo fica
// registrado no aviso, em vez de ser aceito silenciosamente ou quebrar a
// gravação no banco (colunas de enum/CHECK constraint) — DEF-CRM-004.
//
// `linha` é o número da linha NA PLANILHA (o que o usuário vê no Excel), para
// ele conseguir achar e corrigir o dado na origem. Vem do `__rowNum__` do
// SheetJS, não da posição no array: linhas em branco são puladas na leitura e
// contar posição daria número errado.

import { isValidEmail, isValidCNPJ, formatCNPJ, matchEnumDomain } from './validators'
import { SEGMENTS, ACCOUNT_SIZES, THERMOMETER } from './constants'

const splitPipe = (v) => String(v || '').split('|').map((s) => s.trim()).filter(Boolean)
const splitTitles = (v) => String(v || '').split(/\r?\n|\|/).map((s) => s.trim()).filter(Boolean)
const normTag = (t) => String(t || '').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim()

// Classificação: aceita as variações conhecidas; qualquer outro texto não
// vazio vira aviso (e cai no default seguro "lead" — a coluna é NOT NULL).
function mapClassification(raw) {
  const v = String(raw || '').trim().toLowerCase()
  if (!v) return { value: 'lead', warning: null }
  if (v === 'cliente') return { value: 'cliente', warning: null }
  if (v === 'parceiro') return { value: 'parceiro', warning: null }
  if (v === 'cliente / parceiro' || v === 'cliente/parceiro') return { value: 'cliente_parceiro', warning: null }
  return {
    value: 'lead',
    campo: 'Classificação',
    warning: `"${raw}" não reconhecida (aceitos: Cliente, Parceiro, Cliente / Parceiro) — tratada como Lead histórico.`,
  }
}

// Porte/Segmento/Termômetro: só aceita valores do domínio oficial; fora
// disso, o campo fica vazio (não grava lixo num enum/CHECK do banco) e a
// linha ganha um aviso explicando o porquê.
function mapDomain(raw, domain, fieldLabel) {
  const v = String(raw || '').trim()
  if (!v) return { value: null, warning: null }
  const matched = matchEnumDomain(v, domain)
  if (matched) return { value: matched, warning: null }
  const accepted = Object.values(domain).map((l) => String(l).split('(')[0].trim()).join(', ')
  return { value: null, campo: fieldLabel, warning: `"${raw}" fora do domínio permitido (aceitos: ${accepted}) — não importado.` }
}

// Termômetro: aceita 75, "75" e "75%". Célula formatada como porcentagem no
// Excel chega como fração (75% vira 0.75), então fração que bate no domínio ao
// virar percentual também é aceita — antes um valor legítimo era recusado.
function mapCommercialTemp(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return { value: null, warning: null }
  const validos = Object.keys(THERMOMETER).map(Number)
  const n = Number(v.replace('%', '').trim())
  if (!Number.isNaN(n)) {
    if (validos.includes(n)) return { value: n, warning: null }
    const comoPercentual = Math.round(n * 100)
    if (n > 0 && n <= 1 && validos.includes(comoPercentual)) return { value: comoPercentual, warning: null }
  }
  return { value: null, campo: 'Termômetro', warning: `"${raw}" fora do domínio permitido (0, 50, 60, 75, 90 ou 100) — não importado.` }
}

// CNPJ: vazio é aceitável (campo opcional); presente mas inválido (tamanho
// ou dígito verificador) vira aviso e não é gravado.
function mapCNPJ(raw) {
  const v = String(raw || '').trim()
  if (!v) return { value: null, warning: null }
  if (isValidCNPJ(v)) return { value: formatCNPJ(v), warning: null }
  return { value: null, campo: 'CNPJ', warning: `"${raw}" inválido (dígito verificador não confere) — não importado.` }
}

// aceita variações de nome de coluna
const COL = {
  name: ['Cliente', 'Nome', 'Empresa', 'Razão Social', 'Conta'],
  refs: ['Referências das Propostas', 'Referencias das Propostas'],
  titles: ['Títulos das Propostas', 'Titulos das Propostas'],
  macro: ['Macro Categorias', 'Macro Categoria', 'Categorias'],
  years: ['Anos de Relacionamento', 'Anos'],
  cname: ['Contato (Nome)', 'Contato', 'Nome do Contato'],
  cemail: ['Contato (E-mail)', 'E-mail', 'Email', 'E-mail do Contato'],
  cphone: ['Contato (Telefone)', 'Telefone', 'Fone'],
  obs: ['Observações', 'Observacoes', 'Obs'],
  classification: ['Classificação', 'Classificacao', 'Tipo'],
  site: ['Site', 'Website', 'URL'],
  status: ['Status', 'Situação'],
  cnpj: ['CNPJ'],
  segment: ['Segmento'],
  accountSize: ['Porte'],
  commercialTemp: ['Termômetro', 'Termometro', 'Saúde', 'Saude', 'Termômetro Comercial'],
}

// Normaliza para matching: minúsculas + sem acento + colapsa espaços.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

// Casa a coluna por nome, ignorando acento/caixa (robusto a CSV com codepage).
function pick(row, keys) {
  const wanted = keys.map(norm)
  for (const rk of Object.keys(row)) {
    if (wanted.includes(norm(rk))) {
      const v = String(row[rk] ?? '').trim()
      if (v !== '') return v
    }
  }
  return ''
}

// Número da linha como o usuário a vê no Excel (1-based, contando o cabeçalho).
const linhaDe = (row) => (typeof row?.__rowNum__ === 'number' ? row.__rowNum__ + 1 : null)

// Primeira linha do grupo que traz a coluna preenchida — devolve o valor e a
// linha da planilha de onde ele veio, para o aviso apontar o lugar certo.
function pickComLinha(grp, keys) {
  const row = grp.find((r) => pick(r, keys))
  return { valor: row ? pick(row, keys) : '', linha: row ? linhaDe(row) : null }
}

export async function parseUploadFile(file) {
  const XLSX = (await import('xlsx')).default || (await import('xlsx'))
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', codepage: 65001 }) // força UTF-8 (CSV)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

  // agrupa por nome (case-insensitive)
  const groups = new Map()
  for (const r of rows) {
    const name = pick(r, COL.name)
    if (!name) continue
    const key = name.toLowerCase()
    if (!groups.has(key)) groups.set(key, { name, rows: [] })
    groups.get(key).rows.push(r)
  }

  const accounts = []
  for (const { name, rows: grp } of groups.values()) {
    const macroSet = new Set()
    grp.forEach((r) => splitPipe(pick(r, COL.macro)).forEach((t) => macroSet.add(normTag(t))))
    const yearsSet = new Set()
    grp.forEach((r) => splitPipe(pick(r, COL.years)).forEach((y) => yearsSet.add(y)))

    const proposals = []
    grp.forEach((r) => {
      const refs = splitPipe(pick(r, COL.refs))
      const titles = splitTitles(pick(r, COL.titles))
      const n = Math.max(refs.length, titles.length)
      for (let i = 0; i < n; i++) {
        const ref = refs[i] || null, title = titles[i] || null
        if (!ref && !title) continue
        if (ref && proposals.some((p) => p.ref === ref)) continue
        proposals.push({ ref, title })
      }
    })

    const warnings = []

    const contacts = []
    const seen = new Set()
    grp.forEach((r) => {
      const cname = pick(r, COL.cname), email = pick(r, COL.cemail), phone = pick(r, COL.cphone)
      if (!cname && !email && !phone) return
      const k = `${cname.toLowerCase()}|${email.toLowerCase()}`
      if (seen.has(k)) return
      seen.add(k)
      if (email && !isValidEmail(email)) {
        warnings.push({
          linha: linhaDe(r),
          campo: 'E-mail do contato',
          msg: `"${email}" (contato "${cname || 'sem nome'}") com formato inválido — verifique antes de usar.`,
        })
      }
      contacts.push({ name: cname || null, email: email || null, phone: phone || null, role: null, is_primary: false })
    })
    if (contacts.length) contacts[0].is_primary = true

    const src = {
      classification: pickComLinha(grp, COL.classification),
      cnpj: pickComLinha(grp, COL.cnpj),
      segment: pickComLinha(grp, COL.segment),
      accountSize: pickComLinha(grp, COL.accountSize),
      commercialTemp: pickComLinha(grp, COL.commercialTemp),
      status: pickComLinha(grp, COL.status),
      obs: pickComLinha(grp, COL.obs),
    }
    const classification = mapClassification(src.classification.valor)
    const cnpj = mapCNPJ(src.cnpj.valor)
    const segment = mapDomain(src.segment.valor, SEGMENTS, 'Segmento')
    const accountSize = mapDomain(src.accountSize.valor, ACCOUNT_SIZES, 'Porte')
    const commercialTemp = mapCommercialTemp(src.commercialTemp.valor)

    // Cada aviso aponta a linha exata de onde o valor problemático veio; quando
    // a coluna nem existe na planilha, cai na primeira linha do grupo.
    const linhaPadrao = linhaDe(grp[0])
    ;[
      [classification, src.classification.linha],
      [cnpj, src.cnpj.linha],
      [segment, src.segment.linha],
      [accountSize, src.accountSize.linha],
      [commercialTemp, src.commercialTemp.linha],
    ].forEach(([r, linha]) => {
      if (r.warning) warnings.push({ linha: linha ?? linhaPadrao, campo: r.campo, msg: r.warning })
    })

    accounts.push({
      name,
      site: pick(grp[0], COL.site) || null,
      classification: classification.value,
      cnpj: cnpj.value,
      segment: segment.value,
      account_size: accountSize.value,
      commercial_temp: commercialTemp.value,
      macro_categories: [...macroSet].sort(),
      relationship_years: [...yearsSet].sort(),
      proposals,
      status_base: src.status.valor || null,
      observations: src.obs.valor || null,
      contacts,
      warnings,
      linhas: grp.map(linhaDe).filter((n) => n != null),
    })
  }
  return accounts
}
