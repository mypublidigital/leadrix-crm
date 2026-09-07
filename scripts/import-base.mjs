// Importador da base de clientes para o Supabase do CRM (briefing §4).
//
//   npm run import:base
//
// Requer no .env:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, (opcional) BASE_XLSX_PATH
//
// É idempotente: faz upsert de accounts por nome (lower(name)) e regrava os
// contatos da conta. Rode quantas vezes precisar.

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { parseBase } from './parse-base.mjs'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const XLSX_PATH =
  process.env.BASE_XLSX_PATH || 'C:\\Users\\marck\\Downloads\\Base_Consolidada_Final.xlsx'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  console.log('Lendo planilha:', XLSX_PATH)
  const accounts = parseBase(XLSX_PATH)
  console.log(`Parseadas ${accounts.length} contas distintas.`)

  let created = 0
  let updated = 0
  let contactsTotal = 0

  for (const a of accounts) {
    const { contacts, ...accountRow } = a

    // Upsert da conta por nome (unique index em lower(name)).
    const { data: existing } = await supabase
      .from('accounts')
      .select('id')
      .ilike('name', a.name)
      .maybeSingle()

    let accountId
    if (existing) {
      const { error } = await supabase.from('accounts').update(accountRow).eq('id', existing.id)
      if (error) throw error
      accountId = existing.id
      updated++
    } else {
      const { data, error } = await supabase
        .from('accounts')
        .insert(accountRow)
        .select('id')
        .single()
      if (error) throw error
      accountId = data.id
      created++
    }

    // Regrava contatos da conta (substitui o conjunto).
    await supabase.from('contacts').delete().eq('account_id', accountId)
    if (contacts.length) {
      const rows = contacts.map((c) => ({ ...c, account_id: accountId }))
      const { error } = await supabase.from('contacts').insert(rows)
      if (error) throw error
      contactsTotal += rows.length
    }
  }

  console.log(`\nConcluído: ${created} criadas, ${updated} atualizadas, ${contactsTotal} contatos.`)
}

main().catch((e) => {
  console.error('Falha na importação:', e.message || e)
  process.exit(1)
})
