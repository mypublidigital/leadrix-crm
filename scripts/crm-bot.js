/* ============================================================================
 * Bot de testes do Consulcard CRM
 * ----------------------------------------------------------------------------
 * Navega por todas as telas e exercita filtros, consultas, inclusões e
 * exclusões, reportando falhas. Roda dentro do navegador, contra a aplicação
 * já carregada.
 *
 * COMO USAR
 *   1. Suba o app em MODO DEMO (sem .env). O bot cria e apaga registros —
 *      não aponte para produção.
 *   2. Abra o app, abra o console do navegador (F12) e cole este arquivo.
 *   3. Rode:  await crmBot()
 *      Filtrando um trecho:  await crmBot({ only: ['contas', 'agenda'] })
 *
 * O bot devolve (e imprime) um relatório com PASS/FAIL por verificação.
 * ==========================================================================*/
(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  // Raiz nula devolve vazio em vez de estourar: um modal que demorou a abrir
  // deve virar FAIL da verificação, nunca uma exceção que aborta o resto da
  // varredura (já aconteceu — 46 checagens ficaram sem rodar).
  const $ = (sel, root = document) => (root ? root.querySelector(sel) : null)
  const $$ = (sel, root = document) => (root ? [...root.querySelectorAll(sel)] : [])
  const txt = () => document.body.innerText

  const byText = (sel, needle, root = document) =>
    $$(sel, root).find((el) => el.textContent.trim().toLowerCase().includes(String(needle).toLowerCase()))

  // Escreve em inputs/selects controlados pelo React (dispara o setter nativo)
  function setValue(el, value) {
    if (!el) return false
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype
      : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return true
  }

  const modal = () => $('.fixed.inset-0')
  const modalTxt = () => modal()?.innerText || ''
  const modalBtn = (label) => byText('button', label, modal())

  // Endereça campo do modal pelo RÓTULO, não pela posição. Com índice, incluir
  // um campo no meio do formulário renumerava tudo e as verificações seguintes
  // passavam a escrever no campo errado — falhando longe da causa.
  function campo(rotulo) {
    const m = modal()
    if (!m) return null
    const lab = $$('label', m).find((l) => l.textContent.trim().toLowerCase().startsWith(rotulo.toLowerCase()))
    return lab ? lab.parentElement.querySelector('input, select, textarea') : null
  }

  async function goto(path, wait = 900) {
    location.hash = ''
    history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await sleep(wait)
    // fallback: se o router não reagiu ao pushState, recarrega de fato
    if (location.pathname !== path) { location.href = path; await sleep(1800) }
  }

  // espera uma condição virar verdadeira (evita sleeps arbitrários)
  async function until(fn, timeout = 4000, step = 120) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeout) {
      try { if (fn()) return true } catch { /* ainda renderizando */ }
      await sleep(step)
    }
    return false
  }

  const report = []
  // Espelhado em window para dar para acompanhar o progresso enquanto roda
  // (útil quando a varredura demora e é preciso saber onde ela está).
  if (typeof window !== 'undefined') window.crmBotReport = report
  let currentGroup = '—'
  const group = (g) => { currentGroup = g }
  const check = (nome, ok, detalhe = '') =>
    report.push({ grupo: currentGroup, verificação: nome, resultado: ok ? 'PASS' : 'FAIL', detalhe: String(detalhe).slice(0, 160) })

  // erros de runtime do React/JS durante a execução
  const runtimeErrors = []
  const onErr = (e) => runtimeErrors.push(e.message || String(e.error || e))
  const onRej = (e) => runtimeErrors.push('unhandledrejection: ' + (e.reason?.message || e.reason))

  // Uma tela "quebrada" = vazia, com stack trace ou com mensagem de erro
  function telaSaudavel() {
    const t = txt()
    if (!t || t.trim().length < 40) return { ok: false, motivo: 'tela vazia' }
    if (/Erro:|is not defined|is not a function|Cannot read|Minified React error/i.test(t)) {
      return { ok: false, motivo: t.match(/.{0,80}(Erro:|is not defined|is not a function|Cannot read|Minified React error).{0,80}/i)?.[0] }
    }
    return { ok: true }
  }

  // ── Telas ────────────────────────────────────────────────────────────────
  const ROTAS = [
    ['/', 'Dashboard', ['Dashboard de funil', 'Resumo de tarefas']],
    ['/contas', 'Contas', ['Contas (ABM)', 'Nova conta']],
    ['/agenda', 'Agenda', ['Agenda de execução']],
    ['/pipeline', 'Pipeline', ['Pipeline']],
    ['/servicos', 'Serviços', ['Serviços']],
    ['/captura', 'Captura', ['Captura de leads']],
    ['/importar', 'Importador', ['Importador']],
    ['/config', 'Config', ['Config']],
  ]

  async function testarNavegacao() {
    group('navegação')
    for (const [rota, nome, marcadores] of ROTAS) {
      await goto(rota)
      const saude = telaSaudavel()
      check(`${nome} (${rota}) carrega`, saude.ok, saude.motivo || '')
      for (const m of marcadores) {
        check(`${nome}: contém "${m}"`, txt().includes(m))
      }
    }
    // rota inexistente não pode quebrar o app
    await goto('/rota-que-nao-existe')
    check('rota inválida mostra "não encontrada"', /não encontrada/i.test(txt()))
  }

  async function testarContasFiltros() {
    group('contas · filtros')
    await goto('/contas')
    const totalInicial = $$('tbody tr').length
    check('lista carrega contas', totalInicial > 0, `${totalInicial} linhas`)

    // busca por nome
    const busca = $('input[placeholder*="Buscar"]')
    if (busca) {
      const primeiro = $('tbody tr a')?.textContent.trim().split('\n')[0] || ''
      setValue(busca, primeiro.slice(0, 6))
      await sleep(350)
      const filtrado = $$('tbody tr').length
      check('busca por nome filtra', filtrado > 0 && filtrado <= totalInicial, `${filtrado} de ${totalInicial}`)
      setValue(busca, '')
      await sleep(300)
      check('limpar busca restaura', $$('tbody tr').length === totalInicial)
    } else check('campo de busca existe', false)

    // cada <select> de filtro: escolhe a 2ª opção e confere que não quebra
    const selects = $$('select')
    check('filtros presentes', selects.length >= 6, `${selects.length} selects`)
    for (const sel of selects) {
      const rotulo = sel.closest('div')?.querySelector('label')?.textContent.trim() || '(sem rótulo)'
      const opcoes = [...sel.options].filter((o) => o.value)
      if (!opcoes.length) continue
      setValue(sel, opcoes[0].value)
      await sleep(320)
      const saude = telaSaudavel()
      const linhas = $$('tbody tr').length
      check(`filtro "${rotulo}" aplica sem quebrar`, saude.ok, saude.motivo || `${linhas} linha(s)`)
      setValue(sel, '')
      await sleep(220)
    }
    check('após limpar filtros volta ao total', $$('tbody tr').length === totalInicial,
      `${$$('tbody tr').length} vs ${totalInicial}`)

    // seleção em massa
    const checkTodos = $('thead input[type=checkbox]')
    if (checkTodos) {
      checkTodos.click(); await sleep(300)
      check('selecionar todos habilita ação em massa', /selecionada/i.test(txt()))
      const limpar = byText('button', 'Limpar')
      if (limpar) { limpar.click(); await sleep(250) }
      check('limpar seleção esconde a barra', !/conta\(s\) selecionada/i.test(txt()))
    } else check('checkbox "selecionar todos" existe', false)
  }

  async function testarContaCRUD() {
    group('contas · inclusão/edição/exclusão')
    await goto('/contas')
    const antes = $$('tbody tr').length
    const nome = 'Bot QA ' + Date.now()
    const detalheOrigem = 'Feira QA ' + Date.now()

    byText('button', 'Nova conta')?.click()
    const abriu = await until(() => modal() && /Nova conta/.test(modalTxt()))
    check('modal "Nova conta" abre', abriu)
    if (!abriu) return null

    const salvar = () => modalBtn('Cadastrar conta')
    check('salvar bloqueado sem nome', salvar()?.disabled === true)

    setValue(campo('Nome (razão'), nome)
    await sleep(200)
    check('salvar liberado com nome', salvar()?.disabled === false)

    // validação de CNPJ
    setValue(campo('CNPJ'), '11.222.333/0001-99')
    await sleep(250)
    check('CNPJ inválido é barrado', /CNPJ inválido/i.test(modalTxt()) && salvar()?.disabled === true)
    setValue(campo('CNPJ'), '33.000.167/0001-01')
    await sleep(250)
    check('CNPJ válido libera', !/CNPJ inválido/i.test(modalTxt()))

    // origem do lead + detalhes: o detalhe fica colado na origem e a dica muda
    // conforme ela, porque texto livre sem orientação vira anotação solta
    const selOrigem = campo('Origem do lead')
    check('campo "Origem do lead" existe', Boolean(selOrigem))
    const detalhe = () => campo('Detalhes da origem')
    check('campo "Detalhes da origem" existe', Boolean(detalhe()))
    if (selOrigem && detalhe()) {
      setValue(selOrigem, 'evento'); await sleep(300)
      check('dica do detalhe acompanha "Evento"', /evento|feira/i.test(detalhe().placeholder || ''), detalhe().placeholder)
      setValue(selOrigem, 'parceiro'); await sleep(300)
      check('dica do detalhe acompanha "Parceiro"', /parceiro/i.test(detalhe().placeholder || ''), detalhe().placeholder)
      setValue(selOrigem, 'evento'); await sleep(250)
      setValue(detalhe(), detalheOrigem)
      await sleep(250)
      check('detalhe da origem aceita texto', detalhe().value === detalheOrigem)
    }

    // validação de e-mail no contato
    modalBtn('Adicionar')?.click()
    await sleep(250)
    const emailInput = $$('input', modal()).find((i) => i.placeholder === 'E-mail')
    setValue(emailInput, 'errado@@x')
    await sleep(250)
    check('e-mail inválido é barrado', /formato inválido/i.test(modalTxt()) && salvar()?.disabled === true)
    setValue($$('input', modal()).find((i) => i.placeholder === 'E-mail'), 'qa@bot.com.br')
    setValue($$('input', modal()).find((i) => i.placeholder === 'Nome'), 'Contato QA')
    await sleep(250)

    // Aniversário HOJE (ano antigo, para render idade): a agenda é conferida
    // depois, e o aniversariante precisa cair no período corrente.
    const hoje = new Date()
    const mmdd = `${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const campoAniv = $$('input[type=date]', modal())[0]
    check('contato tem campo de aniversário', Boolean(campoAniv))
    setValue(campoAniv, `1990-${mmdd}`)
    await sleep(250)

    salvar()?.click()
    const criou = await until(() => location.pathname.startsWith('/contas/') && location.pathname.length > 8, 5000)
    check('cadastro cria a conta e abre a conta-visão', criou, location.pathname)
    const idNovo = location.pathname.split('/').pop()

    // a conta-visão mostra o que foi cadastrado
    await until(() => txt().includes(nome), 3000)
    check('conta-visão mostra o nome', txt().includes(nome))
    check('conta-visão mostra o contato', /Contato QA/.test(txt()))
    check('conta-visão mostra o aniversário do contato', /\d+ anos/.test(txt()))
    check('conta-visão mostra os detalhes da origem', txt().includes(detalheOrigem))

    // filtro de detalhes da origem: casa por trecho, ignorando caixa
    await goto('/contas')
    const filtroDetalhe = $('input[list="filtro-detalhes-origem"]')
    check('filtro "Detalhes da origem" existe na lista', Boolean(filtroDetalhe))
    if (filtroDetalhe) {
      const sugestoes = $$('#filtro-detalhes-origem option').map((o) => o.value)
      check('detalhe cadastrado vira sugestão do filtro', sugestoes.includes(detalheOrigem))
      setValue(filtroDetalhe, detalheOrigem.toUpperCase())
      await sleep(400)
      const linhas = $$('tbody tr').length
      check('filtro por trecho encontra a conta', linhas >= 1 && txt().includes(nome), `${linhas} linha(s)`)
      setValue(filtroDetalhe, 'zzz-nao-existe-zzz')
      await sleep(350)
      // a lista vazia é uma linha com a mensagem, não zero linhas
      check('trecho inexistente mostra lista vazia',
        /Nenhuma conta com os filtros/i.test(txt()) && !txt().includes(nome))
      setValue(filtroDetalhe, ''); await sleep(300)
    }

    // duplicata
    await goto('/contas')
    byText('button', 'Nova conta')?.click()
    const abriuDup = await until(() => modal(), 4000)
    check('modal reabre para testar duplicata', abriuDup)
    if (abriuDup) {
      setValue(campo('Nome (razão'), nome.toUpperCase())
      await sleep(220)
      modalBtn('Cadastrar conta')?.click()
      const barrou = await until(() => /já existe uma conta/i.test(modalTxt()), 4000)
      check('nome duplicado é recusado com mensagem clara', barrou)
      modalBtn('Cancelar')?.click()
      await sleep(250)
    }

    // edição não pode perder contatos (regressão já vista em produção)
    await goto(`/contas/${idNovo}`)
    await until(() => byText('button', 'Editar conta'), 3000)
    byText('button', 'Editar conta')?.click()
    const abriuEd = await until(() => modal(), 4000)
    check('modal "Editar conta" abre', abriuEd)
    if (abriuEd) {
      const contatosNoForm = $$('input', modal()).filter((i) => i.placeholder === 'Nome').length
      setValue(campo('Nome fantasia'), 'Fantasia QA')
      await sleep(200)
      modalBtn('Salvar')?.click()
      await until(() => !modal(), 4000)
      await sleep(500)
      check('editar conta preserva contatos', /Contato QA/.test(txt()), `${contatosNoForm} contato(s) no form`)
      check('editar conta grava o campo alterado', /Fantasia QA/.test(txt()))
    }

    return { id: idNovo, nome, antes }
  }

  async function testarContaVisao(conta) {
    group('conta-visão')
    if (!conta) { check('conta de teste disponível', false); return }
    await goto(`/contas/${conta.id}`)
    check('abre a conta', txt().includes(conta.nome))

    // estratégia ABM
    const btnEstrategia = byText('button', 'Definir') || byText('button', 'Editar')
    if (btnEstrategia) {
      btnEstrategia.click()
      const abriu = await until(() => modal() && /Estratégia/i.test(modalTxt()), 3000)
      check('modal de estratégia abre', abriu)
      if (abriu) {
        const ta = $$('textarea', modal())[0]
        setValue(ta, 'Objetivo definido pelo bot de QA')
        await sleep(200)
        modalBtn('Salvar')?.click()
        await until(() => !modal(), 4000)
        await sleep(400)
        check('estratégia é salva e aparece na tela', /bot de QA/.test(txt()))
      }
    } else check('botão de estratégia existe', false)

    // interação
    const btnInteracao = byText('button', 'Registrar')
    if (btnInteracao) {
      btnInteracao.click()
      const abriu = await until(() => modal() && /interação/i.test(modalTxt()), 3000)
      check('modal de interação abre', abriu)
      if (abriu) {
        setValue($('textarea', modal()), 'Interação criada pelo bot')
        await sleep(200)
        modalBtn('Salvar')?.click()
        await until(() => !modal(), 4000)
        await sleep(400)
        check('interação é salva', /Interação criada pelo bot/.test(txt()))
      }
    } else check('botão de interação existe', false)

    // tarefa + oportunidade (marcar serviço cria oportunidade)
    const btnTarefa = byText('button', 'Tarefa') || byText('button', '+ via tarefa')
    if (btnTarefa) {
      btnTarefa.click()
      const abriu = await until(() => modal() && /tarefa/i.test(modalTxt()), 3000)
      check('modal de tarefa abre pela conta', abriu)
      if (abriu) {
        const titulo = $$('input', modal()).find((i) => /Ligação de qualificação/.test(i.placeholder || ''))
        if (titulo) setValue(titulo, 'Tarefa do bot QA')
        const cbServico = $$('input[type=checkbox]', modal())[0]
        if (cbServico) cbServico.click()
        await sleep(250)
        modalBtn('Salvar')?.click()
        await until(() => !modal(), 5000)
        await sleep(600)
        check('tarefa criada aparece na timeline', /Tarefa do bot QA/.test(txt()))
        check('serviço marcado vira oportunidade', /Oportunidades/.test(txt()))
      }
    } else check('botão de tarefa existe', false)
  }

  async function testarAgenda() {
    group('agenda')
    await goto('/agenda')
    check('agenda carrega', telaSaudavel().ok)

    for (const p of ['Dia', 'Semana', 'Mês', 'Período']) {
      byText('button', p)?.click()
      await sleep(400)
      const saude = telaSaudavel()
      check(`período "${p}" funciona`, saude.ok, saude.motivo || '')
    }

    // intervalo de datas
    const datas = $$('input[type=date]')
    check('modo Período tem data inicial e final', datas.length >= 2, `${datas.length} campo(s)`)
    if (datas.length >= 2) {
      setValue(datas[0], '2026-01-01')
      await sleep(250)
      setValue(datas[1], '2026-12-31')
      await sleep(400)
      const comIntervalo = (txt().match(/(\d+) tarefa\(s\)/) || [])[1]
      check('intervalo amplo lista tarefas', Number(comIntervalo) > 0, `${comIntervalo} tarefa(s)`)
      byText('button', 'Limpar')?.click()
      await sleep(350)
      check('limpar intervalo mostra todas as datas', /todas as datas/i.test(txt()))
    }

    // filtros — restaura o valor original em vez de forçar '': nem todo filtro
    // tem opção vazia (o de aniversários, por exemplo, é sempre um dos três).
    byText('button', 'Semana')?.click(); await sleep(350)
    for (const sel of $$('select')) {
      const original = sel.value
      const opcoes = [...sel.options].filter((o) => o.value !== original)
      if (!opcoes.length) continue
      setValue(sel, opcoes[0].value)
      await sleep(300)
      check(`filtro da agenda (${opcoes[0].textContent.trim()}) não quebra`, telaSaudavel().ok)
      setValue(sel, original); await sleep(200)
    }

    // aniversários (o contato criado no teste de contas nasceu "hoje")
    byText('button', 'Mês')?.click(); await sleep(400)
    const temSecao = /Aniversários/.test(txt())
    check('agenda mostra a seção de aniversários', temSecao)
    check('aniversariante do mês aparece', /Contato QA/.test(txt()))

    const selAniv = $$('select').find((s) => [...s.options].some((o) => o.value === 'so'))
    check('filtro de aniversários existe', Boolean(selAniv))
    if (selAniv) {
      setValue(selAniv, 'ocultar'); await sleep(400)
      check('"Sem aniversários" esconde a seção', !/Aniversários/.test(txt()))
      setValue(selAniv, 'so'); await sleep(400)
      check('"Só aniversários" mantém o aniversariante', /Contato QA/.test(txt()))
      check('"Só aniversários" esconde as tarefas', !/tarefa\(s\)/.test(txt()))
      setValue(selAniv, 'junto'); await sleep(300)
    }

    // o período é o filtro por dia/semana/mês: num dia sem aniversário some
    byText('button', 'Dia')?.click(); await sleep(400)
    const dataDia = $$('input[type=date]')[0]
    if (dataDia) {
      const outroDia = new Date()
      outroDia.setDate(outroDia.getDate() + 3)
      const iso = `${outroDia.getFullYear()}-${String(outroDia.getMonth() + 1).padStart(2, '0')}-${String(outroDia.getDate()).padStart(2, '0')}`
      setValue(dataDia, iso); await sleep(500)
      check('dia sem aniversário não lista o aniversariante', !/Contato QA/.test(txt()), iso)
    }
  }

  async function testarPipeline() {
    group('pipeline')
    await goto('/pipeline')
    check('pipeline carrega', telaSaudavel().ok)
    const colunas = $$('.xl\\:grid-cols-7 > div').length
    check('kanban tem as 7 etapas', colunas === 7, `${colunas} colunas`)
    const cards = $$('[draggable="true"]')
    check('há oportunidades no funil', cards.length > 0, `${cards.length} card(s)`)

    if (cards.length) {
      cards[0].click()
      const abriu = await until(() => modal() && /oportunidade/i.test(modalTxt()), 3000)
      check('detalhe da oportunidade abre', abriu)
      if (abriu) {
        check('detalhe mostra aging', /Aging|dias no pipeline/i.test(modalTxt()))
        check('detalhe permite trocar o termômetro', $$('button', modal()).some((b) => /^\d+%$/.test(b.textContent.trim())))
        modalBtn('Fechar')?.click()
        await until(() => !modal(), 3000)
      }
    }
    const dataRef = $('input[type=date]')
    check('pipeline tem data de referência', Boolean(dataRef))
  }

  async function testarServicos() {
    group('serviços')
    await goto('/servicos')
    check('serviços carrega', telaSaudavel().ok)
    const linhas = $$('tbody tr').length
    check('catálogo lista serviços', linhas > 0, `${linhas} serviço(s)`)
    check('mostra valor sugerido', /R\$/.test(txt()))
  }

  async function testarCaptura() {
    group('captura de leads')
    await goto('/captura')
    check('captura carrega', telaSaudavel().ok)
    check('tem upload de foto', Boolean($('input[type=file]')))
    check('tem abas da pré-base', /Pré-base/i.test(txt()))
  }

  async function testarImportador() {
    group('importador')
    await goto('/importar')
    check('importador carrega', telaSaudavel().ok)
    const input = $('input[type=file]')
    check('tem seletor de arquivo', Boolean(input))
    if (!input) return

    const csv = [
      'Cliente,CNPJ,Classificação,Segmento,Porte,Contato (Nome),Contato (E-mail)',
      'Bot Import OK,33.000.167/0001-01,Cliente,Banco,PME,Fulano Bot,fulano@bot.com',
      'Bot Import Ruim,11.222.333/0001-99,Clientex,Varejo,Gigante,Ciclano Bot,errado@@x',
    ].join('\n')
    const dt = new DataTransfer()
    dt.items.add(new File([csv], 'bot.csv', { type: 'text/csv' }))
    input.files = dt.files
    input.dispatchEvent(new Event('change', { bubbles: true }))
    const leu = await until(() => /Pré-visualização/.test(txt()), 5000)
    check('CSV é lido e pré-visualizado', leu)
    if (leu) {
      check('linha inválida gera aviso', /dados? fora do padrão/i.test(txt()))
      // O quadro de avisos precisa apontar a linha da planilha (a linha ruim é
      // a 3: cabeçalho na 1, conta boa na 2). Sem isso o usuário não acha o
      // dado para corrigir na origem.
      const quadro = $$('table')[0]
      const linhasAviso = quadro ? [...quadro.querySelectorAll('tbody tr')] : []
      check('quadro de avisos lista os problemas', linhasAviso.length > 0)
      const apontaLinha3 = linhasAviso.some((tr) => tr.querySelector('td')?.textContent.trim() === '3')
      check('aviso indica a linha da planilha', apontaLinha3)
      check('quadro mostra o campo com problema', /CNPJ|Classificação|Porte|E-mail/.test(quadro?.textContent || ''))
      byText('button', 'Importar')?.click()
      const importou = await until(() => /Importação concluída/.test(txt()), 6000)
      check('importação conclui', importou)
    }
  }

  async function testarConfig() {
    group('config')
    await goto('/config')
    check('config carrega', telaSaudavel().ok)
    check('tem motivos de não-venda', /Motivos de não-venda/i.test(txt()))
    check('tem cadastro de serviços', /Serviços/.test(txt()))

    // motivo de não-venda: inclusão e exclusão
    const inputMotivo = $('input[placeholder*="Novo motivo"]')
    if (inputMotivo) {
      const antes = $$('li').length
      setValue(inputMotivo, 'Motivo QA Bot')
      await sleep(200)
      inputMotivo.closest('div')?.querySelector('button')?.click()
      await sleep(500)
      check('motivo de não-venda é incluído', /Motivo QA Bot/.test(txt()))
      // exclui
      const chip = $$('li').find((li) => li.textContent.includes('Motivo QA Bot'))
      chip?.querySelector('button')?.click()
      await sleep(500)
      check('motivo de não-venda é excluído', !/Motivo QA Bot/.test(txt()), `${antes} itens antes`)
    } else check('campo de novo motivo existe', false)

    // Apagar usuário exige confirmação: é irreversível e não tem desfazer.
    // O ponto da verificação é justamente que a lixeira NÃO apaga sozinha.
    const lixeirasUsuario = $$('button[aria-label^="Apagar"]')
    check('gestão de usuários tem botão de apagar', lixeirasUsuario.length > 0, `${lixeirasUsuario.length}`)
    if (lixeirasUsuario.length) {
      const alvo = lixeirasUsuario[lixeirasUsuario.length - 1].getAttribute('aria-label')
      lixeirasUsuario[lixeirasUsuario.length - 1].click()
      const abriu = await until(() => modal() && /Tem certeza que deseja apagar este usuário/i.test(modalTxt()), 3000)
      check('lixeira pede confirmação antes de apagar', abriu)
      check('confirmação diz QUEM será apagado', abriu && modalTxt().includes(alvo.replace('Apagar ', '')))
      check('nada foi apagado ainda', $$('button[aria-label^="Apagar"]').length === lixeirasUsuario.length)
      modalBtn('Cancelar')?.click()
      await until(() => !modal(), 3000)
      check('cancelar mantém o usuário', $$('button[aria-label^="Apagar"]').length === lixeirasUsuario.length)
    }
  }

  async function testarExclusaoConta(conta) {
    group('exclusão')
    if (!conta) { check('conta de teste disponível para exclusão', false); return }
    // exclui a oportunidade criada (a conta-visão tem o botão de lixeira)
    await goto(`/contas/${conta.id}`)
    await sleep(500)
    const lixeiras = $$('button').filter((b) => b.querySelector('svg.lucide-trash2'))
    check('conta-visão oferece exclusão de itens', lixeiras.length > 0, `${lixeiras.length} botão(ões)`)
    if (lixeiras.length) {
      const antes = txt()
      lixeiras[0].click()
      await sleep(700)
      check('exclusão de item funciona', txt() !== antes)
    }
  }

  async function crmBot(opts = {}) {
    const only = opts.only ? new Set(opts.only) : null
    const rodar = (nome) => !only || only.has(nome)
    report.length = 0
    runtimeErrors.length = 0
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)

    const t0 = Date.now()
    console.log('%c🤖 Bot de QA do Consulcard CRM — iniciando', 'font-weight:bold;font-size:14px')
    let conta = null
    try {
      if (rodar('navegacao')) await testarNavegacao()
      if (rodar('contas')) await testarContasFiltros()
      if (rodar('contas')) conta = await testarContaCRUD()
      if (rodar('conta')) await testarContaVisao(conta)
      if (rodar('agenda')) await testarAgenda()
      if (rodar('pipeline')) await testarPipeline()
      if (rodar('servicos')) await testarServicos()
      if (rodar('captura')) await testarCaptura()
      if (rodar('importar')) await testarImportador()
      if (rodar('config')) await testarConfig()
      if (rodar('exclusao')) await testarExclusaoConta(conta)
    } catch (e) {
      check('execução do bot', false, 'exceção: ' + (e?.message || e))
    } finally {
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }

    group('runtime')
    const ruido = /ResizeObserver|Non-Error promise rejection/i
    const erros = [...new Set(runtimeErrors)].filter((m) => !ruido.test(m))
    check('sem erros de JavaScript durante a varredura', erros.length === 0, erros.slice(0, 3).join(' | '))

    const falhas = report.filter((r) => r.resultado === 'FAIL')
    const resumo = {
      total: report.length,
      passou: report.length - falhas.length,
      falhou: falhas.length,
      segundos: Math.round((Date.now() - t0) / 1000),
    }
    console.table(report)
    if (falhas.length) {
      console.log('%c✗ ' + falhas.length + ' falha(s):', 'color:#be123c;font-weight:bold')
      console.table(falhas)
    } else {
      console.log('%c✓ tudo passou', 'color:#047857;font-weight:bold')
    }
    console.log('resumo:', resumo)
    return { resumo, falhas, report }
  }

  window.crmBot = crmBot
  console.log('Bot carregado. Rode:  await crmBot()')
})()
