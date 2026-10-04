import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Route, ListChecks, Building2, Layers, KanbanSquare, Radar, PenLine,
  Mails, Calculator, FolderOpen, Upload, ShieldCheck, BookOpen, ChevronRight,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { ABM_TIERS, CRM_STAGES, THERMOMETER, STAGE_PROBABILITY, LEAD_ORIGINATORS, formatBRL, formatPct } from '../lib/constants'
import { AGING_LEVELS, AGING_LEVEL_ORDER, DEFAULT_AGING_SLA, ABM_THEORY } from '../data/abmPlaybook'
import { ICP_DIMENSIONS, ICP_BANDS } from '../data/abmContext'
import { MARKETS, MARKET_IDS, PILLARS, PILLAR_IDS } from '../data/leadrix'
import { GLOSSARIO } from '../data/ajuda'
import { ROLES, ROLE_IDS, can } from '../lib/permissions'
import { useAuth } from '../lib/useAuth'

// ╔══════════════════════════════════════════════════════════════╗
// ║  Instruções de uso do CRM                                      ║
// ║                                                                ║
// ║  Manual na própria ferramenta: cada seção explica uma tela, na  ║
// ║  ordem em que o trabalho acontece, com exemplo preenchido.      ║
// ║  As tabelas leem as constantes reais do sistema — se o SLA ou   ║
// ║  o nível mudarem no código, o manual muda junto.                ║
// ╚══════════════════════════════════════════════════════════════╝

const SECOES = [
  { id: 'ciclo', icon: Route, titulo: 'O ciclo de trabalho' },
  { id: 'primeiros-passos', icon: ListChecks, titulo: 'Primeiros passos' },
  { id: 'conta', icon: Building2, titulo: 'A conta e seus campos' },
  { id: 'nivel', icon: Layers, titulo: 'Nível ABM e ICP' },
  { id: 'pipeline', icon: KanbanSquare, titulo: 'Oportunidade, pipeline e aging' },
  { id: 'radar', icon: Radar, titulo: 'Radar ABM' },
  { id: 'conteudo', icon: PenLine, titulo: 'Estúdio de conteúdo' },
  { id: 'mensageria', icon: Mails, titulo: 'Mensageria' },
  { id: 'custos', icon: Calculator, titulo: 'Custo de venda e ROI', need: 'costs.view' },
  { id: 'arquivos', icon: FolderOpen, titulo: 'Arquivos e propostas' },
  { id: 'entrada', icon: Upload, titulo: 'Captura e importação' },
  { id: 'perfis', icon: ShieldCheck, titulo: 'Perfis de acesso' },
  { id: 'glossario', icon: BookOpen, titulo: 'Glossário' },
]

export default function Instrucoes() {
  const { can: pode } = useAuth()
  const secoes = SECOES.filter((s) => !s.need || pode(s.need))

  return (
    <>
      <PageHeader
        eyebrow="Ajuda"
        title="Instruções"
        subtitle="Como usar o CRM, na ordem em que o trabalho acontece. Cada seção tem um exemplo preenchido."
      />
      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <Indice secoes={secoes} />
        <div className="min-w-0 space-y-6">
          <Ciclo />
          <PrimeirosPassos />
          <Conta />
          <Nivel />
          <Pipeline />
          <RadarSec />
          <Conteudo />
          <Mensageria />
          {pode('costs.view') && <Custos />}
          <Arquivos />
          <Entrada />
          <Perfis />
          <Glossario />
        </div>
      </div>
    </>
  )
}

// ── Índice lateral ──────────────────────────────────────────────
function Indice({ secoes }) {
  return (
    <nav className="hidden xl:block">
      <div className="card sticky top-6 p-3">
        <div className="eyebrow px-2 pb-2">Nesta página</div>
        <ul className="space-y-0.5">
          {secoes.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-ink-600 hover:bg-ink-100 hover:text-ink-900"
              >
                <span className="w-4 shrink-0 text-right font-mono text-[10px] text-ink-400">{SECOES.findIndex((x) => x.id === s.id) + 1}</span>
                <s.icon size={13} className="shrink-0 text-brand-500" />
                <span className="min-w-0 truncate">{s.titulo}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

// ── Blocos reutilizáveis ────────────────────────────────────────
function Secao({ id, icon: Icon, titulo, resumo, children }) {
  const n = SECOES.findIndex((s) => s.id === id) + 1
  return (
    <section id={id} className="card scroll-mt-6 p-6">
      <div className="flex items-start gap-3 border-b border-ink-100 pb-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink-900 text-white"><Icon size={19} /></span>
        <div className="min-w-0">
          <div className="eyebrow">Seção {n}</div>
          <h2 className="font-display text-xl font-normal tracking-tight text-ink-900">{titulo}</h2>
          {resumo && <p className="mt-1 text-sm text-ink-600">{resumo}</p>}
        </div>
      </div>
      <div className="space-y-4 pt-4 text-sm leading-relaxed text-ink-700">{children}</div>
    </section>
  )
}

function Exemplo({ titulo = 'Exemplo', children }) {
  return (
    <div className="rounded-lg border-l-4 border-accent-500 bg-accent-50/60 p-4">
      <div className="eyebrow mb-1.5 text-accent-800">{titulo}</div>
      <div className="space-y-1.5 text-sm text-ink-700">{children}</div>
    </div>
  )
}

function Atencao({ children }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      {children}
    </div>
  )
}

// Moldura que imita um pedaço de tela do sistema, para a instrução apontar
// para algo parecido com o que a pessoa vê.
function Tela({ titulo, children }) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200">
      <div className="flex items-center gap-1.5 border-b border-ink-200 bg-ink-100 px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-ink-300" />
        <span className="h-2 w-2 rounded-full bg-ink-300" />
        <span className="ml-1 text-[11px] font-medium text-ink-500">{titulo}</span>
      </div>
      <div className="bg-white p-3">{children}</div>
    </div>
  )
}

function Tabela({ cabecalho, linhas }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-ink-500">
            {cabecalho.map((c, i) => <th key={i} className="py-1.5 pr-3 font-semibold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i} className="border-t border-ink-100 align-top">
              {l.map((c, j) => (
                <td key={j} className={`py-1.5 pr-3 ${j === 0 ? 'font-medium text-ink-900' : 'text-ink-600'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Fluxo numerado com setas, para o passo a passo visual.
function Fluxo({ passos }) {
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {passos.map((p, i) => (
        <div key={p.titulo} className="flex items-stretch gap-2">
          <div className="flex w-40 flex-col rounded-lg border border-ink-200 bg-ink-50/60 p-3">
            <span className="mb-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-[11px] font-bold text-white">{i + 1}</span>
            <span className="text-xs font-semibold text-ink-900">{p.titulo}</span>
            <span className="mt-0.5 text-[11px] leading-snug text-ink-500">{p.desc}</span>
            {p.to && <Link to={p.to} className="mt-1.5 text-[11px] font-medium text-brand-600 hover:underline">Abrir →</Link>}
          </div>
          {i < passos.length - 1 && (
            <ChevronRight size={16} className="mt-7 shrink-0 self-start text-ink-300" />
          )}
        </div>
      ))}
    </div>
  )
}

// ── 1. Ciclo ────────────────────────────────────────────────────
function Ciclo() {
  return (
    <Secao id="ciclo" icon={Route} titulo="O ciclo de trabalho"
      resumo="O CRM não é um arquivo de contatos: é um ciclo. Cada tela é uma etapa dele.">
      <Fluxo passos={[
        { titulo: 'Entra na base', desc: 'Captura, pré-lead manual ou importação de planilha.', to: '/captura' },
        { titulo: 'Vira conta', desc: 'Mercado, microssegmento, porte, origem e contatos.', to: '/contas' },
        { titulo: 'Recebe nível', desc: 'Você pontua o ICP e decide o nível ABM da conta.' },
        { titulo: 'Abre oportunidade', desc: 'Serviço de um dos 4 pilares, valor, dono e etapa.', to: '/pipeline' },
        { titulo: 'Radar sugere', desc: 'Jogadas pelo aging, nível e comitê de compra.', to: '/radar' },
        { titulo: 'Mede o retorno', desc: 'Horas, despesas e comissão viram custo e ROI.', to: '/custos' },
      ]} />
      <p>
        O que faz esse ciclo girar é o <b>aging</b>: toda oportunidade tem um prazo esperado por etapa e,
        quando ele estoura, o Radar transforma o atraso em ação concreta. Se você só cadastra e não
        move, o sistema cobra. É o comportamento desejado.
      </p>
      <Atencao>
        <b>A conta é a unidade de trabalho, não o contato.</b> Em B2B quem decide é um grupo de pessoas.
        Por isso todo cadastro pendura contatos na conta, e não o contrário — e a cobertura desse grupo
        é um dos indicadores que o Radar vigia.
      </Atencao>
    </Secao>
  )
}

// ── 2. Primeiros passos ─────────────────────────────────────────
function PrimeirosPassos() {
  const itens = [
    { t: 'Custo de venda', d: 'Cadastre quem trabalha nas oportunidades com o custo-hora de cada um, as categorias de despesa (viagem, jantar, almoço) e os custos fixos mensais. Sem isso o custo de qualquer ação sai zerado.', to: '/config' },
    { t: 'SLA das etapas', d: 'Na mesma tela, revise os prazos por etapa. É a régua do aging e, por consequência, de tudo que o Radar sugere.', to: '/config' },
    { t: 'Serviços e preços', d: 'Os serviços dos quatro pilares com o valor de referência de cada um.', to: '/servicos' },
    { t: 'Microssegmentos', d: 'A lista de nichos por mercado. Quanto melhor essa lista, melhor a campanha 1:few.', to: '/config' },
    { t: 'Modelos de e-mail', d: 'Os textos que a mensageria usa por evento, com os marcadores de personalização.', to: '/mensageria' },
    { t: 'Base de contas', d: 'Importe a planilha-modelo ou cadastre as contas à mão.', to: '/importar' },
  ]
  return (
    <Secao id="primeiros-passos" icon={ListChecks} titulo="Primeiros passos"
      resumo="A ordem importa: as três primeiras tarefas alimentam cálculos que o resto do sistema usa.">
      <ol className="space-y-2">
        {itens.map((i, n) => (
          <li key={i.t} className="flex gap-3 rounded-lg border border-ink-200 p-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink-900 text-xs font-bold text-white">{n + 1}</span>
            <div className="min-w-0">
              <div className="font-semibold text-ink-900">{i.t}</div>
              <p className="text-ink-600">{i.d}</p>
              <Link to={i.to} className="text-xs font-medium text-brand-600 hover:underline">Abrir a tela →</Link>
            </div>
          </li>
        ))}
      </ol>
      <Atencao>
        Enquanto o custo-hora não estiver preenchido, o Radar continua sugerindo ações — só mostra
        <b> custo estimado R$ 0,00</b>. O ROI da operação só faz sentido depois do item 1.
      </Atencao>
    </Secao>
  )
}

// ── 3. Conta ────────────────────────────────────────────────────
function Conta() {
  return (
    <Secao id="conta" icon={Building2} titulo="A conta e seus campos"
      resumo="Alguns campos são identificação; outros mudam o comportamento do sistema. Vale saber quais são quais.">
      <Tabela
        cabecalho={['Campo', 'Para que serve', 'Muda o comportamento?']}
        linhas={[
          ['Nome', 'Campo-chave, obrigatório. É como a conta aparece em todas as telas.', 'Não'],
          ['Razão social', 'Opcional, para proposta e contrato.', 'Não'],
          ['Classificação', 'Cliente, conta-alvo, parceiro ou lead.', 'Não'],
          ['Mercado', 'Um dos quatro macrossegmentos do site, ou "Outros (especificar)".', <b key="s">Sim</b>],
          ['Microssegmento', 'O nicho dentro do mercado. Busca por digitação.', <b key="m">Sim</b>],
          ['Porte', 'Seed, PME, mid-market ou enterprise.', 'Não'],
          ['Nível ABM', 'Quanto esforço a conta merece. Veja a seção seguinte.', <b key="n">Sim</b>],
          ['Origem do lead', 'O canal por onde chegou: workshop, indicação, inbound, prospecção.', 'Não'],
          ['Quem originou', `Parceiro ou sócio que indicou: ${Object.values(LEAD_ORIGINATORS).slice(0, 4).join(', ')}…`, 'Não'],
          ['Gera comissão', 'Sim/Não e o percentual. Entra no custo de conversão e derruba o ROI.', <b key="c">Sim</b>],
          ['Campanha', 'A tese comercial escolhida para a conta.', <b key="t">Sim</b>],
          ['Sinais de intenção', 'Acontecimentos que abrem janela de abordagem.', <b key="si">Sim</b>],
          ['Contatos', 'As pessoas da conta, com cargo e aniversário.', <b key="co">Sim</b>],
        ]}
      />
      <p>
        O <b>mercado</b> e o <b>microssegmento</b> são os campos de maior efeito: deles saem as personas
        esperadas, as dores, os indicadores e os casos de uso que aparecem nas sugestões e no conteúdo
        gerado. Mercado vazio deixa a sugestão genérica.
      </p>
      <Exemplo titulo="Exemplo de conta bem cadastrada">
        <p><b>Nome:</b> Transportes Vale Verde · <b>Razão social:</b> Vale Verde Logística S.A.</p>
        <p><b>Mercado:</b> {MARKETS.industria?.label || 'Indústria'} · <b>Microssegmento:</b> Logística e transporte · <b>Porte:</b> Mid-market</p>
        <p><b>Nível ABM:</b> {ABM_TIERS['1:few'].label} · <b>Campanha:</b> eficiência operacional</p>
        <p><b>Origem:</b> Workshop mensal · <b>Quem originou:</b> Boomit · <b>Comissão:</b> Sim, 10%</p>
        <p><b>Sinal registrado:</b> implantação de novo ERP em curso</p>
        <p><b>Contatos:</b> diretor de operações (campeão), CFO (financeiro), gerente de TI (técnico)</p>
        <p className="text-ink-500">Com isso o Radar já consegue montar jogada, persona-alvo e conteúdo. Faltando mercado e contatos, a sugestão viraria "descubra quem decide".</p>
      </Exemplo>
      <div>
        <div className="eyebrow mb-1.5">O quinto mercado</div>
        <p>
          Quando a conta não é de nenhum dos quatro mercados estudados, escolha <b>Outros (especificar)</b> e
          escreva o setor real no campo que aparece ao lado — o sistema não deixa salvar sem isso, nem na
          tela nem no banco. Nesses casos as dores e indicadores oferecidos são os genéricos da Leadrix
          (margem, capacidade, qualidade, risco, receita), porque aquele setor não foi estudado em
          profundidade. Antes de subir uma conta "Outros" para nível 1:1, faça a pesquisa à mão.
        </p>
      </div>
      <div>
        <div className="eyebrow mb-1.5">Os quatro mercados e os quatro pilares</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-200 p-3">
            <div className="mb-1 text-xs font-semibold text-ink-900">Mercados</div>
            <ul className="space-y-0.5 text-xs text-ink-600">
              {MARKET_IDS.map((k) => <li key={k}>• {MARKETS[k].label}</li>)}
            </ul>
          </div>
          <div className="rounded-lg border border-ink-200 p-3">
            <div className="mb-1 text-xs font-semibold text-ink-900">Pilares de entrega</div>
            <ul className="space-y-0.5 text-xs text-ink-600">
              {PILLAR_IDS.map((k) => <li key={k}>• {PILLARS[k].label}</li>)}
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          A primeira venda entra por um pilar; a expansão acontece pelos outros. O Radar sugere o
          próximo pilar quando a oportunidade está ganha e passou a janela de pós-venda.
        </p>
      </div>
    </Secao>
  )
}

// ── 4. Nível ABM ────────────────────────────────────────────────
function Nivel() {
  const niveis = [
    { k: '1:1', contas: '10 a 12 contas', largura: 'w-1/3', libera: 'Viagem, jantar executivo, diagnóstico sob medida, business case e landing page da conta.' },
    { k: '1:few', contas: '25 a 35 contas', largura: 'w-2/3', libera: 'Almoço, workshop, conteúdo por cluster, sequências por problema.' },
    { k: '1:many', contas: 'Todas as demais', largura: 'w-full', libera: 'Conteúdo editorial, convite para workshop aberto, monitoramento de sinais.' },
  ]
  return (
    <Secao id="nivel" icon={Layers} titulo="Nível ABM e ICP"
      resumo="O nível é a decisão de quanto esforço cada conta merece. Quem decide é você — o ICP apenas sugere.">
      <div className="space-y-2">
        {niveis.map((n) => (
          <div key={n.k} className="rounded-lg border border-ink-200 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${ABM_TIERS[n.k].color}`}>{ABM_TIERS[n.k].label}</span>
              <span className="text-xs font-medium text-ink-500">{n.contas}</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-ink-100">
              <div className={`h-1.5 rounded-full bg-brand-500 ${n.largura}`} />
            </div>
            <p className="mt-2 text-xs text-ink-600">{ABM_THEORY.tiers[n.k]}</p>
            <p className="mt-1 text-xs text-ink-500"><b>Libera no Radar:</b> {n.libera}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-500">A barra representa a quantidade de contas em cada nível, não a importância: poucas contas no topo, muitas na base.</p>

      <div>
        <div className="eyebrow mb-1.5">Quem define o nível</div>
        <p>
          O campo <b>Nível ABM</b> no cadastro da conta é uma escolha manual, sem valor padrão. O sistema
          nunca o altera por conta própria. O que existe é uma sugestão, em outra tela, que você aceita
          se quiser:
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Abra a conta e, no painel <b>ICP</b>, pontue as sete dimensões.</li>
          <li>O painel calcula o total de 0 a 100 e mostra a faixa correspondente.</li>
          <li>Dentro do painel aparece a opção <b>"Atualizar o nível ABM da conta para…"</b>, desmarcada. Marcando e salvando, o campo do cadastro muda.</li>
          <li>Se o nível do cadastro divergir da faixa do ICP, a conta passa a exibir um aviso — que só avisa, não corrige.</li>
        </ol>
      </div>

      <Tabela
        cabecalho={['Pontuação do ICP', 'Faixa sugerida']}
        linhas={ICP_BANDS.map((b, i) => {
          // O teto da faixa é a menor pontuação de corte acima dela, menos 1.
          const acima = ICP_BANDS.map((x) => x.min).filter((m) => m > b.min)
          const faixa = i === 0
            ? `${b.min} ou mais`
            : b.min === 0
              ? `Abaixo de ${Math.min(...acima)}`
              : `${b.min} a ${Math.min(...acima) - 1}`
          return [faixa, b.label]
        })}
      />
      <p className="text-xs text-ink-500">
        Bloqueadores declarados (sem orçamento, sem patrocinador, veto) jogam a conta para a última
        faixa independentemente da pontuação. É o que evita nível 1:1 em conta que pontua bem no papel
        e não tem quem assine.
      </p>

      <div>
        <div className="eyebrow mb-1.5">As sete dimensões do ICP</div>
        <Tabela
          cabecalho={['Dimensão', 'Peso', 'O que avaliar']}
          linhas={ICP_DIMENSIONS.map((d) => [d.label, String(d.weight), d.what])}
        />
      </div>

      <Atencao>
        <b>Deixar o nível em branco não é neutro.</b> O Radar trata conta sem nível como 1:few. Ela passa
        a receber jogadas de campanha por problema e deixa de receber tanto as de 1:1 quanto as de
        1:many. Em branco é escolher o nível 2 sem perceber.
      </Atencao>

      <Exemplo titulo="Exemplo: a mesma conta em dois níveis">
        <p>
          Conta em <b>negociação</b>, R$ 180.000, parada há 40 dias.
        </p>
        <p>
          Como <b>1:1</b>, o Radar sugere visita presencial do sócio e business case com o CFO.
          Como <b>1:many</b>, sugere envio de material do segmento e convite para o workshop aberto.
          Mesmo atraso, mesmo valor — a conta é que merece investimentos diferentes.
        </p>
      </Exemplo>
    </Secao>
  )
}

// ── 5. Pipeline ─────────────────────────────────────────────────
function Pipeline() {
  return (
    <Secao id="pipeline" icon={KanbanSquare} titulo="Oportunidade, pipeline e aging"
      resumo="A oportunidade é a venda de um serviço para uma conta. É nela que o tempo é medido.">
      <Tabela
        cabecalho={['Etapa', 'Probabilidade usada na previsão', 'SLA padrão (dias)']}
        linhas={Object.keys(CRM_STAGES).map((k) => [
          CRM_STAGES[k].label,
          formatPct(STAGE_PROBABILITY[k]),
          DEFAULT_AGING_SLA[k] ? String(DEFAULT_AGING_SLA[k]) + (k === 'fechado' ? ' (janela de expansão)' : '') : '—',
        ])}
      />
      <p>
        A <b>probabilidade</b> da tabela é automática, por etapa, e serve à previsão ponderada de
        faturamento. O <b>termômetro</b> é diferente: é a leitura manual do dono da oportunidade, de
        {' '}{THERMOMETER[0].short} a {THERMOMETER[100].short}. Os dois convivem: um é regra, o outro é
        julgamento de quem está na conversa.
      </p>

      <div>
        <div className="eyebrow mb-1.5">Como o aging é calculado</div>
        <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
          <p className="font-mono text-xs text-ink-700">aging = dias parado na etapa ÷ SLA da etapa</p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {AGING_LEVEL_ORDER.map((k) => (
              <span key={k} className={`chip ${AGING_LEVELS[k].color}`}>
                {AGING_LEVELS[k].label} {k === 'no_prazo' ? '≤ 1×' : k === 'parado' ? '> 3×' : `≤ ${AGING_LEVELS[k].upTo}×`}
              </span>
            ))}
          </div>
        </div>
        <Exemplo titulo="Exemplo numérico">
          <p>Oportunidade em <b>Proposta</b>, SLA de {DEFAULT_AGING_SLA.proposta} dias, parada há <b>31 dias</b>.</p>
          <p className="font-mono text-xs">31 ÷ {DEFAULT_AGING_SLA.proposta} = 2,2× → faixa <b>{AGING_LEVELS.critico.label}</b></p>
          <p>
            No Radar ela aparece com o ponto laranja e sobe na lista. Se o valor for alto e o comitê
            depender de uma pessoa só, sobe mais ainda.
          </p>
        </Exemplo>
      </div>

      <div>
        <div className="eyebrow mb-1.5">Detalhes que costumam gerar dúvida</div>
        <ul className="space-y-1.5">
          <li>• <b>Oportunidade repetida:</b> a mesma conta pode ter o mesmo serviço mais de uma vez. Use o campo de título para distinguir (ex.: "Fase 2 — unidade Sul") e a observação para registrar o motivo.</li>
          <li>• <b>Dono por oportunidade:</b> cada oportunidade tem seu responsável, que pode ser diferente do dono da conta. O nome aparece no cartão do Radar e no pipeline.</li>
          <li>• <b>Stand by</b> não é perda: é a etapa de quem voltará. Tem SLA próprio, de {DEFAULT_AGING_SLA.standby} dias, e volta a cobrar ação depois disso.</li>
          <li>• <b>Excluir oportunidade</b> é exclusivo do perfil Administrador, com confirmação.</li>
          <li>• <b>Fechado</b> continua sendo acompanhado: passados {DEFAULT_AGING_SLA.fechado} dias do ganho, o Radar começa a sugerir expansão pelo próximo pilar.</li>
        </ul>
      </div>
    </Secao>
  )
}

// ── 6. Radar ────────────────────────────────────────────────────
function RadarSec() {
  return (
    <Secao id="radar" icon={Radar} titulo="Radar ABM"
      resumo="A tela que transforma atraso em ação. Nenhuma sugestão vem de IA: são regras auditáveis.">
      <p>
        O Radar percorre cada oportunidade aberta e filtra, de um repertório de jogadas ABM, as que
        cabem naquele caso. Os filtros aplicados em sequência são: <b>etapa</b> da oportunidade,
        <b> faixa de aging</b>, <b>nível ABM</b> da conta e <b>existência de sinal de intenção</b> quando a
        jogada exige um. Jogadas já executadas ou descartadas saem da lista.
      </p>
      <p>
        A ordem da lista é a <b>urgência</b>, que combina a faixa de aging com o valor da oportunidade, o
        nível ABM e pesos extras quando há sinal ativo, quando o comitê ainda depende de poucas pessoas
        ou quando o ICP aponta nível 1:1.
      </p>

      <Tela titulo="Radar ABM — cartão de sugestão">
        <div className="flex items-start gap-2">
          <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-ink-900">Transportes Vale Verde</span>
              <span className="text-xs text-ink-600">Agentes de processo · Fase 2 — unidade Sul</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className={`chip ${AGING_LEVELS.critico.color}`}>{AGING_LEVELS.critico.label}</span>
              <span className={`chip ${CRM_STAGES.proposta.color}`}>{CRM_STAGES.proposta.label}</span>
              <span className={`chip ${PILLARS['agentes-processos'].color}`}>{PILLARS['agentes-processos'].short}</span>
              <span className={`chip ${ABM_TIERS['1:few'].color}`}>{ABM_TIERS['1:few'].short}</span>
              <span className="text-[11px] text-ink-500">Há 31 dias em Proposta — SLA de 14 dias (2,2×).</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold text-ink-900">{formatBRL(180000)}</div>
            <div className="text-[11px] text-ink-500">3 jogada(s)</div>
            <div className="text-[11px] text-ink-400">Edson</div>
          </div>
        </div>
      </Tela>
      <Tabela
        cabecalho={['O que você vê', 'O que significa']}
        linhas={[
          ['Ponto colorido', 'A faixa de aging, repetida na etiqueta ao lado. Laranja é crítico, vermelho é parado.'],
          ['Nome e serviço', 'A conta e o serviço da oportunidade, com o título quando há mais de uma do mesmo serviço.'],
          ['Etiquetas', 'Aging, etapa, pilar de entrega e nível ABM da conta.'],
          ['Frase de contexto', 'Dias na etapa, SLA e a razão entre eles. É a conta que gerou a faixa.'],
          ['Valor', 'Valor estimado. Entra na urgência e no indicador de valor em risco.'],
          ['Nome embaixo', 'O dono da oportunidade, não o da conta.'],
        ]}
      />
      <p className="text-xs text-ink-500">
        Passe o mouse sobre qualquer etiqueta, filtro ou indicador do Radar: cada um tem a sua própria
        instrução em mouse-over.
      </p>

      <div>
        <div className="eyebrow mb-1.5">Ao abrir o cartão</div>
        <ul className="space-y-1.5">
          <li>• <b>Comitê de compra:</b> em verde quem já tem contato cadastrado, em tracejado quem falta. {ABM_THEORY.minimumCoverage}</li>
          <li>• <b>Jogadas:</b> cada uma traz objetivo, justificativa pela teoria ABM, passos de execução, persona-alvo e custo estimado.</li>
          <li>• <b>Criar ação</b> lança a jogada na agenda com tipo, horas e custo já preenchidos — e a partir daí ela entra na timeline da conta e no custo de venda.</li>
          <li>• <b>Gerar conteúdo</b> abre o estúdio com mercado, microssegmento, pilar, persona e ângulo daquela jogada.</li>
          <li>• <b>Descartar</b> oculta a jogada por 30 dias; ela volta se o problema continuar.</li>
        </ul>
      </div>

      <Exemplo titulo="Exemplo de leitura">
        <p>
          O cartão acima diz, em uma frase: <i>"a proposta da Vale Verde está parada há mais que o dobro
          do prazo, vale R$ 180 mil, a conta é nível 1:few e o Edson é o responsável."</i>
        </p>
        <p>
          Como é 1:few, as jogadas oferecidas serão de campanha por problema — reativar com o caso de
          logística do cluster, levar o CFO para um almoço de trabalho, enviar o comparativo de
          indicadores do setor. Viagem do sócio não aparece, porque esse nível não a justifica.
        </p>
      </Exemplo>
    </Secao>
  )
}

// ── 7. Conteúdo ─────────────────────────────────────────────────
function Conteudo() {
  return (
    <Secao id="conteudo" icon={PenLine} titulo="Estúdio de conteúdo"
      resumo="Gera post de blog e post para redes sociais a partir do contexto real da conta.">
      <p>
        Há dois caminhos: pelo botão <b>Gerar conteúdo</b> de uma jogada do Radar, que chega com tudo
        preenchido, ou direto pelo estúdio, informando mercado, microssegmento, pilar, persona e
        formato. O texto sai no tom da marca e usa as dores e indicadores daquele mercado — não o
        portfólio da Leadrix.
      </p>
      <Exemplo>
        <p>
          <b>Entrada:</b> mercado Indústria · microssegmento logística e transporte · pilar Agentes e
          Processos · persona diretor de operações · formato post de blog.
        </p>
        <p>
          <b>Saída:</b> um texto que parte do problema de conferência manual em expedição, mostra o
          indicador afetado (capacidade e qualidade) e fecha com convite a um diagnóstico — sem citar
          serviço nem preço.
        </p>
      </Exemplo>
      <p className="text-xs text-ink-500">
        Todo conteúdo gerado fica registrado na timeline da conta quando foi criado a partir de uma
        jogada, para a próxima pessoa não repetir o mesmo ângulo.
      </p>
    </Secao>
  )
}

// ── 8. Mensageria ───────────────────────────────────────────────
function Mensageria() {
  return (
    <Secao id="mensageria" icon={Mails} titulo="Mensageria"
      resumo="E-mails pela conta da Leadrix, com fila de revisão obrigatória antes de qualquer envio.">
      <p>
        Dois gatilhos: <b>automático</b>, quando um evento acontece (a oportunidade muda de etapa, por
        exemplo), e <b>manual</b>, quando você escolhe um modelo e dispara. Nos dois casos o e-mail
        entra como <b>rascunho</b> na fila da tela de Mensageria. Nada sai sem alguém abrir, ler e
        aprovar — e-mail enviado é irreversível, então a revisão é de propósito.
      </p>
      <Tabela
        cabecalho={['Elemento', 'Como funciona']}
        linhas={[
          ['Remetente', 'A conta Gmail da Leadrix, com escolha de alias entre os endereços verificados.'],
          ['Modelos', 'Texto por evento, editável. Perfis Admin e Marketing podem alterar.'],
          ['Marcadores', 'Trechos como {{primeiro_nome}}, {{conta}}, {{microssegmento}}, {{indicador}} e {{assinatura}} são trocados pelos dados reais no momento do envio.'],
          ['Destinatário', 'Escolhido entre os contatos da conta; o sistema sugere o mais adequado à persona do evento.'],
          ['Registro', 'Todo e-mail enviado aparece na timeline de relacionamento da conta.'],
        ]}
      />
      <Atencao>
        Se um modelo tiver marcador que a conta não preenche, o texto sai com a lacuna visível na
        revisão. É melhor corrigir o cadastro do que apagar o marcador.
      </Atencao>
    </Secao>
  )
}

// ── 9. Custos ───────────────────────────────────────────────────
function Custos() {
  const horas = 2520
  const despesas = 2300
  const fixos = 1180
  const receita = 120000
  const comissao = receita * 0.1
  const custo = horas + despesas + fixos + comissao
  const roi = (receita - custo) / custo
  return (
    <Secao id="custos" icon={Calculator} titulo="Custo de venda e ROI"
      resumo="Quanto custou ganhar cada venda, somando pessoas, despesas, rateio de custos fixos e comissão.">
      <p>
        Cada ação executada carrega o custo-hora de quem a fez, congelado no momento do lançamento —
        aumento de custo-hora no futuro não reescreve o passado. Despesas entram por categoria, os
        custos fixos mensais são rateados entre as oportunidades do período e a comissão de indicação
        entra sobre o valor da venda.
      </p>
      <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
        <p className="font-mono text-xs text-ink-700">custo de conversão = horas × custo-hora + despesas + rateio de fixos + comissão</p>
        <p className="mt-1 font-mono text-xs text-ink-700">ROI = (receita − custo de conversão) ÷ custo de conversão</p>
      </div>
      <Exemplo titulo="Exemplo fechado">
        <Tabela
          cabecalho={['Componente', 'Cálculo', 'Valor']}
          linhas={[
            ['Horas das pessoas', '10 h de sócio a R$ 180 + 6 h de consultor a R$ 120', formatBRL(horas)],
            ['Despesas', 'Viagem R$ 1.400 + jantar executivo R$ 900', formatBRL(despesas)],
            ['Rateio de custos fixos', 'Parte dos custos fixos do mês atribuída a esta venda', formatBRL(fixos)],
            ['Comissão de indicação', `10% sobre ${formatBRL(receita)} (conta indicada pela Boomit)`, formatBRL(comissao)],
            [<b key="t">Custo de conversão</b>, '', <b key="v">{formatBRL(custo)}</b>],
            [<b key="r">ROI</b>, `(${formatBRL(receita)} − ${formatBRL(custo)}) ÷ ${formatBRL(custo)}`, <b key="rv">{formatPct(roi)}</b>],
          ]}
        />
        <p className="text-ink-500">
          A comissão é o maior item do exemplo — {formatPct(comissao / custo)} do custo total. É por isso que
          ela precisa estar marcada na conta: sem ela, o ROI apareceria inflado.
        </p>
      </Exemplo>
      <p>
        Em oportunidades que ainda não fecharam, o valor usado é o valor estimado ponderado pela
        probabilidade da etapa, e o resultado aparece marcado como projeção.
      </p>
      <Atencao>
        O perfil <b>Vendas</b> não vê esta tela nem os custos espalhados pelo sistema — vê os resultados
        comerciais (leads, ganhos, receita, conversão). A restrição é garantida pelo banco, não só por
        esconder o menu.
      </Atencao>
    </Secao>
  )
}

// ── 10. Arquivos ────────────────────────────────────────────────
function Arquivos() {
  return (
    <Secao id="arquivos" icon={FolderOpen} titulo="Arquivos e propostas"
      resumo="Dois armários por conta: propostas da Leadrix e arquivos recebidos do cliente.">
      <ul className="space-y-1.5">
        <li>• <b>Propostas:</b> o que a Leadrix enviou — proposta comercial, business case, apresentação.</li>
        <li>• <b>Arquivos do cliente:</b> o que a conta mandou — edital, planilha de dados, organograma, contrato.</li>
      </ul>
      <p>
        O arquivo pode ser vinculado a uma oportunidade específica, e aí aparece no contexto dela, ou
        ficar no nível da conta. Limite de 25 MB por arquivo. O acesso é por link assinado de curta
        duração, não por URL pública. Excluir arquivo é exclusivo do perfil Administrador.
      </p>
      <Exemplo>
        <p>
          Na conta Vale Verde, a oportunidade "Fase 2 — unidade Sul" tem a proposta em PDF vinculada a
          ela; o organograma e a planilha de volumes ficam em Arquivos do cliente, no nível da conta,
          porque servem a qualquer oportunidade futura.
        </p>
      </Exemplo>
    </Secao>
  )
}

// ── 11. Entrada de dados ────────────────────────────────────────
function Entrada() {
  return (
    <Secao id="entrada" icon={Upload} titulo="Captura e importação"
      resumo="Três portas de entrada, para três situações diferentes.">
      <Tabela
        cabecalho={['Porta', 'Quando usar', 'O que acontece depois']}
        linhas={[
          ['Captura de leads', 'Conversa, evento, indicação informal — informação ainda incompleta.', 'Vira pré-lead. Depois você o converte em conta, completando mercado e microssegmento.'],
          ['Pré-lead manual', 'Mesmo caso, mas digitado por você na tela de captura.', 'Idem: fica na fila de pré-leads até a conversão.'],
          ['Importador', 'Base pronta em planilha.', 'Cria contas, contatos e oportunidades de uma vez, avisando linha por linha o que não entendeu.'],
        ]}
      />
      <p>
        Para a planilha, baixe o <b>modelo</b> na tela do importador: ele já traz as colunas com os
        nomes que o sistema reconhece, uma linha de instrução em cada coluna e as opções válidas dos
        campos de escolha. Colunas ausentes são simplesmente ignoradas — a importação não apaga o que
        você não enviou.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/captura" className="btn-outline py-1.5 text-xs">Captura de leads</Link>
        <Link to="/importar" className="btn-outline py-1.5 text-xs">Importador e modelo</Link>
      </div>
    </Secao>
  )
}

// ── 12. Perfis ──────────────────────────────────────────────────
function Perfis() {
  const acoes = [
    ['Contas, pipeline, agenda, Radar', 'results.view'],
    ['Estúdio de conteúdo', 'content.manage'],
    ['Enviar e-mail', 'email.send'],
    ['Custo de venda e ROI', 'costs.view'],
    ['Editar modelos de e-mail', 'templates.manage'],
    ['Excluir oportunidade', 'opportunity.delete'],
    ['Cadastrar usuários', 'users.manage'],
  ]
  return (
    <Secao id="perfis" icon={ShieldCheck} titulo="Perfis de acesso"
      resumo="Três perfis. A regra vale na tela e, principalmente, no banco de dados.">
      <Tabela
        cabecalho={['O que faz', ...ROLE_IDS.map((r) => ROLES[r].label)]}
        linhas={acoes.map(([label, perm]) => [
          label,
          ...ROLE_IDS.map((r) => (can(r, perm)
            ? <span key={r} className="font-semibold text-emerald-600">sim</span>
            : <span key={r} className="text-rose-500">não</span>)),
        ])}
      />
      <ul className="space-y-1.5">
        {ROLE_IDS.map((r) => (
          <li key={r}>• <b>{ROLES[r].label}:</b> {ROLES[r].help}</li>
        ))}
      </ul>
      <Atencao>
        Esconder botão não protege nada. As mesmas regras estão escritas como políticas de acesso no
        banco, de modo que uma chamada direta à API pelo perfil errado também é recusada.
      </Atencao>
    </Secao>
  )
}

// ── 13. Glossário ───────────────────────────────────────────────
function Glossario() {
  const [busca, setBusca] = useState('')
  const q = busca.trim().toLowerCase()
  const lista = q
    ? GLOSSARIO.filter((g) => g.termo.toLowerCase().includes(q) || g.def.toLowerCase().includes(q))
    : GLOSSARIO
  return (
    <Secao id="glossario" icon={BookOpen} titulo="Glossário"
      resumo="Os termos que aparecem nas telas, em uma linha cada.">
      <input
        className="input max-w-xs"
        placeholder="Buscar termo…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <dl className="grid gap-2 sm:grid-cols-2">
        {lista.map((g) => (
          <div key={g.termo} className="rounded-lg border border-ink-200 p-3">
            <dt className="text-xs font-bold uppercase tracking-wide text-ink-900">{g.termo}</dt>
            <dd className="mt-0.5 text-xs text-ink-600">{g.def}</dd>
          </div>
        ))}
        {lista.length === 0 && <p className="text-xs text-ink-500">Nenhum termo com esse texto.</p>}
      </dl>
      <p className="text-xs text-ink-500">
        Os princípios de ABM que o sistema aplica estão listados no painel lateral do{' '}
        <Link to="/radar" className="text-brand-600 hover:underline">Radar ABM</Link>.
      </p>
    </Secao>
  )
}
