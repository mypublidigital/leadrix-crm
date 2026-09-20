// Gera a planilha modelo de importação de contas.
//
//   npm run modelo:importacao
//
// Sai em `Modelo_Importacao_Leadrix_CRM.xlsx`, com três abas: Contas (cabeçalho
// + exemplos), Instruções e Valores aceitos. Os domínios são lidos do próprio
// código — mudou a taxonomia, é só rodar de novo.

import * as XLSX from 'xlsx'
import { readFileSync } from 'node:fs'

const root = new URL('../src/', import.meta.url)

// constants.js importa a taxonomia por caminho relativo; para carregá-lo fora
// do bundler, o import vira o endereço absoluto do arquivo.
const asModule = async (rel) => {
  const src = readFileSync(new URL(rel, root), 'utf8')
    .replace(/from '\.\.\/data\/leadrix'/g, `from '${new URL('data/leadrix.js', root).href}'`)
  return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`)
}

const { SEGMENTS, ACCOUNT_SIZES, ABM_TIERS, LEAD_SOURCES, LEAD_ORIGINATORS, THERMOMETER, CLASSIFICATIONS } =
  await asModule('lib/constants.js')
const { CAMPAIGNS } = await import(new URL('data/abmContext.js', root).href)
const { MARKETS, MARKET_IDS } = await import(new URL('data/leadrix.js', root).href)

const HEADERS = [
  'Cliente', 'CNPJ', 'Site', 'Classificação', 'Mercado', 'Microssegmento', 'Porte',
  'Nível ABM', 'Campanha', 'Termômetro', 'Canal de origem', 'Origem do lead',
  'Origem (especificar)', 'Quem indicou', 'Comissão de indicação (%)',
  'Contato (Nome)', 'Contato (Cargo)', 'Contato (E-mail)', 'Contato (Telefone)', 'Observações',
]

// Duas linhas da mesma conta = dois contatos. Os dados da conta só precisam
// aparecer na primeira linha.
const EXEMPLOS = [
  {
    Cliente: 'Metalúrgica Serra Azul', CNPJ: '11.222.333/0001-81', Site: 'www.serraazul.ind.br',
    'Classificação': 'Conta-alvo', Mercado: 'Indústria', Microssegmento: 'Metalmecânica e autopeças',
    Porte: 'Grande', 'Nível ABM': '1:1', Campanha: 'IA no fluxo real da operação', 'Termômetro': 60,
    'Canal de origem': 'Prospecção ativa (ABM)', 'Origem do lead': 'Boomit', 'Origem (especificar)': '',
    'Quem indicou': '', 'Comissão de indicação (%)': 10,
    'Contato (Nome)': 'Carlos Mendes', 'Contato (Cargo)': 'Diretor de Operações',
    'Contato (E-mail)': 'carlos.mendes@serraazul.ind.br', 'Contato (Telefone)': '+55 11 98888-1111',
    'Observações': 'Trocou de ERP em 2026; processos administrativos ainda em planilha.',
  },
  {
    Cliente: 'Metalúrgica Serra Azul', CNPJ: '', Site: '', 'Classificação': '', Mercado: '', Microssegmento: '',
    Porte: '', 'Nível ABM': '', Campanha: '', 'Termômetro': '', 'Canal de origem': '', 'Origem do lead': '',
    'Origem (especificar)': '', 'Quem indicou': '', 'Comissão de indicação (%)': '',
    'Contato (Nome)': 'Luiza Faria', 'Contato (Cargo)': 'Gerente de TI',
    'Contato (E-mail)': 'luiza.faria@serraazul.ind.br', 'Contato (Telefone)': '', 'Observações': '',
  },
  {
    Cliente: 'Vértice Consultoria Empresarial', CNPJ: '', Site: 'www.vertice.com.br',
    'Classificação': 'Cliente', Mercado: 'Serviços B2B', Microssegmento: 'Consultorias',
    Porte: 'Média', 'Nível ABM': '1:few', Campanha: 'Crescer sem ampliar a estrutura na mesma proporção',
    'Termômetro': 75, 'Canal de origem': 'Indicação', 'Origem do lead': 'Outros',
    'Origem (especificar)': 'Parceiro de tecnologia', 'Quem indicou': 'Ana Prado (evento Febraban)',
    'Comissão de indicação (%)': 5,
    'Contato (Nome)': 'Ricardo Souza', 'Contato (Cargo)': 'Sócio',
    'Contato (E-mail)': 'ricardo@vertice.com.br', 'Contato (Telefone)': '+55 41 96666-3333',
    'Observações': '',
  },
]

const INSTRUCOES = [
  ['Como preencher esta planilha', ''],
  ['', ''],
  ['Obrigatório', 'Só a coluna "Cliente". Todo o resto é opcional.'],
  ['Uma conta por nome', 'Linhas com o mesmo nome de conta são agrupadas. Use uma linha por contato e repita só o nome.'],
  ['Nome é a chave', 'A importação casa pelo NOME (ignorando maiúsculas). Nome existente é atualizado; nome novo cria conta. "Acme" e "Acme Brasil" viram duas contas — padronize antes.'],
  ['Célula vazia não apaga', 'Reimportar não zera o que já está preenchido no CRM: só sobrescreve o que vier preenchido na planilha.'],
  ['Dado fora do padrão', 'Não é gravado: o campo fica vazio e a linha aparece no quadro de avisos da tela, com o número da linha da planilha.'],
  ['CNPJ e e-mail', 'São validados. Inválidos não entram e geram aviso; o resto da linha é importado normalmente.'],
  ['Cargo do contato', 'Vale preencher: é o que monta o mapa do grupo decisor (patrocinador, operações, TI, financeiro, jurídico).'],
  ['Comissão', 'Informe o número do percentual (10 = 10%). Em branco, a conta fica sem comissão de indicação.'],
  ['Origem "Outros"', 'Exige a coluna "Origem (especificar)" preenchida.'],
  ['Colunas', 'A ordem não importa e colunas desconhecidas são ignoradas. Pode apagar as colunas que não usar.'],
  ['', ''],
  ['Onde importar', 'CRM → Importador → selecione o arquivo → confira a pré-visualização e os avisos → Importar.'],
  ['Formatos', 'XLSX, XLS ou CSV (UTF-8).'],
]

const dominio = (obj, fn = (v) => v) => Object.values(obj).map(fn).join(' · ')

const VALORES = [
  ['Coluna', 'Valores aceitos'],
  ['Classificação', dominio(CLASSIFICATIONS, (v) => v.label)],
  ['Mercado', dominio(SEGMENTS)],
  ['Microssegmento', `Texto livre, mas use a lista de Configurações. Ex.: ${MARKET_IDS.map((k) => MARKETS[k].micro[0]).join(' · ')}`],
  ['Porte', dominio(ACCOUNT_SIZES, (v) => v.split(' (')[0])],
  ['Nível ABM', Object.keys(ABM_TIERS).join(' · ')],
  ['Campanha', dominio(CAMPAIGNS, (v) => v.label)],
  ['Termômetro', Object.keys(THERMOMETER).map((k) => `${k}%`).join(' · ')],
  ['Canal de origem', dominio(LEAD_SOURCES)],
  ['Origem do lead', dominio(LEAD_ORIGINATORS, (v) => v.split(' (')[0])],
  ['Comissão de indicação (%)', 'Número de 0 a 100 (10 = 10%)'],
  ['', ''],
  ['Não vem por planilha', 'Pontuação ICP, sinais de intenção, hipótese de valor, oportunidades e custos — preencha no CRM, conta a conta.'],
]

const wb = XLSX.utils.book_new()

const contas = XLSX.utils.json_to_sheet(EXEMPLOS, { header: HEADERS })
contas['!cols'] = HEADERS.map((h) => ({ wch: Math.max(14, Math.min(h.length + 6, 34)) }))
contas['!freeze'] = { xSplit: 1, ySplit: 1 }
XLSX.utils.book_append_sheet(wb, contas, 'Contas')

const instr = XLSX.utils.aoa_to_sheet(INSTRUCOES)
instr['!cols'] = [{ wch: 26 }, { wch: 110 }]
XLSX.utils.book_append_sheet(wb, instr, 'Instruções')

const vals = XLSX.utils.aoa_to_sheet(VALORES)
vals['!cols'] = [{ wch: 26 }, { wch: 110 }]
XLSX.utils.book_append_sheet(wb, vals, 'Valores aceitos')

const destino = process.argv[2] || 'Modelo_Importacao_Leadrix_CRM.xlsx'
XLSX.writeFile(wb, destino)
console.log(`Modelo gerado: ${destino}`)
