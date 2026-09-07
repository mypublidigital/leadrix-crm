// Aniversários dos contatos.
//
// Um aniversário se repete todo ano: o que importa para o filtro é DIA e MÊS,
// nunca o ano de nascimento. Por isso a data guardada é projetada nos anos que
// o período abrange antes de testar se cai dentro dele — comparar a data de
// nascimento direto com o intervalo só acharia quem nasceu naquele ano.

import { isWithinInterval } from 'date-fns'

const bissexto = (ano) => (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0

// "1985-06-15" (ou Date) -> { ano, mes, dia }; devolve null se não der para ler.
function partes(birthDate) {
  if (!birthDate) return null
  const s = typeof birthDate === 'string' ? birthDate : new Date(birthDate).toISOString()
  const m = s.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, ano, mes, dia] = m.map(Number)
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return { ano, mes, dia }
}

// Data do aniversário dentro de um ano específico.
// 29/02 em ano não bissexto é comemorado em 28/02.
export function aniversarioNoAno(birthDate, ano) {
  const p = partes(birthDate)
  if (!p) return null
  const dia = p.mes === 2 && p.dia === 29 && !bissexto(ano) ? 28 : p.dia
  return new Date(ano, p.mes - 1, dia)
}

// Idade que a pessoa completa no aniversário daquele ano. Null quando o ano de
// nascimento não foi informado de forma plausível (o campo aceita qualquer ano,
// e muita gente não sabe o do contato).
export function idadeNoAno(birthDate, ano) {
  const p = partes(birthDate)
  if (!p || p.ano < 1900 || p.ano >= ano) return null
  return ano - p.ano
}

// Contatos que fazem aniversário dentro do intervalo, achatados com a conta.
// `accounts` é a lista que a tela já carrega (cada uma com `contacts`).
export function aniversariantesNoIntervalo(accounts, start, end) {
  if (!start || !end) return []
  // Só os anos das pontas: um aniversário cai no máximo uma vez por ano, então
  // projetar nesses dois já cobre qualquer intervalo (inclusive os abertos).
  const anos = [...new Set([start.getFullYear(), end.getFullYear()])]
  const achados = []
  for (const conta of accounts || []) {
    for (const contato of conta.contacts || []) {
      if (!contato.birth_date) continue
      for (const ano of anos) {
        const data = aniversarioNoAno(contato.birth_date, ano)
        if (data && isWithinInterval(data, { start, end })) {
          achados.push({ ...contato, conta, data, idade: idadeNoAno(contato.birth_date, ano) })
          break // uma ocorrência por contato, mesmo que o intervalo cruze o ano
        }
      }
    }
  }
  return achados.sort((a, b) => a.data - b.data || String(a.name).localeCompare(String(b.name)))
}
