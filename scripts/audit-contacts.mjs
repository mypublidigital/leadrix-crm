/**
 * Auditoria de integridade dos contatos.
 *
 * Compara os contatos gravados no Supabase com a planilha-base e aponta o que
 * está faltando. Nasceu do incidente de ago/2026, em que `saveContacts`
 * apagava os contatos antes de reinserir: quando a gravação falhava, os
 * contatos sumiam quando a regravação falhava.
 *
 *   npm run audit:contacts            # só relata o que está faltando
 *   npm run audit:contacts -- --fix   # reinsere o que falta (nunca apaga)
 *
 * Precisa de SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e BASE_XLSX_PATH no .env.
 */
import 'dotenv/config'
import { parseBase } from './parse-base.mjs'

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const XLSX = process.env.BASE_XLSX_PATH || 'C:\\Users\\marck\\Downloads\\Base_Consolidada_Final.xlsx'
const FIX = process.argv.includes('--fix')

if (!URL_BASE || !KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const REST = `${URL_BASE}/rest/v1`
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

// Casamento por E-MAIL quando existe; só cai no nome quando a planilha não
// traz e-mail.
//
// A chave anterior era `nome|email` e acusava perda onde não havia: a coluna de
// nome da planilha costuma ser inconsistente (às vezes traz o próprio e-mail
// no lugar do nome, às vezes "Sobrenome, Nome") — enquanto no CRM eles estão com o
// nome correto. Eram 21 falsos positivos, e com --fix isso INSERIRIA 20
// duplicatas em vez de restaurar algo.
const email = (c) => (c.email || '').trim().toLowerCase()
const nome = (c) => (c.name || '').trim().toLowerCase()
function jaExiste(contato, doBanco) {
  const e = email(contato)
  if (e) return doBanco.emails.has(e)
  const n = nome(contato)
  return n ? doBanco.nomes.has(n) : true // linha sem nome e sem e-mail não é contato
}
const indexar = (contatos) => ({
  emails: new Set((contatos || []).map(email).filter(Boolean)),
  nomes: new Set((contatos || []).map(nome).filter(Boolean)),
})

const planilha = parseBase(XLSX)
const contas = await (await fetch(`${REST}/accounts?select=id,name,contacts(id,name,email)`, { headers: H })).json()
const porNome = new Map(contas.map((a) => [a.name.toLowerCase(), a]))

const problemas = []
let esperadosTotal = 0
let noBancoTotal = 0

for (const p of planilha) {
  esperadosTotal += p.contacts.length
  const acc = porNome.get(p.name.toLowerCase())
  if (!acc) {
    if (p.contacts.length) problemas.push({ nome: p.name, motivo: 'conta ausente no banco', faltando: p.contacts })
    continue
  }
  noBancoTotal += (acc.contacts || []).length
  const noBanco = indexar(acc.contacts)
  const faltando = p.contacts.filter((c) => !jaExiste(c, noBanco))
  if (faltando.length) problemas.push({ nome: p.name, id: acc.id, atual: (acc.contacts || []).length, faltando })
}

console.log(`contas na planilha ............ ${planilha.length}`)
console.log(`contatos esperados ............ ${esperadosTotal}`)
console.log(`contatos no banco ............. ${noBancoTotal}`)
console.log(`contas com contatos faltando .. ${problemas.length}`)

// Sem process.exit(): ele derruba handles de arquivo ainda abertos do xlsx e o
// libuv imprime "Assertion failed" no fim de toda execução. exitCode encerra
// limpo depois que o event loop esvazia.
if (!problemas.length) {
  console.log('\n✓ base íntegra — nenhum contato faltando.')
} else {
  problemas.sort((a, b) => b.faltando.length - a.faltando.length)
  for (const p of problemas) {
    console.log(`  ${p.nome}: faltam ${p.faltando.length}${p.motivo ? ` (${p.motivo})` : ''}`)
    for (const c of p.faltando) {
      console.log(`      "${c.name || 'sem nome'}" <${c.email || 'sem e-mail'}>`)
    }
  }
  const totalFaltando = problemas.reduce((n, p) => n + p.faltando.length, 0)
  console.log(`\nTOTAL FALTANDO: ${totalFaltando}`)

  if (!FIX) {
    console.log('\nConfira a lista acima antes de restaurar: contato que existe no CRM')
    console.log('com nome diferente do da planilha aparece aqui e viraria duplicata.')
    console.log('Para reinserir os que faltam de fato: npm run audit:contacts -- --fix')
    process.exitCode = 1
  } else {
    let inseridos = 0
    for (const p of problemas) {
      if (!p.id) { console.log(`  pulando ${p.nome}: conta não existe`); continue }
      const jaTemPrincipal = p.atual > 0
      const rows = p.faltando.map((c, i) => ({
        account_id: p.id,
        name: c.name?.trim() || null,
        role: c.role?.trim() || null,
        email: c.email?.trim() || null,
        phone: c.phone?.trim() || null,
        is_primary: !jaTemPrincipal && i === 0,
      }))
      const r = await fetch(`${REST}/contacts`, { method: 'POST', headers: H, body: JSON.stringify(rows) })
      if (!r.ok) { console.error(`  ERRO em ${p.nome}: ${r.status} ${(await r.text()).slice(0, 160)}`); continue }
      console.log(`  ${p.nome}: +${rows.length} restaurado(s)`)
      inseridos += rows.length
    }
    console.log(`\n✓ ${inseridos} contato(s) restaurado(s).`)
  }
}
