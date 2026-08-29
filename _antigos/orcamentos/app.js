/* =====================================================================
   Marcenaria Costa — orçamentos
   ===================================================================== */

(function () {
  'use strict';

  var CFG = window.CONFIG_ORCAMENTO || {};
  var $  = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var sb = null;
  var estado = {
    usuario: null,
    lista: [],
    atual: null,
    filtro: 'todos',
    busca: '',
    sujo: false
  };

  /* ---------------- utilidades ---------------- */
  function dinheiro(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function carregando(on) { $('#carregando').toggleAttribute('data-on', !!on); }

  var timerAviso;
  function avisar(msg, tipo) {
    var el = $('#aviso');
    el.textContent = msg;
    el.setAttribute('data-tipo', tipo || 'ok');
    el.setAttribute('data-on', '');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { el.removeAttribute('data-on'); }, tipo === 'erro' ? 5200 : 2600);
  }

  function mostrarTela(qual) {
    ['#tela-login', '#tela-lista', '#tela-editor'].forEach(function (s) {
      $(s).hidden = s !== qual;
    });
    window.scrollTo(0, 0);
  }

  function textoErro(e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail no link que o Supabase enviou e tente de novo.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique sua internet.';
    if (/JWT|session/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    return m || 'Algo deu errado.';
  }

  /* ---------------- arranque ---------------- */
  function faltaConfig() {
    return !CFG.SUPABASE_URL || /COLE_AQUI/.test(CFG.SUPABASE_URL) ||
           !CFG.SUPABASE_CHAVE || /COLE_AQUI/.test(CFG.SUPABASE_CHAVE);
  }

  function iniciar() {
    if (faltaConfig()) {
      document.body.innerHTML =
        '<div style="max-width:560px;margin:14vh auto;padding:28px;font-family:Inter,sans-serif;' +
        'background:#fffdf9;border:1px solid #e2dbcc;border-radius:14px;line-height:1.6">' +
        '<h1 style="font-family:Georgia,serif;margin:0 0 10px;font-size:1.3rem">Falta configurar o banco</h1>' +
        '<p style="color:#56503f;margin:0 0 14px">Abra o arquivo <code>orcamentos/config.js</code> e cole a URL e a chave ' +
        'do seu projeto no Supabase (Settings → API). Depois publique o site de novo.</p>' +
        '<p style="color:#8b8371;font-size:.88rem;margin:0">O passo a passo está no arquivo ' +
        '<code>orcamentos/INSTALACAO.md</code>.</p></div>';
      return;
    }

    if (!window.supabase || !window.supabase.createClient) {
      avisar('A biblioteca do banco não carregou. Recarregue a página.', 'erro');
      return;
    }

    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_CHAVE);

    sb.auth.getSession().then(function (r) {
      var sessao = r && r.data && r.data.session;
      if (sessao) { estado.usuario = sessao.user; abrirLista(); }
      else mostrarTela('#tela-login');
    }).catch(function () { mostrarTela('#tela-login'); });

    sb.auth.onAuthStateChange(function (evento) {
      if (evento === 'SIGNED_OUT') { estado.usuario = null; mostrarTela('#tela-login'); }
    });
  }

  /* ---------------- login ---------------- */
  $('#form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var erro = $('#login-erro');
    erro.hidden = true;
    $('#login-btn').disabled = true;
    carregando(true);

    sb.auth.signInWithPassword({
      email: $('#login-email').value.trim(),
      password: $('#login-senha').value
    }).then(function (r) {
      if (r.error) throw r.error;
      estado.usuario = r.data.user;
      $('#login-senha').value = '';
      abrirLista();
    }).catch(function (e) {
      erro.textContent = textoErro(e);
      erro.hidden = false;
    }).then(function () {
      $('#login-btn').disabled = false;
      carregando(false);
    });
  });

  $('#btn-sair').addEventListener('click', function () {
    if (estado.sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    carregando(true);
    sb.auth.signOut().then(function () {
      estado.usuario = null; estado.lista = []; estado.atual = null;
      carregando(false);
      mostrarTela('#tela-login');
    });
  });

  /* ---------------- lista ---------------- */
  function abrirLista() {
    mostrarTela('#tela-lista');
    carregarLista();
  }

  function carregarLista() {
    carregando(true);
    sb.from('orcamentos').select('*').order('criado_em', { ascending: false })
      .then(function (r) {
        carregando(false);
        if (r.error) { avisar(textoErro(r.error), 'erro'); return; }
        estado.lista = r.data || [];
        pintarLista();
      });
  }

  function totalDe(o) {
    var s = (Array.isArray(o.itens) ? o.itens : []).reduce(function (a, it) {
      return a + (Number(it.qtd) || 0) * (Number(it.valor) || 0);
    }, 0);
    return Math.max(0, s - (Number(o.desconto) || 0));
  }

  var ROTULO = { rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', recusado: 'Recusado' };

  function pintarLista() {
    var alvo = $('#lista');
    var termo = estado.busca.trim().toLowerCase();

    var vis = estado.lista.filter(function (o) {
      if (estado.filtro !== 'todos' && o.status !== estado.filtro) return false;
      if (!termo) return true;
      return (o.cliente_nome || '').toLowerCase().indexOf(termo) >= 0 ||
             String(o.numero).indexOf(termo) >= 0;
    });

    var aprovados = estado.lista.filter(function (o) { return o.status === 'aprovado'; });
    var somaAprov = aprovados.reduce(function (a, o) { return a + totalDe(o); }, 0);
    $('#lista-resumo').textContent = estado.lista.length === 0
      ? 'Nenhum orçamento ainda'
      : estado.lista.length + (estado.lista.length === 1 ? ' orçamento' : ' orçamentos') +
        (aprovados.length ? '  ·  ' + dinheiro(somaAprov) + ' aprovados' : '');

    if (!vis.length) {
      alvo.innerHTML = '<div class="vazio"><strong>' +
        (estado.lista.length ? 'Nada encontrado' : 'Comece pelo primeiro orçamento') + '</strong>' +
        (estado.lista.length ? 'Tente outro termo ou situação.' :
         'Clique em “Novo orçamento” para montar uma proposta e enviar em PDF.') + '</div>';
      return;
    }

    alvo.innerHTML = vis.map(function (o) {
      var qtdItens = (Array.isArray(o.itens) ? o.itens : []).length;
      var data = new Date(o.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return '<article class="item-lista" data-id="' + o.id + '" tabindex="0" role="button">' +
        '<span class="item-lista__num">' + String(o.numero).padStart(3, '0') + '</span>' +
        '<div class="item-lista__meio">' +
          '<div class="item-lista__cliente' + (o.cliente_nome ? '' : ' item-lista__cliente--vazio') + '">' +
            esc(o.cliente_nome || 'Sem cliente') + '</div>' +
          '<div class="item-lista__resumo">' + data + '  ·  ' +
            qtdItens + (qtdItens === 1 ? ' móvel' : ' móveis') + '</div>' +
        '</div>' +
        '<span class="marca-status marca-status--' + o.status + '">' + ROTULO[o.status] + '</span>' +
        '<span class="item-lista__valor">' + dinheiro(totalDe(o)) + '</span>' +
      '</article>';
    }).join('');

    $$('.item-lista').forEach(function (el) {
      function abrir() {
        var o = estado.lista.filter(function (x) { return x.id === el.dataset.id; })[0];
        if (o) abrirEditor(o);
      }
      el.addEventListener('click', abrir);
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
      });
    });
  }

  $('#busca').addEventListener('input', function (e) { estado.busca = e.target.value; pintarLista(); });
  $$('.pilulas button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('.pilulas button').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      estado.filtro = b.dataset.f;
      pintarLista();
    });
  });

  /* ---------------- editor ---------------- */
  function orcamentoNovo() {
    var p = CFG.padroes || {};
    return {
      id: null, numero: null, status: 'rascunho',
      cliente_nome: '', cliente_telefone: '', cliente_email: '', cliente_endereco: '',
      itens: [{ descricao: '', detalhes: '', qtd: 1, valor: 0 }],
      desconto: 0,
      prazo_entrega: p.prazo_entrega || '',
      forma_pagamento: p.forma_pagamento || '',
      observacoes: p.observacoes || '',
      validade_dias: p.validade_dias || 15,
      criado_em: new Date().toISOString()
    };
  }

  $('#btn-novo').addEventListener('click', function () { abrirEditor(orcamentoNovo()); });

  $('#btn-voltar').addEventListener('click', function () {
    if (estado.sujo && !confirm('Há alterações não salvas. Voltar mesmo assim?')) return;
    estado.sujo = false;
    abrirLista();
  });

  function abrirEditor(o) {
    estado.atual = JSON.parse(JSON.stringify(o));
    if (!Array.isArray(estado.atual.itens) || !estado.atual.itens.length) {
      estado.atual.itens = [{ descricao: '', detalhes: '', qtd: 1, valor: 0 }];
    }
    estado.sujo = false;

    var novo = !o.id;
    $('#editor-titulo').textContent = novo ? 'Novo orçamento' :
      'Orçamento ' + String(o.numero).padStart(3, '0');
    $('#editor-sub').textContent = novo ? 'Ainda não salvo' :
      'Criado em ' + new Date(o.criado_em).toLocaleDateString('pt-BR');
    $('#btn-excluir').hidden = novo;
    $('#btn-pdf').disabled = false;

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
    $('#estado-salvo').textContent = novo ? 'Ainda não salvo' : '';

    pintarItens();
    mostrarTela('#tela-editor');
  }

  function pintarItens() {
    var alvo = $('#itens');
    var itens = estado.atual.itens;
    $('#itens-vazio').hidden = itens.length > 0;

    alvo.innerHTML = itens.map(function (it, i) {
      var soma = (Number(it.qtd) || 0) * (Number(it.valor) || 0);
      return '<div class="item" data-i="' + i + '">' +
        '<div class="item__topo">' +
          '<label class="campo"><span class="campo__rot">Móvel</span>' +
          '<input type="text" data-c="descricao" value="' + esc(it.descricao) + '" placeholder="Cozinha planejada"></label>' +
          '<button class="remover" type="button" data-remover="' + i + '" title="Remover" aria-label="Remover móvel">✕</button>' +
        '</div>' +
        '<label class="campo"><span class="campo__rot">Detalhes <i>saem no PDF, abaixo do nome</i></span>' +
        '<textarea data-c="detalhes" rows="2" placeholder="MDF branco 18mm, puxador perfil, 3 gavetas com corrediça telescópica">' +
        esc(it.detalhes) + '</textarea></label>' +
        '<div class="item__linha">' +
          '<label class="campo"><span class="campo__rot">Qtd</span>' +
          '<input type="number" data-c="qtd" min="1" step="1" value="' + (Number(it.qtd) || 1) + '"></label>' +
          '<label class="campo"><span class="campo__rot">Valor unitário</span>' +
          '<div class="com-prefixo"><span>R$</span>' +
          '<input type="number" data-c="valor" min="0" step="0.01" value="' + (Number(it.valor) || 0) + '"></div></label>' +
          '<div class="item__soma">' + dinheiro(soma) + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    alvo.querySelectorAll('[data-c]').forEach(function (campo) {
      campo.addEventListener('input', function () {
        var i = +campo.closest('.item').dataset.i;
        var chave = campo.dataset.c;
        estado.atual.itens[i][chave] = (chave === 'qtd' || chave === 'valor')
          ? (parseFloat(campo.value) || 0) : campo.value;
        marcarSujo();
        if (chave === 'qtd' || chave === 'valor') {
          var soma = (Number(estado.atual.itens[i].qtd) || 0) * (Number(estado.atual.itens[i].valor) || 0);
          campo.closest('.item').querySelector('.item__soma').textContent = dinheiro(soma);
          recalcular();
        }
      });
    });

    alvo.querySelectorAll('[data-remover]').forEach(function (b) {
      b.addEventListener('click', function () {
        estado.atual.itens.splice(+b.dataset.remover, 1);
        marcarSujo(); pintarItens(); recalcular();
      });
    });

    recalcular();
  }

  $('#btn-add-item').addEventListener('click', function () {
    estado.atual.itens.push({ descricao: '', detalhes: '', qtd: 1, valor: 0 });
    marcarSujo();
    pintarItens();
    var campos = $$('#itens .item input[data-c="descricao"]');
    if (campos.length) campos[campos.length - 1].focus();
  });

  function recalcular() {
    var sub = estado.atual.itens.reduce(function (a, it) {
      return a + (Number(it.qtd) || 0) * (Number(it.valor) || 0);
    }, 0);
    var desc = Number($('#c-desconto').value) || 0;
    $('#t-subtotal').textContent = dinheiro(sub);
    $('#t-total').textContent = dinheiro(Math.max(0, sub - desc));
  }

  function marcarSujo() {
    estado.sujo = true;
    $('#estado-salvo').textContent = 'Alterações não salvas';
  }

  [['#c-nome','cliente_nome'], ['#c-telefone','cliente_telefone'], ['#c-email','cliente_email'],
   ['#c-endereco','cliente_endereco'], ['#c-prazo','prazo_entrega'], ['#c-pagamento','forma_pagamento'],
   ['#c-obs','observacoes']].forEach(function (par) {
    $(par[0]).addEventListener('input', function (e) {
      estado.atual[par[1]] = e.target.value; marcarSujo();
    });
  });

  $('#c-validade').addEventListener('input', function (e) {
    estado.atual.validade_dias = parseInt(e.target.value, 10) || 15; marcarSujo();
  });
  $('#c-desconto').addEventListener('input', function (e) {
    estado.atual.desconto = parseFloat(e.target.value) || 0; marcarSujo(); recalcular();
  });
  $('#sel-status').addEventListener('change', function (e) {
    estado.atual.status = e.target.value; marcarSujo();
  });

  /* ---------------- salvar ---------------- */
  function salvar() {
    var o = estado.atual;
    if (!o.cliente_nome.trim()) {
      avisar('Coloque o nome do cliente antes de salvar.', 'erro');
      $('#c-nome').focus();
      return Promise.reject(new Error('sem cliente'));
    }

    var dados = {
      user_id: estado.usuario.id,
      cliente_nome: o.cliente_nome, cliente_telefone: o.cliente_telefone,
      cliente_email: o.cliente_email, cliente_endereco: o.cliente_endereco,
      itens: o.itens.filter(function (it) { return (it.descricao || '').trim() || Number(it.valor); }),
      desconto: Number(o.desconto) || 0,
      prazo_entrega: o.prazo_entrega, forma_pagamento: o.forma_pagamento,
      observacoes: o.observacoes, validade_dias: Number(o.validade_dias) || 15,
      status: o.status
    };

    carregando(true);
    var q = o.id
      ? sb.from('orcamentos').update(dados).eq('id', o.id).select().single()
      : sb.from('orcamentos').insert(dados).select().single();

    return q.then(function (r) {
      carregando(false);
      if (r.error) throw r.error;
      estado.atual = r.data;
      estado.atual.itens = Array.isArray(r.data.itens) ? r.data.itens : [];
      if (!estado.atual.itens.length) estado.atual.itens = [{ descricao: '', detalhes: '', qtd: 1, valor: 0 }];
      estado.sujo = false;
      $('#editor-titulo').textContent = 'Orçamento ' + String(r.data.numero).padStart(3, '0');
      $('#editor-sub').textContent = 'Criado em ' + new Date(r.data.criado_em).toLocaleDateString('pt-BR');
      $('#btn-excluir').hidden = false;
      $('#estado-salvo').textContent = 'Salvo às ' +
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      avisar('Orçamento salvo');
      carregarListaSilencioso();
      return r.data;
    }).catch(function (e) {
      carregando(false);
      if (e && e.message !== 'sem cliente') avisar(textoErro(e), 'erro');
      throw e;
    });
  }

  function carregarListaSilencioso() {
    sb.from('orcamentos').select('*').order('criado_em', { ascending: false })
      .then(function (r) { if (!r.error) estado.lista = r.data || []; });
  }

  $('#btn-salvar').addEventListener('click', function () { salvar().catch(function () {}); });

  $('#btn-excluir').addEventListener('click', function () {
    if (!estado.atual.id) return;
    if (!confirm('Excluir este orçamento? Não dá para desfazer.')) return;
    carregando(true);
    sb.from('orcamentos').delete().eq('id', estado.atual.id).then(function (r) {
      carregando(false);
      if (r.error) { avisar(textoErro(r.error), 'erro'); return; }
      estado.sujo = false;
      avisar('Orçamento excluído');
      abrirLista();
    });
  });

  /* ---------------- PDF e WhatsApp ---------------- */
  function comOrcamentoSalvo() {
    if (estado.sujo || !estado.atual.id) return salvar();
    return Promise.resolve(estado.atual);
  }

  $('#btn-pdf').addEventListener('click', function () {
    comOrcamentoSalvo().then(function (o) {
      try {
        var r = window.gerarPDF(o);
        avisar('PDF gerado: ' + r.nome);
      } catch (e) { avisar(e.message, 'erro'); }
    }).catch(function () {});
  });

  $('#btn-zap').addEventListener('click', function () {
    comOrcamentoSalvo().then(function (o) {
      var tel = String(o.cliente_telefone || '').replace(/\D/g, '');
      if (!tel) { avisar('Coloque o WhatsApp do cliente para enviar.', 'erro'); $('#c-telefone').focus(); return; }
      if (tel.length <= 11) tel = '55' + tel;

      var r;
      try { r = window.gerarPDF(o); } catch (e) { avisar(e.message, 'erro'); return; }

      var emp = CFG.empresa || {};
      var msg = 'Olá' + (o.cliente_nome ? ', ' + o.cliente_nome.split(' ')[0] : '') + '! ' +
        'Segue o orçamento nº ' + String(o.numero).padStart(3, '0') +
        ' da ' + (emp.nome || 'marcenaria') + '.\n\n' +
        'Valor total: ' + dinheiro(r.total) + '\n' +
        (o.prazo_entrega ? 'Prazo: ' + o.prazo_entrega + '\n' : '') +
        (o.forma_pagamento ? 'Pagamento: ' + o.forma_pagamento + '\n' : '') +
        '\nO PDF com todos os detalhes está anexado. Qualquer dúvida é só chamar!';

      window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      avisar('PDF baixado — anexe na conversa que abriu');
    }).catch(function () {});
  });

  /* ---------------- atalhos e proteção ---------------- */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (!$('#tela-editor').hidden) salvar().catch(function () {});
    }
  });

  window.addEventListener('beforeunload', function (e) {
    if (estado.sujo) { e.preventDefault(); e.returnValue = ''; }
  });

  iniciar();
})();
