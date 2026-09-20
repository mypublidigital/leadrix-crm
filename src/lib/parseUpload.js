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
import { SEGMENTS, ACCOUNT_SIZES, THERMOMETER, ABM_TIERS, LEAD_SOURCES, LEAD_ORIGINATORS } from './constants'
import { CAMPAIGNS } from '../data/abmContext'

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
  if (v === 'lead') return { value: 'lead', warning: null }
  if (['conta-alvo', 'conta alvo', 'conta-alvo (icp)', 'icp', 'alvo'].includes(v)) return { value: 'conta_alvo', warning: null }
  return {
    value: 'lead',
    campo: 'Classificação',
    warning: `"${raw}" não reconhecida (aceitos: Cliente, Conta-alvo, Parceiro, Lead) — tratada como Lead.`,
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

// Nível ABM aceita "1:1", "1:few", "1:many" ou os rótulos por extenso.
const ABM_TIERS_DOMAIN = Object.fromEntries(Object.entries(ABM_TIERS).map(([k, v]) => [k, v.label.split(' · ')[1]]))

// Campanha aceita o id ou o nome da tese.
const CAMPAIGN_DOMAIN = Object.fromEntries(Object.entries(CAMPAIGNS).map(([k, v]) => [k, v.label]))

// Comissão de indicação: aceita 10, "10", "10%" e célula formatada como
// porcentagem no Excel (0,1 chega como fração). Fora de 0–100 vira aviso.
function mapCommission(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return { value: null, warning: null }
  const n = Number(v.replace('%', '').replace(',', '.').trim())
  if (Number.isNaN(n)) {
    return { value: null, campo: 'Comissão de indicação (%)', warning: `"${raw}" não é um número — não importado.` }
  }
  const pct = n > 0 && n < 1 ? n * 100 : n
  if (pct < 0 || pct > 100) {
    return { value: null, campo: 'Comissão de indicação (%)', warning: `"${raw}" fora da faixa 0 a 100 — não importado.` }
  }
  return { value: Math.round(pct * 100) / 100, warning: null }
}

// aceita variações de nome de coluna
const COL = {
  name: ['Cliente', 'Nome', 'Empresa', 'Razão Social', 'Conta'],
  refs: ['Referências das Propostas', 'Referencias das Propostas'],
  titles: ['Títulos das Propostas', 'Titulos das Propostas'],
  macro: ['Macro Categorias', 'Macro Categoria', 'Categorias'],
  years: ['Anos de Relacionamento', 'Anos'],
  cname: ['Contato (Nome)', 'Contato', 'Nome do Contato'],
  crole: ['Contato (Cargo)', 'Cargo', 'Cargo do Contato'],
  cemail: ['Contato (E-mail)', 'E-mail', 'Email', 'E-mail do Contato'],
  cphone: ['Contato (Telefone)', 'Telefone', 'Fone'],
  obs: ['Observações', 'Observacoes', 'Obs'],
  classification: ['Classificação', 'Classificacao', 'Tipo'],
  site: ['Site', 'Website', 'URL'],
  status: ['Status', 'Situação'],
  cnpj: ['CNPJ'],
  segment: ['Mercado', 'Segmento', 'Macrossegmento', 'Macro segmento'],
  micro: ['Microssegmento', 'Micro segmento', 'Subsegmento'],
  tier: ['Nível ABM', 'Nivel ABM', 'Tier ABM', 'Tier'],
  accountSize: ['Porte'],
  campaign: ['Campanha'],
  leadSource: ['Canal de origem', 'Canal'],
  originSource: ['Origem do lead', 'Origem'],
  originOther: ['Origem (especificar)', 'Especificar origem'],
  referredBy: ['Quem indicou', 'Indicado por'],
  commission: ['Comissão de indicação (%)', 'Comissao de indicacao (%)', 'Comissão (%)', 'Comissao (%)'],
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
      // O cargo alimenta o mapa do grupo decisor — vale a pena trazer da planilha.
      contacts.push({
        name: cname || null, role: pick(r, COL.crole) || null,
        email: email || null, phone: phone || null, is_primary: false,
      })
    })
    if (contacts.length) contacts[0].is_primary = true

    const src = {
      classification: pickComLinha(grp, COL.classification),
      cnpj: pickComLinha(grp, COL.cnpj),
      segment: pickComLinha(grp, COL.segment),
      micro: pickComLinha(grp, COL.micro),
      tier: pickComLinha(grp, COL.tier),
      accountSize: pickComLinha(grp, COL.accountSize),
      commercialTemp: pickComLinha(grp, COL.commercialTemp),
      status: pickComLinha(grp, COL.status),
      obs: pickComLinha(grp, COL.obs),
      campaign: pickComLinha(grp, COL.campaign),
      leadSource: pickComLinha(grp, COL.leadSource),
      originSource: pickComLinha(grp, COL.originSource),
      originOther: pickComLinha(grp, COL.originOther),
      referredBy: pickComLinha(grp, COL.referredBy),
      commission: pickComLinha(grp, COL.commission),
    }
    const classification = mapClassification(src.classification.valor)
    const cnpj = mapCNPJ(src.cnpj.valor)
    const segment = mapDomain(src.segment.valor, SEGMENTS, 'Mercado')
    const tier = mapDomain(src.tier.valor, ABM_TIERS_DOMAIN, 'Nível ABM')
    const accountSize = mapDomain(src.accountSize.valor, ACCOUNT_SIZES, 'Porte')
    const commercialTemp = mapCommercialTemp(src.commercialTemp.valor)
    const campaign = mapDomain(src.campaign.valor, CAMPAIGN_DOMAIN, 'Campanha')
    const leadSource = mapDomain(src.leadSource.valor, LEAD_SOURCES, 'Canal de origem')
    const originSource = mapDomain(src.originSource.valor, LEAD_ORIGINATORS, 'Origem do lead')
    const commission = mapCommission(src.commission.valor)

    // "Outros" sem a especificação é recusado pelo banco — vira aviso aqui,
    // com a linha da planilha, em vez de erro cru na gravação.
    if (originSource.value === 'outros' && !src.originOther.valor) {
      originSource.value = null
      originSource.campo = 'Origem (especificar)'
      originSource.warning = 'Origem "Outros" exige a coluna "Origem (especificar)" preenchida — origem não importada.'
    }

    // Cada aviso aponta a linha exata de onde o valor problemático veio; quando
    // a coluna nem existe na planilha, cai na primeira linha do grupo.
    const linhaPadrao = linhaDe(grp[0])
    ;[
      [classification, src.classification.linha],
      [cnpj, src.cnpj.linha],
      [segment, src.segment.linha],
      [tier, src.tier.linha],
      [accountSize, src.accountSize.linha],
      [commercialTemp, src.commercialTemp.linha],
      [campaign, src.campaign.linha],
      [leadSource, src.leadSource.linha],
      [originSource, src.originSource.linha],
      [commission, src.commission.linha],
    ].forEach(([r, linha]) => {
      if (r.warning) warnings.push({ linha: linha ?? linhaPadrao, campo: r.campo, msg: r.warning })
    })

    accounts.push({
      name,
      site: pick(grp[0], COL.site) || null,
      classification: classification.value,
      cnpj: cnpj.value,
      segment: segment.value,
      // Microssegmento é texto da tabela editável; só grava junto com um mercado válido.
      micro_segment: segment.value ? src.micro.valor || null : null,
      abm_tier: tier.value,
      account_size: accountSize.value,
      commercial_temp: commercialTemp.value,
      campaign: campaign.value,
      lead_source: leadSource.value,
      origin_details: src.originOther.valor && originSource.value !== 'outros' ? src.originOther.valor : null,
      origin_source: originSource.value,
      origin_source_other: originSource.value === 'outros' ? src.originOther.valor || null : null,
      referred_by: src.referredBy.valor || null,
      // Sem a coluna de comissão as chaves nem entram no objeto: assim a conta
      // nova nasce com o padrão do banco (não gera comissão) e a reimportação
      // não apaga um percentual que foi ajustado à mão no CRM.
      ...(commission.value != null
        ? { referral_commission: commission.value > 0, referral_commission_pct: commission.value }
        : {}),
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
