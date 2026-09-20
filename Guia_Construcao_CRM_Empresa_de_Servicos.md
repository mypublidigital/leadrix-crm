# Guia de Construção — CRM para Empresa de Serviços

**Versão 1.0 · Setembro/2026**

---

## Para quem é este documento

Este guia é para quem vai **construir do zero um CRM** para uma empresa que vende
serviços — consultoria, agência, escritório de projetos, assessoria, engenharia,
advocacia. Ele serve tanto para uma pessoa quanto para um assistente de IA (Claude,
por exemplo) conduzindo a implementação.

Ele foi escrito para ser autocontido: você não precisa de nenhum outro arquivo.

**O que você encontra aqui:**

| Seção | O que resolve |
|---|---|
| 1 a 3 | Entender o problema e o vocabulário antes de codar |
| 4 | Decisões que travam o projeto se ficarem para depois |
| 5 a 7 | O que construir: dados, funil e integração |
| 8 | Em que ordem construir |
| 9 | **Erros que já aconteceram de verdade** — leia antes de codar |
| 10 a 11 | Validar antes de subir e como conduzir o Claude |

> **Uma observação importante sobre escopo.** Este guia é genérico de propósito.
> Cada empresa tem seu catálogo de serviços, seu funil e suas regras. Onde o guia
> disser *"defina com o cliente"*, é porque a resposta muda de empresa para empresa —
> e chutar ali gera retrabalho caro lá na frente.

---

## 1. O problema que o CRM resolve

Empresas de serviço têm dois mundos que quase nunca conversam:

**O mundo comercial** — alguém prospecta, qualifica, faz proposta, negocia e fecha.
Normalmente isso vive numa planilha, no WhatsApp e na cabeça do sócio.

**O mundo da entrega** — depois de assinado, alguém precisa montar equipe, cronograma,
atividades e tocar o projeto.

Entre um e outro existe um buraco: **a passagem de bastão**. Na prática, o que
acontece é que o vendedor fecha o contrato e alguém redigita tudo à mão no sistema de
projetos — ou pior, ninguém redigita e a equipe de entrega descobre o projeto quando o
cliente cobra.

O CRM que você vai construir resolve os dois lados:

```
┌──────────────── O CRM (o que você vai construir) ────────────────┐
│                                                                  │
│   Lead  →  Qualificado  →  Proposta  →  Negociação  →  FECHADO   │
│                                                                  │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                               │  ao fechar, empurra o projeto
                               │  automaticamente (o "handoff")
                               ▼
┌──────────── Sistema de gestão de projetos (pode já existir) ─────┐
│                                                                  │
│   Projeto criado → kickoff → execução → entrega                  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**A regra central do sistema:** quando um negócio entra no estágio *Fechado*, o CRM
avisa o sistema de projetos, que cria o projeto já classificado e pronto para o
kickoff. Ninguém redigita nada.

Se a empresa ainda **não tem** um sistema de projetos, tudo bem — a Seção 7 explica
como deixar essa integração preparada sem construí-la agora.

---

## 2. Vocabulário

Vale alinhar cinco palavras antes de continuar, porque elas aparecem o tempo todo:

**Lead** — um contato que ainda não virou oportunidade. Alguém que baixou um material,
veio por indicação, apareceu num evento.

**Deal (ou Oportunidade)** — uma venda específica em andamento, com valor e prazo
estimados. Uma mesma empresa pode ter vários deals ao longo do tempo. *Esta é a
entidade mais importante do CRM.*

**Funil (ou Pipeline)** — a sequência de estágios pelos quais o deal passa. É o coração
visual do CRM: normalmente um quadro Kanban com uma coluna por estágio.

**Handoff** — a passagem de bastão. O momento em que o deal fechado vira projeto.

**Taxonomia de serviços** — o catálogo do que a empresa vende, organizado em níveis.
Explico na Seção 5.3.

---

## 3. O que o CRM precisa fazer (requisitos)

Antes de modelar qualquer coisa, este é o escopo mínimo de um CRM que se sustenta:

**Obrigatório:**
1. Cadastrar empresas (clientes e prospects) e seus contatos
2. Criar deals e movê-los pelo funil
3. Classificar o deal segundo o catálogo de serviços da empresa
4. Registrar atividades: ligações, reuniões, follow-ups, com data de vencimento
5. Disparar o handoff quando o deal fecha
6. Mostrar o pipeline: quanto tem em cada estágio, quanto está previsto fechar

**Desejável (fase 2):**
7. Propostas e versões de proposta
8. Dashboard de conversão por estágio e por vendedor
9. Motivo de perda, para aprender com o que não fechou
10. Notificações de follow-up vencido

**Cuidado com escopo:** CRM é um produto que atrai funcionalidade infinita.
Integração com e-mail, discador, assinatura eletrônica, automação de marketing — tudo
isso é legítimo e tudo isso pode esperar. Entregue os 6 obrigatórios funcionando antes
de aceitar o item 7.

---

## 4. Decisões antes de começar

Estas quatro decisões são baratas agora e caras depois. Resolva todas antes da
primeira linha de código.

### 4.1 Stack técnica

Uma combinação que funciona bem para CRM de empresa de serviços (dezenas de usuários,
milhares de registros):

| Camada | Escolha | Por quê |
|---|---|---|
| Front-end | React + Vite + TypeScript | Rápido de desenvolver, tipagem evita erro bobo |
| Estilo | Tailwind CSS | Consistência visual sem escrever CSS do zero |
| Estado | Zustand | Simples; Redux é excesso aqui |
| Banco + Auth + API | Supabase (PostgreSQL) | Banco relacional de verdade, autenticação pronta |
| Hospedagem | Vercel | Deploy automático a cada push |

Não é a única combinação possível. Mas se você não tem uma razão forte para outra
coisa, siga essa — ela é madura e a Seção 9 já mapeia as armadilhas dela.

### 4.2 Isolamento entre clientes — leia com atenção

Se você é uma agência ou software house construindo isto **para um cliente**, e já tem
outros sistemas de outros clientes:

> **Cada cliente tem seu próprio repositório e seu próprio banco de dados.**
> Sem exceção.

Isso não é preciosismo. Misturar dois clientes no mesmo projeto significa que:
- Um vazamento de credencial expõe os dois
- Um `DROP TABLE` errado derruba os dois
- Você não consegue entregar o código de um cliente sem entregar o do outro
- Encerrar o contrato com um vira uma cirurgia no código do outro

A mesma regra vale para documentação: a documentação de um cliente não mora no
repositório do outro.

### 4.3 Quem enxerga o quê

Defina os papéis **antes** de modelar o banco, porque isso vira regra de segurança
dentro do PostgreSQL, não `if` na tela.

Sugestão de partida:

| Papel | Enxerga |
|---|---|
| Vendedor | Os próprios deals |
| Gerente comercial | Todos os deals da equipe |
| Diretoria | Tudo, incluindo valores e comissões |
| Operação | Projetos que chegaram pelo handoff; não vê valor de contrato |

**A pergunta que separa um CRM sério de um brinquedo:** *um vendedor pode ver o valor
do contrato e a comissão do outro?* Quase sempre a resposta é não — e isso precisa ser
garantido no banco, não escondido na interface. A Seção 9.4 explica por quê.

### 4.4 Se já existe sistema de projetos

Pergunte antes de projetar o handoff:
- Existe um sistema de gestão de projetos hoje? Qual?
- Ele aceita receber dados por API?
- **Quem vai construir o lado de lá que recebe o handoff?**

Essa última é a que mais atrasa projeto: o CRM fica pronto apontando para um endereço
que ninguém construiu. Defina o responsável e o prazo antes de chegar na Fase 3.

---

## 5. Modelo de dados

Quatro tabelas sustentam o CRM inteiro. Vou explicar cada uma e por que os campos
existem.

### 5.1 `companies` — as empresas

```
id                 uuid, chave primária
legal_name         texto   — razão social (é o nome que vai no contrato)
trade_name         texto   — nome fantasia (é o nome que todo mundo usa)
tax_id             texto   — CNPJ, único
segment            texto   — em que setor atua
size               texto   — porte do cliente
website            texto
notes              texto
owner_id           uuid    — quem é o dono da conta
created_at         timestamp
```

**Por que `legal_name` e `trade_name` separados?** Porque o contrato precisa da razão
social e a tela precisa do nome que as pessoas reconhecem. Juntar os dois num campo só
força alguém a redigitar na hora do contrato.

**`segment` e `size`** dependem totalmente do negócio. Uma consultoria financeira
segmenta por tipo de instituição; uma agência, por setor de mercado. Defina com o
cliente e use uma lista fechada, nunca texto livre — texto livre impossibilita
relatório.

### 5.2 `contacts` — as pessoas

```
id                 uuid
company_id         uuid    — a empresa
name               texto
role               texto   — cargo
email              texto
phone              texto
is_primary         booleano — o contato principal
```

Uma empresa tem várias pessoas, e você vende para pessoas. Guardar só um contato por
empresa é um erro clássico: quando essa pessoa sai, você perde a conta.

### 5.3 `deals` — o coração do sistema

```
id                      uuid
company_id              uuid      — FK para companies
title                   texto     — "Implantação de BI — Acme"
stage                   texto     — estágio no funil (lista fechada)

-- classificação do serviço
service_category        texto     — nível 1 da taxonomia
service_type            texto     — nível 2 da taxonomia
size                    texto     — porte do projeto
complexity              inteiro   — 1 a 5

-- comercial
amount                  numérico  — valor do contrato
billing_model           texto     — por marco, mensal, fixo
expected_close_date     data      — previsão de fechamento
expected_start_date     data      — previsão de início da entrega
expected_end_date       data      — previsão de término

-- responsáveis
owner_id                uuid      — vendedor
delivery_manager_email  texto     — quem vai gerenciar a entrega

-- handoff
handoff_status          texto     — pendente | enviado | erro
handoff_project_id      texto     — id do projeto criado do outro lado
handoff_error           texto     — a mensagem de erro, quando falha

-- perda
lost_reason             texto
created_at, updated_at  timestamp
```

**Por que `handoff_status`, `handoff_project_id` e `handoff_error` existem?** Porque a
integração vai falhar às vezes — rede cai, o outro sistema fica fora do ar. Sem esses
três campos, você não consegue nem saber que falhou, nem reenviar. A Seção 7.4 detalha.

**Por que `delivery_manager_email` e não `delivery_manager_id`?** Porque o gerente de
entrega mora no *outro* sistema. O e-mail funciona como identificador entre os dois sem
acoplar os bancos. É simples, mas tem um risco: se o e-mail não existir lá, o handoff
falha. Trate esse erro explicitamente.

### 5.4 `activities` — o que precisa ser feito

```
id            uuid
deal_id       uuid
type          texto     — ligação | reunião | e-mail | tarefa
subject       texto
due_date      data
done_at       timestamp — nulo enquanto estiver pendente
notes         texto
owner_id      uuid
```

É o que transforma o CRM de um cadastro passivo numa ferramenta de trabalho: sem
follow-up com data, deal esquece e morre.

### 5.5 A taxonomia de serviços

Este é o conceito que mais gera confusão, então vale explicar com calma.

A **taxonomia** é o catálogo do que a empresa vende, organizado em **dois níveis**:

```
Categoria (nível 1)          Tipo de serviço (nível 2)
─────────────────────────────────────────────────────────────
Dados & BI              ├─ Implantação de Data Warehouse    (complexidade 4-5)
                        ├─ Dashboards e relatórios          (complexidade 2-3)
                        └─ Governança de dados              (complexidade 3-4)

Transformação Digital   ├─ Mapeamento de processos          (complexidade 2-3)
                        ├─ Automação de back office         (complexidade 3-4)
                        └─ Redesenho de jornada             (complexidade 2-4)

Estratégia              ├─ Diagnóstico                      (complexidade 1-3)
                        └─ Plano de negócio                 (complexidade 2-4)
```

**Por que dois níveis e não um?** Porque relatório gerencial quer o nível 1 ("quanto
vendemos de Dados & BI?") e a equipe de entrega quer o nível 2 (o tipo determina quais
atividades o projeto tem).

**Por que a complexidade típica fica no catálogo?** Para o vendedor não chutar. Quando
ele escolhe "Implantação de Data Warehouse", o sistema já sugere complexidade 4 e
bloqueia valores fora da faixa 4-5 — ou pede justificativa.

**Como implementar, na prática:**

1. Levante o catálogo com o cliente. Peça a lista real do que vendem.
2. Guarde num arquivo JSON versionado no repositório, por exemplo
   `src/data/taxonomia.json`:

```json
{
  "portes": [
    { "id": "P1", "label": "Pequeno",       "duracao": "até 4 semanas" },
    { "id": "P2", "label": "Pequeno-Médio", "duracao": "até 8 semanas" },
    { "id": "P3", "label": "Médio",         "duracao": "até 16 semanas" },
    { "id": "P4", "label": "Grande",        "duracao": "até 30 semanas" },
    { "id": "P5", "label": "Muito Grande",  "duracao": "30+ semanas" }
  ],
  "categorias": [
    {
      "id": "dados-bi",
      "label": "Dados & BI",
      "tipos": [
        { "id": "data-warehouse", "label": "Implantação de Data Warehouse",
          "complexidadeTipica": "4-5" },
        { "id": "dashboards", "label": "Dashboards e relatórios",
          "complexidadeTipica": "2-3" }
      ]
    }
  ]
}
```

3. **A regra de ouro:** o campo `id` é o contrato entre os sistemas; o `label` é só
   para mostrar na tela. Se o outro sistema espera `"data-warehouse"` e você mandar
   `"Data Warehouse"`, o handoff é rejeitado — e você só descobre no dia do primeiro
   fechamento.

4. Se o sistema de projetos do outro lado também tem essa taxonomia, **os dois precisam
   usar os mesmos ids**. O melhor arranjo é o sistema de projetos expor a taxonomia por
   um endereço na web e o CRM consumir de lá, em vez de manter duas cópias que
   desandam com o tempo.

---

## 6. O funil comercial

### 6.1 Os estágios

Comece simples. Cinco estágios cobrem quase toda empresa de serviços:

| Estágio | O que significa | Quando sai daqui |
|---|---|---|
| **Lead** | Contato identificado, sem conversa ainda | Quando há uma conversa marcada |
| **Qualificado** | Conversou e tem fit: problema real, orçamento, decisor | Quando você entende o escopo |
| **Proposta** | Proposta enviada | Quando o cliente responde |
| **Negociação** | Discutindo preço, prazo, escopo | Quando decide |
| **Fechado** | Contrato assinado | — dispara o handoff |
| **Perdido** | Não vai acontecer | — exige `lost_reason` |

**Regra prática:** não deixe criar estágio novo sem discussão. Funil com 11 estágios
vira campo que ninguém preenche.

### 6.2 A tela principal

Um quadro Kanban com uma coluna por estágio, cartões arrastáveis. Cada cartão mostra:
nome da empresa, título do deal, valor, previsão de fechamento e um indicador visual
quando há follow-up vencido.

No topo de cada coluna: quantidade de deals e soma dos valores. É o que o sócio quer
ver ao abrir o sistema.

### 6.3 Regras de transição

Algumas transições exigem informação antes de acontecer:

- Para **Proposta**: exige `amount` e classificação do serviço preenchidos
- Para **Fechado**: exige `expected_start_date`, `expected_end_date` e
  `delivery_manager_email` — sem eles o handoff não tem o que enviar
- Para **Perdido**: exige `lost_reason`

Implemente essas validações no momento de mover o cartão, com mensagem clara do que
falta. É o que garante que o handoff não falhe por campo vazio.

---

## 7. O handoff — a integração

Esta é a parte que dá mais trabalho e a que mais agrega valor. Se você fizer só o
funil, entregou um Trello bonito. O handoff é o que integra comercial e entrega.

### 7.1 Como funciona

Quando o deal entra em *Fechado*, o CRM envia uma requisição HTTP para o sistema de
projetos:

```
POST https://<endereco-do-sistema-de-projetos>/crm-onboarding
Content-Type: application/json
```

Com um corpo assim:

```json
{
  "external_id": "deal-8f3a91",
  "name": "Implantação de Data Warehouse — Acme",

  "client": {
    "legal_name": "Acme Indústria S.A.",
    "trade_name": "Acme",
    "tax_id": "12.345.678/0001-90",
    "segment": "industria",
    "contacts": [
      { "name": "Maria Silva", "role": "Diretora de TI",
        "email": "maria@acme.com.br", "phone": "+55 11 99999-0000" }
    ]
  },

  "project": {
    "service_category": "dados-bi",
    "service_type": "data-warehouse",
    "size": "P4",
    "complexity": 4,
    "start_date": "2026-10-01",
    "end_date": "2027-03-31",
    "manager_email": "joao@empresa.com.br",
    "tags": ["BI", "migração"]
  },

  "commercial": {
    "amount": 850000,
    "billing_model": "milestone",
    "signed_at": "2026-09-25T14:30:00-03:00"
  },

  "source": {
    "system": "crm",
    "deal_url": "https://crm.empresa.com.br/deals/8f3a91"
  }
}
```

E recebe de volta:

```json
{
  "ok": true,
  "project_id": "proj-4f21a",
  "project_url": "https://projetos.empresa.com.br/projects/proj-4f21a",
  "status": "planning"
}
```

O CRM grava `project_id` no deal e mostra no cartão um link direto para o projeto.

### 7.2 Autenticação — assine a requisição

Não use uma senha fixa no cabeçalho. Use **HMAC-SHA256**, que é o padrão para webhook:

```
X-Signature: sha256=<hash>
X-Timestamp: <unix timestamp>
```

Como funciona, em linguagem simples: os dois lados conhecem um segredo. O CRM calcula
um "selo" (hash) a partir do corpo da mensagem + o segredo, e manda o selo junto. O
outro lado recalcula o selo e compara. Se bater, a mensagem é autêntica e não foi
alterada no caminho.

Três cuidados:
1. O segredo fica em **variável de ambiente**, nunca no código.
2. Calcule o hash sobre o **corpo exatamente como será enviado**. Se você transformar o
   objeto em texto duas vezes, com ordens de campo diferentes, o selo não bate.
3. Rejeite requisições com timestamp de mais de **5 minutos**. Isso impede alguém de
   capturar uma requisição válida e reenviá-la depois.

### 7.3 Idempotência — o erro que duplica projeto

"Idempotente" significa: **executar duas vezes tem o mesmo efeito que executar uma vez.**

Por que importa: o CRM manda o handoff, a rede engasga, o CRM não recebe resposta e
tenta de novo. Só que a primeira requisição **chegou** — o projeto já foi criado. Sem
proteção, agora existem dois projetos iguais, e alguém vai descobrir isso em produção.

A solução é o campo `external_id`, que é o id do deal:

- O sistema de projetos guarda o `external_id` de cada projeto criado
- Se chegar um `external_id` que ele já viu, ele **não cria nada** — devolve o projeto
  existente com status `200` em vez de `201`
- O CRM trata os dois como sucesso

### 7.4 Quando dá errado

Trate as falhas explicitamente — é o que separa integração confiável de integração que
"às vezes funciona":

| Resposta | Significa | O CRM faz |
|---|---|---|
| `201` | Projeto criado | Grava `project_id`, status `enviado` |
| `200` | Já existia (idempotência) | Grava `project_id`, status `enviado` |
| `4xx` | Payload inválido | Status `erro`, **não tenta de novo** |
| `5xx` ou timeout | Problema do outro lado | **Tenta de novo** com espera crescente |

**Por que não repetir em `4xx`?** Porque `4xx` significa que a mensagem está errada —
faltou campo, a categoria não existe, o e-mail do gerente não foi encontrado. Repetir a
mesma mensagem errada mil vezes não conserta nada e só gera ruído.

**Espera crescente (backoff):** 1 segundo → 5 segundos → 30 segundos → 5 minutos. Se
esgotar, marque `handoff_status = 'erro'`, guarde a mensagem em `handoff_error` e
**mostre isso na interface com um botão de reenviar**. Falha silenciosa é pior que
falha visível.

### 7.5 Se o sistema de projetos ainda não existe

Deixe preparado sem construir:

1. Implemente o disparo do handoff normalmente
2. Aponte para um endereço configurável por variável de ambiente
3. Se a variável estiver vazia, marque `handoff_status = 'pendente'` e não envie nada
4. Crie uma tela listando os handoffs pendentes, para reenvio em lote quando o outro
   sistema existir

Assim, no dia em que o sistema de projetos entrar no ar, você configura a variável e
reenvia o histórico — sem reescrever nada.

---

## 8. Em que ordem construir

Cinco fases. **Termine cada uma antes de começar a próxima** — CRM meio pronto em três
frentes não serve para ninguém.

### Fase 1 — Fundação (1 semana)
1. Criar repositório e projeto no Supabase
2. Estrutura do projeto: React + Vite + Tailwind + TypeScript
3. Autenticação: login, logout, recuperação de senha
4. Criar as 4 tabelas da Seção 5, **com as regras de segurança desde já** (Seção 9.4)
5. Colocar a taxonomia em `src/data/taxonomia.json`

*Pronto quando:* alguém consegue logar e ver uma tela vazia protegida.

### Fase 2 — Cadastros e funil (2 semanas)
6. CRUD de empresas e contatos
7. CRUD de deals com classificação pela taxonomia (selects encadeados: categoria → tipo)
8. Quadro Kanban com arrastar e soltar
9. Validações de transição (Seção 6.3)
10. Atividades e follow-ups

*Pronto quando:* um vendedor consegue tocar um deal do lead ao fechamento.

### Fase 3 — Handoff (1 a 2 semanas)
11. Cliente HTTP com assinatura HMAC
12. Repetição com espera crescente e idempotência
13. Gatilho na entrada em *Fechado*
14. Tela de handoffs com erro e botão de reenvio
15. Registro de auditoria: quem fechou, quando disparou, o que voltou

*Pronto quando:* fechar um deal cria o projeto do outro lado, e desligar o outro
sistema no meio do teste não duplica nada.

### Fase 4 — O lado que recebe
16. Construir o endpoint no sistema de projetos (se for responsabilidade sua)
17. Validar a classificação recebida contra a taxonomia
18. Resolver o gerente pelo e-mail
19. Criar o projeto e suas atividades iniciais
20. Testar ponta a ponta em ambiente de teste antes de ligar em produção

### Fase 5 — Gestão (1 semana)
21. Dashboard: pipeline por estágio, conversão, ticket médio, previsão do mês
22. Relatório de perdas por motivo
23. Notificações de follow-up vencido

---

## 9. Armadilhas — leia antes de codar

Tudo nesta seção aconteceu de verdade, em produção, num sistema com a mesma stack.
Cada item custou horas de depuração. Ler agora é mais barato.

### 9.1 As chaves antigas do Supabase não funcionam mais

Projetos criados a partir de 2026 usam chaves no formato **`sb_publishable_...`**
(pública, para o navegador) e **`sb_secret_...`** (secreta, só no servidor).

As chaves antigas em formato JWT — aquelas longas que começam com `eyJ...` — continuam
**aparecendo no painel**, mas são rejeitadas. E o erro não ajuda: um `401 Invalid
credentials` genérico, que parece problema de login do usuário.

→ Use a chave **publishable** no front-end. Se aparecer um 401 que não faz sentido,
desconfie da chave antes de qualquer outra coisa.

### 9.2 Criar usuário pelo navegador derruba a sessão do admin

Se o CRM tiver tela de cadastro de usuários, **não use `signUp()` no navegador**. Essa
função cria o usuário **e faz login como ele**, substituindo a sessão de quem estava
logado.

O sintoma é desconcertante: o administrador cadastra um vendedor e, na tela seguinte,
"virou" o vendedor — perdeu os próprios acessos.

→ Crie usuários no **servidor**, com a chave secreta, usando a função administrativa
(`auth.admin.createUser`). No Supabase isso é uma Edge Function.

### 9.3 Regra de segurança que consulta a própria tabela trava o banco

Se você escrever uma regra de acesso na tabela `users` que faz uma consulta em `users`
para descobrir o papel da pessoa, o banco entra em laço e devolve:

```
42P17 infinite recursion detected in policy
```

→ Coloque a consulta dentro de uma função marcada como **`SECURITY DEFINER`**, e chame
a função na regra. A função roda com privilégio próprio e não reativa a regra.

### 9.4 Regra de acesso protege linha, não coluna

Esta é a mais perigosa, e a mais comum.

As regras de segurança do PostgreSQL (RLS) decidem **quais linhas** a pessoa vê. Elas
**não** escondem colunas. Uma regra "todo usuário autenticado pode ler" libera *todas as
colunas* — inclusive `amount`, comissão e `lost_reason`.

E esconder na tela não resolve nada: qualquer vendedor abre o painel do navegador e
chama a API direto, recebendo tudo.

→ Controle coluna por coluna com `GRANT`. **Atenção a um detalhe que engana:** revogar
uma coluna isolada *não subtrai* de uma permissão dada sobre a tabela inteira. É
preciso revogar a tabela e conceder de novo, coluna a coluna:

```sql
-- errado: não tem efeito nenhum
revoke select (amount) on deals from authenticated;

-- certo
revoke select on deals from authenticated;
grant select (id, company_id, title, stage, service_category, service_type,
              expected_close_date, owner_id)
  on deals to authenticated;
-- amount e commission ficam de fora de propósito
```

Para dar acesso ao valor só para a gerência, exponha esses campos por uma função
`SECURITY DEFINER` que verifica o papel de quem chamou.

### 9.5 "Editar o próprio cadastro" vira brecha para virar admin

Uma regra que permite a pessoa editar a própria linha, sem restringir colunas, deixa
ela editar **qualquer coluna** — inclusive o papel:

```sql
update users set role = 'admin' where id = <o próprio id>;
```

Pronto: o estagiário virou administrador.

→ Restrinja as colunas editáveis com `GRANT UPDATE` (nome, telefone, foto). Mudança de
papel só pelo servidor, com a chave secreta.

### 9.6 O envio de e-mail do Supabase é limitado

O serviço de e-mail embutido manda pouquíssimas mensagens por hora — serve para testar,
não para produção. Convite de usuário, confirmação de cadastro e "esqueci minha senha"
simplesmente param de funcionar quando a equipe cresce.

→ Configure um serviço próprio (Resend, Amazon SES) **antes** de colocar usuários
reais. Enquanto não houver, crie os usuários já confirmados e entregue a senha por
outro canal.

### 9.7 `select("*")` quebra quando há permissão por coluna

Consequência direta da 9.4: depois de restringir colunas, qualquer consulta com `*`
falha com `permission denied for column`. Vale também para consultas aninhadas.

→ Liste as colunas explicitamente desde o primeiro dia. Não custa nada agora e evita
refatorar tudo depois.

### 9.8 Dado só na memória some no F5

Cuidado com a tentação de guardar coisas só no estado do front-end para "resolver
depois". O usuário edita, vê a tela atualizar, acha que salvou — e perde tudo ao
recarregar.

→ Toda edição vai ao banco. Se quiser resposta instantânea, atualize a tela na hora
**e** grave no banco, revertendo se a gravação falhar.

---

## 10. Antes de colocar no ar

Marque cada item testando de verdade — vários deles só falham quando testados pela API,
não pela tela.

**Funil**
- [ ] Deal percorre todos os estágios
- [ ] Transições exigem os campos obrigatórios
- [ ] Perda exige motivo

**Handoff**
- [ ] Fechar um deal cria o projeto do outro lado
- [ ] Enviar o mesmo deal duas vezes **não** duplica o projeto
- [ ] Derrubar o outro sistema no meio do envio: repete e não duplica
- [ ] Categoria inválida é rejeitada com mensagem clara
- [ ] E-mail de gerente inexistente falha de forma visível, não silenciosa
- [ ] Assinatura inválida é recusada
- [ ] Requisição com mais de 5 minutos é recusada
- [ ] Erro aparece na tela com botão de reenvio

**Segurança** — teste pela API, não pela interface
- [ ] Vendedor não lê deals de outro vendedor
- [ ] Vendedor não lê o valor do contrato de deals que não são dele
- [ ] Vendedor não consegue alterar o próprio papel
- [ ] Nenhum `select("*")` sobrou em tabela com coluna restrita

**Operação**
- [ ] Serviço de e-mail próprio configurado
- [ ] Segredos em variável de ambiente, nenhum no código
- [ ] Backup do banco habilitado
- [ ] Ambiente de teste separado de produção

---

## 11. Como usar este guia com o Claude

Se você vai implementar com apoio de IA, o erro mais comum é pedir tudo de uma vez e
receber um monte de código que não se sustenta. Vá por fases.

**Mensagem de abertura sugerida:**

> Leia este guia inteiro. Antes de escrever qualquer código, me diga:
> (1) quais decisões da Seção 4 ainda não estão respondidas;
> (2) um plano detalhado só da **Fase 1** da Seção 8.
> Não comece a implementar até eu aprovar o plano.

**A cada fase seguinte:**

> Fase 1 concluída e testada. Me apresente o plano da Fase 2 antes de codar.

**Três hábitos que fazem diferença:**

1. **Peça verificação, não só código.** "Implemente X" costuma vir sem teste. Prefira:
   *"implemente X e depois comprove que funciona, rodando de verdade."*

2. **Cobre a Seção 9 explicitamente.** Ao entrar na parte de segurança, peça:
   *"antes de escrever as regras de acesso, releia a Seção 9 e me diga quais armadilhas
   se aplicam aqui."*

3. **Desconfie de "está pronto" sem prova.** Peça a saída do teste, o print da tela, o
   retorno da chamada. Um sistema que "deve funcionar" costuma não funcionar.

---

## Encerramento

Este guia cobre o caminho até um CRM em produção. O que ele **não** cobre, e você vai
precisar definir com quem vai usar o sistema: o catálogo de serviços real, os estágios
que fazem sentido para aquele funil, os papéis e quem enxerga o valor do contrato.

Se tiver que guardar uma frase só deste documento, guarde esta:

> **Os dados são o contrato.** Um `id` errado na classificação, um campo obrigatório
> vazio, uma coluna que vaza valor de contrato — cada um desses vira um problema caro
> quando descoberto em produção. Vale mais uma tarde decidindo a taxonomia com o
> cliente do que duas semanas consertando depois.
