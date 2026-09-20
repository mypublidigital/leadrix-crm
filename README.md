# Leadrix CRM

CRM de **Account Based Marketing** da Leadrix. Cada conta é um mercado próprio:
selecionada pelo ICP, trabalhada pelo comitê de compra e acompanhada por
oportunidade, com custo de venda e ROI medidos.

> **Stack:** React + Vite + Tailwind (Vercel) · Supabase (Postgres, Auth, Edge
> Functions) · Claude (co-piloto e conteúdo). Roda **sem banco** em modo
> demonstração, com dados fictícios gravados no navegador.

## O que o CRM organiza

| Eixo | De onde vem | Onde vive no código |
|---|---|---|
| **4 pilares de entrega** — Estruturas Híbridas · Agentes e Processos · Educação e Adoção · Novos Negócios | leadrix.com.br/pilares | `src/data/leadrix.js` (`PILLARS`) e `src/data/servicesCatalog.js` |
| **4 mercados** — Serviços B2B · Indústria · Varejo e Franquias · Empresas Digitais, com decisores, dores e indicadores | leadrix.com.br/mercados/* | `src/data/leadrix.js` (`MARKETS`) |
| **Microssegmentos** (filtros) | Serviços B2B: site. Demais: lista inicial proposta | tabela editável em Configurações |
| **Playbook ABM** — teoria, SLA de aging e jogadas por etapa | referencial ABM | `src/data/abmPlaybook.js` |
| **Contexto estratégico de ABM** — pontuação ICP, sinais de intenção, campanhas por problema, jornada de 6 movimentos, estrutura da mensagem, métricas | documento Contexto Estratégico de ABM Leadrix | `src/data/abmContext.js` |
| **Voz da marca** — anti-hype, método, CTAs | skill leadrix-design | `src/data/leadrix.js` (`BRAND_VOICE`) |

## Telas

| Tela | O que faz |
|---|---|
| Dashboard | Funil, Radar ABM resumido, custo de venda & ROI em 12 meses, cobertura do programa ABM, matriz pilares × mercados, aging |
| Contas (ABM) | Filtros por mercado → microssegmento, pilar, nível ABM (nível 1 / nível 2 / relacionamento), porte, etapa… |
| Conta | Identidade e originação, **pontuação ICP**, **sinais e hipótese de valor**, grupo decisor, **ações ABM sugeridas**, **custo de venda e ROI da conta**, **timeline de relacionamento**, co-piloto conversacional |
| **Mensageria** | Modelos de e-mail por evento do CRM, fila com revisão, envio pelo Gmail da Leadrix com escolha de alias |
| Pipeline | Kanban por oportunidade com filtros de mercado/microssegmento/pilar e faixa de aging |
| **Radar ABM** | Sugestões proativas por aging: jogada, porquê (teoria ABM), persona, custo estimado, "Criar ação" e "Gerar conteúdo" |
| **Estúdio de conteúdo** | Blog post, post LinkedIn, carrossel Instagram e e-mail 1:1 por mercado, microssegmento, pilar, persona e etapa; biblioteca com status |
| **Custo de venda & ROI** | Custo total, custo por lead, custo de conversão, ROI (receita e margem), quebras por pilar, mercado, microssegmento, recurso e despesa |
| Configurações | **Tabela de custo de venda** (recursos e hora-homem, despesas, horas por tipo de ação, custos fixos, margem, SLA de aging), microssegmentos, usuários, motivos de perda, serviços |

## Perfis de acesso

| Perfil | Vê | Não vê |
|---|---|---|
| **Admin** | tudo | — |
| **Marketing** | tudo, inclusive custos e ROI | cadastro de usuários |
| **Vendas** | contas, pipeline, radar, conteúdo, mensageria e **resultados** (leads, vendas, receita, conversão) | usuários e todo o módulo de custo (hora-homem, despesas, ROI) |

Só **Admin** exclui oportunidade. A regra vale na interface *e* no banco: a
migração `0011` cria `crm_role()` e políticas que recusam a exclusão e o acesso
às tabelas de custo para quem não tem o papel — esconder botão não protege quem
chama a API direto (Guia §9.4). O papel vive em `app_metadata.role` do usuário,
definido pelo admin.

## Originação do lead e comissão de indicação

Duas coisas diferentes, lado a lado no cadastro da conta:

- **Canal de origem** — por onde o lead chegou (workshop, evento, inbound, LinkedIn…).
- **Origem do lead** — quem trouxe: Boomit, MyPubli, Carol, Marcelo, Edson, Cristiano ou Outros (com especificação obrigatória).

Quando a origem **gera comissão de indicação**, o percentual entra no cálculo:
comissão = percentual × valor ganho, somada ao custo de venda. Isso afeta o
**custo de conversão** e o **ROI** — realizado nas oportunidades ganhas e
projetado (sobre o valor ponderado) nas que estão abertas. A tela de custos
mostra a quebra por origem do lead.

## Mensageria (e-mail para o lead)

1. **Modelos por evento** — conta criada, mudança de etapa, ação concluída, aging crítico ou envio manual. Cada modelo pode estar em automático, com atraso em dias, e usa marcadores (`{{primeiro_nome}}`, `{{conta}}`, `{{indicador}}`, `{{hipotese}}`…).
2. **Fila** — todo e-mail nasce na fila: automático entra como *agendado*, o resto como *rascunho*. Nada sai sem alguém clicar em Enviar.
3. **Envio** — Edge Function `crm-email` usando a API do Gmail da conta da Leadrix, com escolha do alias remetente (precisa estar verificado no Gmail). Sem as credenciais configuradas, a mensagem fica na fila com o erro visível.

O estúdio de conteúdo cria e-mails 1:1 direto na fila, na estrutura de mensagem
ABM (sinal → hipótese → consequência → convite).

## Timeline de relacionamento

Na conta, todos os toques em ordem: ações ABM, interações, e-mails da
mensageria, criação e movimentação de oportunidades e conteúdo produzido —
com filtro por tipo e leitura do movimento da jornada em que a conta está.

## Como os cálculos funcionam

- **Custo de uma ação ABM** = Σ(horas × custo hora-homem) + Σ(quantidade × custo unitário das despesas).
  O custo/hora é gravado no lançamento — reajustar alguém não reescreve o passado.
- **Custo hora-homem** = custo mensal (salário + encargos + benefícios) ÷ horas produtivas, ou valor direto.
- **Rateio:** custo lançado só na conta é dividido entre as oportunidades dela pelo valor estimado.
- **Custo por lead** = custo total do período ÷ oportunidades criadas no período.
- **Custo de conversão** = custo total do período ÷ oportunidades ganhas no período.
- **ROI** = (receita fechada − custo total) ÷ custo total; com margem configurada, também sobre a margem.
- **Custos fixos** mensais entram proporcionais aos dias do período.
- **Comissão de indicação** entra no custo quando a venda acontece (e projetada sobre o valor ponderado nas abertas).

## Como o ICP pontua a conta

Sete dimensões, somando 100: tensão econômica (25), complexidade operacional
(20), estágio de IA (15), condições de implantação (15), momento de compra (10),
potencial de expansão (10), acesso e proximidade de prova (5). De 80 pontos é
nível 1; de 65 a 79, nível 2; de 50 a 64, relacionamento; abaixo disso, fora da
operação ativa. Bloqueadores (sem patrocinador, interesse só em ferramenta,
empresa pequena demais…) tiram a conta da operação independentemente da nota.

**Sinais de intenção** registrados na conta aumentam a prioridade no Radar e
liberam a jogada de abordagem por sinal — porque em ABM a ação nasce de um
acontecimento, não de uma sequência programada.

## Como o Radar ABM decide

1. Cada etapa tem um SLA (Configurações). Aging = dias na etapa ÷ SLA.
2. Faixas: no prazo (≤1×), atenção (≤2×), crítico (≤3×), parado (>3×). Stand by com revisão vencida vira crítico; em Fechado, passar do SLA abre jogadas de expansão.
3. O playbook escolhe as jogadas da etapa × faixa, respeitando o nível ABM (viagem e jantar só em 1:1 / 1:few).
4. A urgência pondera faixa, valor e cobertura do comitê de compra.
5. Criar a ação ou descartar (30 dias) tira a jogada da lista.

A seleção é por regra (sem IA), para ser auditável. A IA entra no co-piloto e no conteúdo.

## Rodando

```bash
npm install
npm run dev        # http://localhost:5174 — modo demonstração
```

Para usar o banco, siga o [DEPLOY.md](DEPLOY.md).

## Estrutura

```
src/
  data/        leadrix.js (pilares, mercados, voz), abmPlaybook.js (jogadas),
               abmContext.js (ICP, sinais, campanhas, jornada), servicesCatalog.js
  lib/         data.js (demo ↔ Supabase), costs.js, abm.js, content.js, messaging.js,
               timeline.js, permissions.js, copilot.js, constants.js
  components/  AbmSuggestionCard, AccountAbmPanels (ICP/sinais/timeline), ContentComposer,
               AccountCostPanel, SalesCostSettings, SegmentFilters…
  pages/       Dashboard, AccountsList, AccountView, Pipeline, RadarAbm, Conteudo,
               Mensageria, CustosRoi, Config…
supabase/
  migrations/  0001…0011 (0010 = taxonomia e custos · 0011 = perfis, comissão, mensageria)
  functions/   crm-copilot, crm-content (Claude) · crm-email (Gmail) · crm-admin-users ·
               crm-capture · handoff (dormente)
```

## Regras que valem saber

- `src/lib/data.js` é a única fronteira entre modo demo e Supabase.
- `saveContacts` e `replaceTaskCostEntries` **inserem antes de apagar**, de propósito.
- Taxonomia no front e no banco precisam andar juntas: mudou `leadrix.js`/`servicesCatalog.js`/`TASK_TYPES`, ajuste a migração e `supabase/functions/_shared/leadrix-knowledge.ts`.
