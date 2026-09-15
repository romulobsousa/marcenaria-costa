/* =====================================================================
   Área de orçamentos — usa o núcleo (App)
   ===================================================================== */

(function () {
  'use strict';
  var App = window.App;
  var $ = App.$, $$ = App.$$, esc = App.esc, dinheiro = App.dinheiro;
  var CFG = App.cfg;

  var atual = null;
  var filtro = 'todos';
  var busca = '';

  var ROTULO = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' };

  /* O custo do marceneiro e a sua margem moram noutra tabela, que só o
     admin alcança. Aqui dentro eles vivem em "conta"; o preço que o
     cliente vê já sai calculado dentro de atual.itens[].valor. */
  var conta = { custos: {}, margem: 20 };

  var DEGRAU = 10;        // preço ao cliente arredondado para a dezena

  function precoDoCusto(custo, margem) {
    var bruto = (Number(custo) || 0) * (1 + (Number(margem) || 0) / 100);
    return Math.round(bruto / DEGRAU) * DEGRAU;
  }

  /* cada móvel ganha um id próprio: é por ele que o custo se agarra ao
     móvel certo, mesmo que a lista seja reordenada ou mexida depois */
  function idDeItem() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function garantirIds(itens) {
    itens.forEach(function (it) { if (!it.id) it.id = idDeItem(); });
    return itens;
  }

  function custoDe(it) { return Number(conta.custos[it.id]) || 0; }

  /* Preço escrito na mão que não bate com o custo × margem: o sistema
     não corrige sozinho (o preço pode ter sido combinado assim com o
     cliente), mas avisa e deixa acertar com um clique. */
  function descompasso(it) {
    if (!App.ehAdmin()) return '';
    var c = custoDe(it);
    if (!c) return '';
    var deveria = precoDoCusto(c, conta.margem);
    if (Math.abs(deveria - (Number(it.valor) || 0)) < 0.01) return '';
    return '<p class="item__aviso">Com ' + conta.margem + '% em cima do custo daria ' +
           dinheiro(deveria) + '. <button type="button" data-acertar="' + esc(it.id) + '">usar esse</button></p>';
  }

  function custoTotal() {
    return atual.itens.reduce(function (a, it) {
      return a + custoDe(it) * (Number(it.qtd) || 0);
    }, 0);
  }

  /* como o orçamento aparece no histórico */
  function rotulo(o) {
    return 'Orçamento ' + String(o.numero || 0).padStart(3, '0') +
           (o.cliente_nome ? ' · ' + o.cliente_nome : '');
  }

  /* com a equipe compartilhando a lista, vale dizer de quem é cada orçamento */
  function quem(o) {
    var nome = App.nomeDe ? App.nomeDe(o.user_id) : '';
    return nome ? 'por ' + nome : '';
  }

  /* ---------------- lista ---------------- */
  function pintarLista() {
    var alvo = $('#lista');
    var termo = busca.trim().toLowerCase();

    var vis = App.orcamentos.filter(function (o) {
      if (filtro !== 'todos' && o.status !== filtro) return false;
      if (!termo) return true;
      return (o.cliente_nome || '').toLowerCase().indexOf(termo) >= 0 ||
             String(o.numero).indexOf(termo) >= 0;
    });

    var aprovados = App.orcamentos.filter(function (o) { return o.status === 'aprovado'; });
    var soma = aprovados.reduce(function (a, o) { return a + App.totalOrcamento(o); }, 0);
    $('#lista-resumo').textContent = App.orcamentos.length === 0
      ? 'Nenhum orçamento ainda'
      : App.orcamentos.length + (App.orcamentos.length === 1 ? ' orçamento' : ' orçamentos') +
        (aprovados.length ? '  ·  ' + dinheiro(soma) + ' aprovados' : '');

    if (!vis.length) {
      alvo.innerHTML = '<div class="vazio"><strong>' +
        (App.orcamentos.length ? 'Nada encontrado' : 'Comece pelo primeiro orçamento') + '</strong>' +
        (App.orcamentos.length ? 'Tente outro termo ou situação.'
                               : 'Clique em “Novo orçamento” para montar uma proposta e enviar em PDF.') + '</div>';
      return;
    }

    alvo.innerHTML = vis.map(function (o) {
      var n = (Array.isArray(o.itens) ? o.itens : []).length;
      var data = new Date(o.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return '<article class="item-lista" data-id="' + o.id + '" tabindex="0" role="button">' +
        '<span class="item-lista__num">' + String(o.numero).padStart(3, '0') + '</span>' +
        '<div class="item-lista__meio">' +
          '<div class="item-lista__cliente' + (o.cliente_nome ? '' : ' item-lista__cliente--vazio') + '">' +
            esc(o.cliente_nome || 'Sem cliente') + '</div>' +
          '<div class="item-lista__resumo">' + data + '  ·  ' + n + (n === 1 ? ' móvel' : ' móveis') +
            (quem(o) ? '  ·  ' + esc(quem(o)) : '') +
            (o.arquivado_em ? '  ·  <span class="fora-da-tela">fora da tela inicial</span>' : '') + '</div>' +
        '</div>' +
        '<span class="marca-status marca-status--' + o.status + '">' + ROTULO[o.status] + '</span>' +
        '<span class="item-lista__valor">' + dinheiro(App.totalOrcamento(o)) + '</span>' +
      '</article>';
    }).join('');

    $$('.item-lista', alvo).forEach(function (el) {
      function abrir() {
        var o = App.orcamentos.filter(function (x) { return x.id === el.dataset.id; })[0];
        if (o) abrirEditor(o);
      }
      el.addEventListener('click', abrir);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
      });
    });
  }

  $('#busca').addEventListener('input', function (e) { busca = e.target.value; pintarLista(); });
  $$('.pilulas button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.pilulas button').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      filtro = b.dataset.f;
      pintarLista();
    });
  });

  /* ---------------- editor ---------------- */
  function novo(base) {
    var p = CFG.padroes || {};
    return Object.assign({
      id: null, numero: null, status: 'rascunho',
      cliente_nome: '', cliente_telefone: '', cliente_email: '', cliente_endereco: '',
      itens: [{ descricao: '', detalhes: '', qtd: 1, valor: 0 }],
      desconto: 0,
      prazo_entrega: p.prazo_entrega || '',
      forma_pagamento: p.forma_pagamento || '',
      observacoes: p.observacoes || '',
      validade_dias: p.validade_dias || 15,
      criado_em: new Date().toISOString()
    }, base || {});
  }

  App.novoOrcamentoCom = function (dados) { abrirEditor(novo(dados)); };
  App.abrirOrcamento    = function (o) { abrirEditor(o); };

  $('#btn-novo').addEventListener('click', function () { abrirEditor(novo()); });

  $('#btn-voltar').addEventListener('click', function () {
    if (App.sujo && !confirm('Há alterações não salvas. Voltar mesmo assim?')) return;
    App.sujo = false;
    App.ir('orcamentos');
  });

  function abrirEditor(o) {
    atual = JSON.parse(JSON.stringify(o));
    if (!Array.isArray(atual.itens) || !atual.itens.length) {
      atual.itens = [{ descricao: '', detalhes: '', qtd: 1, valor: 0 }];
    }
    garantirIds(atual.itens);
    App.sujo = false;

    conta = { custos: {}, margem: 20 };
    $('#conta').hidden = !App.ehAdmin();
    if (App.ehAdmin() && o.id) carregarConta(o.id);
    else pintarConta();

    var ehNovo = !o.id;
    $('#editor-titulo').textContent = ehNovo ? 'Novo orçamento' : 'Orçamento ' + String(o.numero).padStart(3, '0');
    $('#editor-sub').textContent = ehNovo ? 'Ainda não salvo'
      : 'Criado em ' + new Date(o.criado_em).toLocaleDateString('pt-BR');
    $('#btn-excluir').hidden = ehNovo || !App.podeApagar();
    $('#voltar-pra-tela').hidden = !o.arquivado_em;

    $('#c-nome').value = o.cliente_nome || '';
    $('#c-telefone').value = o.cliente_telefone || '';
    $('#c-email').value = o.cliente_email || '';
    $('#c-endereco').value = o.cliente_endereco || '';
    $('#c-prazo').value = o.prazo_entrega || '';
    $('#c-pagamento').value = o.forma_pagamento || '';
    $('#c-validade').value = o.validade_dias || 15;
    $('#c-obs').value = o.observacoes || '';
    $('#c-desconto').value = o.desconto || 0;
    $('#sel-status').value = o.status || 'rascunho';
    $('#estado-salvo').textContent = ehNovo ? 'Ainda não salvo' : '';

    pintarItens();
    App.ir('editor');
  }

  function pintarItens() {
    var alvo = $('#itens');
    $('#itens-vazio').hidden = atual.itens.length > 0;

    alvo.innerHTML = atual.itens.map(function (it, i) {
      var soma = (Number(it.qtd) || 0) * (Number(it.valor) || 0);
      return '<div class="item" data-i="' + i + '">' +
        '<div class="item__topo">' +
          '<label class="campo"><span class="campo__rot">Móvel</span>' +
          '<input type="text" data-c="descricao" value="' + esc(it.descricao) + '" placeholder="Cozinha planejada"></label>' +
          '<button class="remover" type="button" data-remover="' + i + '" aria-label="Remover móvel">✕</button>' +
        '</div>' +
        '<label class="campo"><span class="campo__rot">Detalhes <i>saem no PDF, abaixo do nome</i></span>' +
        '<textarea data-c="detalhes" rows="2" placeholder="MDF branco 18mm, puxador perfil, 3 gavetas">' +
        esc(it.detalhes) + '</textarea></label>' +
        '<div class="item__linha">' +
          '<label class="campo"><span class="campo__rot">Qtd</span>' +
          '<input type="number" data-c="qtd" min="1" step="1" value="' + (Number(it.qtd) || 1) + '"></label>' +
          (App.ehAdmin()
            ? '<label class="campo campo--custo"><span class="campo__rot">Custo do marceneiro</span>' +
              '<div class="com-prefixo"><span>R$</span>' +
              '<input type="number" data-custo min="0" step="0.01" value="' + custoDe(it) + '"></div></label>'
            : '') +
          '<label class="campo"><span class="campo__rot">' +
            (App.ehAdmin() ? 'Preço ao cliente' : 'Valor unitário') + '</span>' +
          '<div class="com-prefixo"><span>R$</span>' +
          '<input type="number" data-c="valor" min="0" step="0.01" value="' + (Number(it.valor) || 0) + '"></div></label>' +
          '<div class="item__soma">' + dinheiro(soma) + '</div>' +
        '</div>' + descompasso(it) + '</div>';
    }).join('');

    $$('[data-c]', alvo).forEach(function (campo) {
      campo.addEventListener('input', function () {
        var i = +campo.closest('.item').dataset.i;
        var chave = campo.dataset.c;
        atual.itens[i][chave] = (chave === 'qtd' || chave === 'valor')
          ? (parseFloat(campo.value) || 0) : campo.value;
        sujar();
        if (chave === 'qtd' || chave === 'valor') {
          var s = (Number(atual.itens[i].qtd) || 0) * (Number(atual.itens[i].valor) || 0);
          campo.closest('.item').querySelector('.item__soma').textContent = dinheiro(s);
          recalcular();
        }
      });
    });

    $$('[data-custo]', alvo).forEach(function (campo) {
      campo.addEventListener('input', function () {
        var i = +campo.closest('.item').dataset.i;
        var it = atual.itens[i];
        conta.custos[it.id] = parseFloat(campo.value) || 0;
        it.valor = precoDoCusto(conta.custos[it.id], conta.margem);

        var caixa = campo.closest('.item');
        caixa.querySelector('[data-c="valor"]').value = it.valor;
        caixa.querySelector('.item__soma').textContent =
          dinheiro(it.valor * (Number(it.qtd) || 0));
        sujar(); recalcular();
      });
    });

    $$('[data-remover]', alvo).forEach(function (b) {
      b.addEventListener('click', function () {
        var fora = atual.itens.splice(+b.dataset.remover, 1)[0];
        if (fora && fora.id) delete conta.custos[fora.id];
        sujar(); pintarItens(); recalcular();
      });
    });

    recalcular();
  }

  $('#btn-add-item').addEventListener('click', function () {
    atual.itens.push({ id: idDeItem(), descricao: '', detalhes: '', qtd: 1, valor: 0 });
    sujar(); pintarItens();
    var cs = $$('#itens input[data-c="descricao"]');
    if (cs.length) cs[cs.length - 1].focus();
  });

  function recalcular() {
    var sub = atual.itens.reduce(function (a, it) {
      return a + (Number(it.qtd) || 0) * (Number(it.valor) || 0);
    }, 0);
    var desc = Number($('#c-desconto').value) || 0;
    $('#t-subtotal').textContent = dinheiro(sub);
    $('#t-total').textContent = dinheiro(Math.max(0, sub - desc));
    pintarConta();
  }

  /* ---------------- sua conta (só admin) ---------------- */
  function carregarConta(idOrc) {
    App.sb.from('orcamento_custos').select('*').eq('orcamento_id', idOrc).maybeSingle()
      .then(function (r) {
        if (r.error) throw r.error;
        if (r.data) {
          conta.custos = r.data.custos || {};
          conta.margem = Number(r.data.margem) || 20;
        }
        $('#c-margem').value = conta.margem;
        pintarItens();
      })
      .catch(function (e) {
        var m = (e && e.message) || '';
        if (/relation .*orcamento_custos.* does not exist/i.test(m)) {
          $('#conta').hidden = true;
          App.avisar('Para usar custo e margem, rode o banco-custos.sql no Supabase.', 'erro');
        }
      });
  }

  function salvarConta(idOrc) {
    if (!App.ehAdmin() || !idOrc) return Promise.resolve();
    return App.sb.from('orcamento_custos')
      .upsert({ orcamento_id: idOrc, custos: conta.custos, margem: conta.margem },
              { onConflict: 'orcamento_id' })
      .then(function () {})
      .catch(function () {});     // a conta é sua; se falhar, o orçamento já está salvo
  }

  function pintarConta() {
    if (!App.ehAdmin() || $('#conta').hidden) return;

    var custo   = custoTotal();
    var subtot  = atual.itens.reduce(function (a, it) {
      return a + (Number(it.qtd) || 0) * (Number(it.valor) || 0);
    }, 0);
    var desc    = Number(atual.desconto) || 0;
    var cliente = Math.max(0, subtot - desc);
    var lucro   = cliente - custo;

    $('#margem-valor').textContent = conta.margem + '%';
    $('#t-custo').textContent   = dinheiro(custo);
    $('#t-cliente').textContent = dinheiro(cliente);
    $('#t-lucro').textContent   = dinheiro(lucro);
    $('#t-lucro').closest('.linha-total').dataset.sinal = lucro < 0 ? 'ruim' : 'bom';

    if (!custo) {
      $('#conta-nota').textContent =
        'Preencha o custo do marceneiro em cada móvel e o preço ao cliente sai sozinho, com a margem em cima.';
      $('#conta-limite').textContent = '';
      $('#avista').hidden = true;
      return;
    }

    $('#avista').hidden = false;
    $('#conta-nota').textContent = lucro < 0
      ? 'O desconto já passou do custo: nesta venda você está tirando do bolso.'
      : 'Sobre o custo, isso é ' + Math.round(lucro / custo * 100) + '% de ganho' +
        (desc ? '  ·  já descontando os ' + dinheiro(desc) + ' do orçamento' : '') + '.';

    // até quanto dá para descer sem entrar no prejuízo
    var folga = cliente - custo;
    var folgaPct = cliente ? folga / cliente * 100 : 0;
    $('#conta-limite').textContent = folga > 0
      ? 'Dá para descer até ' + dinheiro(folga) + ' (' + folgaPct.toFixed(1).replace('.', ',') +
        '%). Daí para baixo é prejuízo.'
      : 'Não há folga: qualquer desconto agora sai do seu bolso.';

    $('#avista').innerHTML = [5, 10, 15].map(function (pct) {
      var abatido = Math.round(cliente * pct / 100 / DEGRAU) * DEGRAU;
      var paga    = cliente - abatido;
      var sobra   = paga - custo;
      return '<div class="avista__linha"' + (sobra < 0 ? ' data-sinal="ruim"' : '') + '>' +
        '<span class="avista__pct">' + pct + '% à vista</span>' +
        '<span class="avista__paga">' + dinheiro(paga) + '</span>' +
        '<span class="avista__lucro">sobra ' + dinheiro(sobra) + '</span>' +
        '<button type="button" data-avista="' + abatido + '">usar</button>' +
      '</div>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('#itens [data-acertar]');
    if (!b) return;
    atual.itens.forEach(function (it) {
      if (it.id === b.dataset.acertar) it.valor = precoDoCusto(custoDe(it), conta.margem);
    });
    sujar(); pintarItens(); recalcular();
  });

  /* põe o desconto simulado no orçamento de verdade */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('#avista [data-avista]');
    if (!b) return;
    atual.desconto = (Number(atual.desconto) || 0) + Number(b.dataset.avista);
    $('#c-desconto').value = atual.desconto;
    sujar(); recalcular();
    App.avisar('Desconto aplicado no orçamento');
  });

  $('#c-margem').addEventListener('input', function (e) {
    conta.margem = parseInt(e.target.value, 10) || 20;
    $('#margem-valor').textContent = conta.margem + '%';
    // o preço de cada móvel que tem custo acompanha a margem
    var mexeu = false;
    atual.itens.forEach(function (it) {
      var c = custoDe(it);
      if (c) { it.valor = precoDoCusto(c, conta.margem); mexeu = true; }
    });
    sujar();
    if (mexeu) pintarItens(); else pintarConta();
  });

  function sujar() {
    App.sujo = true;
    $('#estado-salvo').textContent = 'Alterações não salvas';
  }

  [['#c-nome','cliente_nome'], ['#c-telefone','cliente_telefone'], ['#c-email','cliente_email'],
   ['#c-endereco','cliente_endereco'], ['#c-prazo','prazo_entrega'], ['#c-pagamento','forma_pagamento'],
   ['#c-obs','observacoes']].forEach(function (par) {
    $(par[0]).addEventListener('input', function (e) { atual[par[1]] = e.target.value; sujar(); });
  });
  $('#c-validade').addEventListener('input', function (e) {
    atual.validade_dias = parseInt(e.target.value, 10) || 15; sujar();
  });
  $('#c-desconto').addEventListener('input', function (e) {
    atual.desconto = parseFloat(e.target.value) || 0; sujar(); recalcular();
  });
  $('#sel-status').addEventListener('change', function (e) { atual.status = e.target.value; sujar(); });

  /* ---------------- salvar ---------------- */
  function salvar() {
    if (!atual.cliente_nome.trim()) {
      App.avisar('Coloque o nome do cliente antes de salvar.', 'erro');
      $('#c-nome').focus();
      return Promise.reject(new Error('sem cliente'));
    }

    var dados = {
      user_id: App.usuario.id,
      cliente_nome: atual.cliente_nome, cliente_telefone: atual.cliente_telefone,
      cliente_email: atual.cliente_email, cliente_endereco: atual.cliente_endereco,
      itens: garantirIds(atual.itens.filter(function (it) {
        return (it.descricao || '').trim() || Number(it.valor);
      })),
      desconto: Number(atual.desconto) || 0,
      prazo_entrega: atual.prazo_entrega, forma_pagamento: atual.forma_pagamento,
      observacoes: atual.observacoes, validade_dias: Number(atual.validade_dias) || 15,
      status: atual.status
    };

    App.carregando(true);
    var q = atual.id
      ? App.sb.from('orcamentos').update(dados).eq('id', atual.id).select().single()
      : App.sb.from('orcamentos').insert(dados).select().single();

    return q.then(function (r) {
      App.carregando(false);
      if (r.error) throw r.error;
      atual = r.data;
      atual.itens = Array.isArray(r.data.itens) ? r.data.itens : [];
      if (!atual.itens.length) atual.itens = [{ descricao: '', detalhes: '', qtd: 1, valor: 0 }];
      App.sujo = false;
      $('#editor-titulo').textContent = 'Orçamento ' + String(r.data.numero).padStart(3, '0');
      $('#editor-sub').textContent = 'Criado em ' + new Date(r.data.criado_em).toLocaleDateString('pt-BR');
      $('#btn-excluir').hidden = !App.podeApagar();
      $('#estado-salvo').textContent = 'Salvo às ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      App.avisar('Orçamento salvo');
      salvarConta(r.data.id);
      App.recarregar(true);
      return r.data;
    }).catch(function (e) {
      App.carregando(false);
      if (e && e.message !== 'sem cliente') App.avisar(App.textoErro(e), 'erro');
      throw e;
    });
  }

  $('#btn-salvar').addEventListener('click', function () { salvar().catch(function () {}); });

  $('#btn-excluir').addEventListener('click', function () {
    if (!atual.id) return;
    if (!confirm('Excluir este orçamento? Não dá para desfazer.')) return;
    App.carregando(true);
    App.sb.from('orcamentos').delete().eq('id', atual.id).then(function (r) {
      App.carregando(false);
      if (r.error) { App.avisar(App.textoErro(r.error), 'erro'); return; }
      App.sujo = false;
      App.avisar('Orçamento excluído');
      App.recarregar(true);
      App.ir('orcamentos');
    });
  });

  /* Tirado da tela inicial pelo botão "Limpar a tela": aqui dá para
     trazer de volta, sem precisar mexer na situação do orçamento. */
  $('#voltar-pra-tela').addEventListener('click', function () {
    if (!atual.id) return;
    App.carregando(true);
    App.sb.from('orcamentos').update({ arquivado_em: null }).eq('id', atual.id)
      .then(function (r) {
        App.carregando(false);
        if (r.error) throw r.error;
        atual.arquivado_em = null;
        $('#voltar-pra-tela').hidden = true;
        App.avisar('Voltou para a tela inicial');
        App.recarregar(true);
      })
      .catch(function (e) {
        App.carregando(false);
        App.avisar(App.textoErro(e), 'erro');
      });
  });

  /* ---------------- PDF e WhatsApp ---------------- */
  function garantirSalvo() {
    if (App.sujo || !atual.id) return salvar();
    return Promise.resolve(atual);
  }

  $('#btn-pdf').addEventListener('click', function () {
    garantirSalvo().then(function (o) {
      try {
        App.avisar('PDF gerado: ' + window.gerarPDF(o).nome);
        App.registrar('orcamento_pdf', rotulo(o), '', o.id);
      }
      catch (e) { App.avisar(e.message, 'erro'); }
    }).catch(function () {});
  });

  /* Anexar arquivo por link do WhatsApp não existe — o wa.me só leva texto.
     Dois caminhos, nesta ordem:
       1. Celular: navigator.share manda o PDF como arquivo de verdade.
       2. Computador: sobe o PDF e põe o link na mensagem. */
  function enviarWhatsApp(o, pdf) {
    var tel = String(o.cliente_telefone || '').replace(/\D/g, '');
    if (tel.length <= 11) tel = '55' + tel;
    var emp = CFG.empresa || {};
    var primeiro = o.cliente_nome ? o.cliente_nome.split(' ')[0] : '';

    function texto(link) {
      return 'Olá' + (primeiro ? ', ' + primeiro : '') + '! ' +
        'Segue o orçamento nº ' + String(o.numero).padStart(3, '0') +
        ' da ' + (emp.nome || 'marcenaria') + '.\n\n' +
        'Valor total: ' + dinheiro(pdf.total) + '\n' +
        (o.prazo_entrega ? 'Prazo: ' + o.prazo_entrega + '\n' : '') +
        (o.forma_pagamento ? 'Pagamento: ' + o.forma_pagamento + '\n' : '') +
        (link ? '\nO orçamento completo está aqui:\n' + link + '\n' : '') +
        '\nQualquer dúvida é só chamar!';
    }

    var arquivo = new File([pdf.blob], pdf.nome, { type: 'application/pdf' });

    // ---- caminho 1: compartilhar o arquivo (celular) ----
    if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
      return navigator.share({
        files: [arquivo],
        title: 'Orçamento ' + String(o.numero).padStart(3, '0'),
        text: texto(null)
      }).then(function () {
        App.avisar('Escolha o WhatsApp e o contato para enviar');
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return;   // desistiu, sem alarde
        return viaLink(o, pdf, texto, tel);
      });
    }

    // ---- caminho 2: link do PDF (computador) ----
    return viaLink(o, pdf, texto, tel);
  }

  /* A página do orçamento fica no site da marcenaria (/p?id=...), não no
     Supabase: o Supabase entrega arquivo para baixar, não página para abrir —
     no celular do cliente aparecia o código-fonte. O que sobe para lá é só
     o PDF, que é arquivo mesmo. */
  function enderecoDaPagina(o) {
    var base = (CFG.empresa && CFG.empresa.site)
      ? 'https://www.' + String(CFG.empresa.site).replace(/^(https?:\/\/)?(www\.)?/, '')
      : location.origin;
    return base + '/p?id=' + o.id;
  }

  function viaLink(o, pdf, texto, tel) {
    App.carregando(true);
    // a pasta é a de quem CRIOU o orçamento, não a de quem está enviando:
    // é esse caminho que a página do cliente procura para o botão de PDF
    var pasta = (o.user_id || App.usuario.id) + '/' + o.id;
    var loja = App.sb.storage.from('orcamentos');

    return loja.upload(pasta + '.pdf', pdf.blob,
                       { contentType: 'application/pdf', upsert: true })
      .then(function (r) {
        if (r.error) throw r.error;
        return enderecoDaPagina(o);
      })
      .then(function (link) {
        App.carregando(false);
        window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texto(link)),
                    '_blank', 'noopener');
        App.avisar('Mensagem pronta com o link do orçamento');
      })
      .catch(function (e) {
        App.carregando(false);
        var m = (e && e.message) || '';
        if (/Bucket not found/i.test(m)) {
          App.avisar('Falta criar a guarda de arquivos: rode o banco-arquivos.sql no Supabase.', 'erro');
        } else if (/mime|content.?type/i.test(m)) {
          App.avisar('O Supabase recusou o tipo de arquivo. Rode o banco-arquivos.sql atualizado.', 'erro');
        } else {
          App.avisar('Não consegui subir o orçamento (' + m + '). Vou baixar o PDF para você anexar.', 'erro');
        }
        try { window.gerarPDF(o); } catch (x) {}
        window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(texto(null)),
                    '_blank', 'noopener');
      });
  }

  /* Mandar é enviar: um orçamento ainda em rascunho não abre pelo link (o
     banco só mostra os enviados), e não entraria na fila de cobrança. */
  function marcarEnviado(o) {
    if (o.status !== 'rascunho') return Promise.resolve(o);
    return App.sb.from('orcamentos').update({ status: 'enviado' })
      .eq('id', o.id).select().single()
      .then(function (r) {
        if (r.error) return o;                    // envia mesmo assim
        atual.status = 'enviado';
        if ($('#sel-status')) $('#sel-status').value = 'enviado';
        App.recarregar(true);
        return r.data;
      })
      .catch(function () { return o; });
  }

  $('#btn-zap').addEventListener('click', function () {
    garantirSalvo().then(marcarEnviado).then(function (o) {
      var tel = String(o.cliente_telefone || '').replace(/\D/g, '');
      if (!tel) { App.avisar('Coloque o WhatsApp do cliente para enviar.', 'erro'); $('#c-telefone').focus(); return; }

      var pdf;
      try { pdf = window.gerarPDF(o, { retornarBlob: true }); }
      catch (e) { App.avisar(e.message, 'erro'); return; }

      App.registrar('orcamento_whatsapp', rotulo(o), 'para ' + (o.cliente_telefone || ''), o.id);
      enviarWhatsApp(o, pdf);
    }).catch(function () {});
  });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's' && App.rotaAtual === 'editor') {
      e.preventDefault(); salvar().catch(function () {});
    }
  });

  App.aoCarregarDados.push(pintarLista);
})();
