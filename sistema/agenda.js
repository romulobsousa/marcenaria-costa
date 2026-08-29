/* =====================================================================
   Área de agenda — usa o núcleo (App)
   ===================================================================== */

(function () {
  'use strict';
  var App = window.App;
  var $ = App.$, $$ = App.$$, esc = App.esc;
  var CFG = App.cfg;

  var atual = null;
  var inicioSemana = App.segundaDe(new Date());

  var TIPOS = {
    medicao: 'Medição', apresentacao: 'Apresentação', montagem: 'Montagem',
    entrega: 'Entrega', assistencia: 'Assistência'
  };

  function nomeDia(d) {
    var s = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function diaMes(d) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); }
  function ehHoje(d) { return App.paraISO(d) === App.hoje(); }

  function comoQuando(iso, hora) {
    var hoje = App.hoje();
    var amanha = App.paraISO(App.somaDias(new Date(), 1));
    if (iso === hoje) return 'Hoje, ' + App.hhmm(hora);
    if (iso === amanha) return 'Amanhã, ' + App.hhmm(hora);
    return App.doISO(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
             .replace('.', '') + ', ' + App.hhmm(hora);
  }

  /* ---------------- render ---------------- */
  App.cartaoVisita = function (v, comData) {
    var quando = comData ? comoQuando(v.data, v.hora) : App.hhmm(v.hora);
    var partes = ['<span class="visita__tipo">' + TIPOS[v.tipo] + '</span>'];
    if (v.endereco) partes.push(esc(v.endereco));
    if (v.status === 'confirmada') partes.push('confirmada');

    return '<button class="visita visita--' + v.tipo +
      (v.status === 'cancelada' ? ' visita--cancelada' : '') +
      (v.status === 'realizada' ? ' visita--realizada' : '') +
      '" type="button" data-visita="' + v.id + '">' +
      '<span class="visita__hora">' + esc(quando.split(', ').pop()) + '</span>' +
      '<span class="visita__meio">' +
        '<span class="visita__cliente' + (v.cliente_nome ? '' : ' visita__cliente--vazio') + '">' +
          esc(v.cliente_nome || 'Sem nome') + '</span>' +
        '<span class="visita__linha">' + partes.join(' · ') + '</span>' +
      '</span>' +
      (comData ? '<span class="visita__dir"><span class="marca-status marca-status--' +
                 (v.status === 'confirmada' ? 'aprovado' : 'rascunho') + '">' +
                 esc(quando.split(',')[0]) + '</span></span>' : '') +
    '</button>';
  };

  App.ligarVisitas = function (raiz) {
    $$('[data-visita]', raiz).forEach(function (el) {
      el.addEventListener('click', function () {
        var v = App.visitas.filter(function (x) { return x.id === el.dataset.visita; })[0];
        if (v) abrirPainel(v);
      });
    });
  };

  function pintarResumo() {
    var hoje = App.hoje();
    var doDia = App.visitas.filter(function (v) { return v.data === hoje && v.status !== 'cancelada'; });
    var futuras = App.visitas.filter(function (v) {
      return v.data >= hoje && v.status !== 'cancelada' && v.status !== 'realizada';
    });
    $('#agenda-resumo').textContent = doDia.length
      ? doDia.length + (doDia.length === 1 ? ' visita hoje' : ' visitas hoje') +
        (futuras.length > doDia.length ? '  ·  ' + futuras.length + ' pela frente' : '')
      : (futuras.length ? futuras.length + (futuras.length === 1 ? ' visita marcada' : ' visitas marcadas')
                        : 'Nenhuma visita marcada');
  }

  App.proximasVisitas = function (quantas) {
    var agora = new Date();
    var hoje = App.hoje();
    var hora = String(agora.getHours()).padStart(2, '0') + ':' + String(agora.getMinutes()).padStart(2, '0');
    return App.visitas.filter(function (v) {
      if (v.status === 'cancelada' || v.status === 'realizada') return false;
      if (v.data > hoje) return true;
      return v.data === hoje && App.hhmm(v.hora) >= hora;
    }).slice(0, quantas || 3);
  };

  function pintarProximas() {
    var lista = App.proximasVisitas(3);
    $('#proximas').hidden = lista.length === 0;
    if (!lista.length) return;
    $('#proximas-lista').innerHTML = lista.map(function (v) { return App.cartaoVisita(v, true); }).join('');
    App.ligarVisitas($('#proximas-lista'));
  }

  function pintarSemana() {
    var fim = App.somaDias(inicioSemana, 6);
    $('#semana-rotulo').textContent = diaMes(inicioSemana) + ' — ' + diaMes(fim);

    var html = '';
    for (var i = 0; i < 7; i++) {
      var d = App.somaDias(inicioSemana, i);
      var iso = App.paraISO(d);
      var doDia = App.visitas.filter(function (v) { return v.data === iso; });
      html += '<div class="dia' + (ehHoje(d) ? ' dia--hoje' : '') + '">' +
        '<div class="dia__cabeca">' +
          '<span class="dia__num">' + String(d.getDate()).padStart(2, '0') + '</span>' +
          '<span class="dia__nome">' + nomeDia(d) + (ehHoje(d) ? ' · hoje' : '') + '</span>' +
        '</div>' +
        (doDia.length ? doDia.map(function (v) { return App.cartaoVisita(v, false); }).join('')
                      : '<p class="dia__vazio">Livre</p>') +
      '</div>';
    }
    $('#dias').innerHTML = html;
    App.ligarVisitas($('#dias'));
  }

  function pintarAgenda() { pintarProximas(); pintarSemana(); pintarResumo(); }

  /* ---------------- navegação da semana ---------------- */
  $('#btn-semana-ant').addEventListener('click', function () {
    inicioSemana = App.somaDias(inicioSemana, -7); pintarAgenda();
  });
  $('#btn-semana-prox').addEventListener('click', function () {
    inicioSemana = App.somaDias(inicioSemana, 7); pintarAgenda();
  });
  $('#btn-hoje-semana').addEventListener('click', function () {
    inicioSemana = App.segundaDe(new Date()); pintarAgenda();
  });

  /* ---------------- painel ---------------- */
  function visitaNova() {
    return {
      id: null, cliente_nome: '', cliente_telefone: '', endereco: '',
      data: App.paraISO(App.somaDias(new Date(), 1)), hora: '09:00', duracao_min: 60,
      tipo: 'medicao', status: 'agendada', observacoes: ''
    };
  }

  function abrirPainel(v) {
    atual = JSON.parse(JSON.stringify(v));
    var ehNova = !v.id;

    $('#painel-titulo').textContent = ehNova ? 'Nova visita' : 'Visita de ' + (v.cliente_nome || 'cliente');
    $('#btn-excluir-visita').hidden = ehNova || !App.podeApagar();
    $('#btn-orc-da-visita').hidden = ehNova || !App.podeOrcar();

    $('#v-nome').value = v.cliente_nome || '';
    $('#v-telefone').value = v.cliente_telefone || '';
    $('#v-endereco').value = v.endereco || '';
    $('#v-data').value = v.data;
    $('#v-hora').value = App.hhmm(v.hora);
    $('#v-duracao').value = String(v.duracao_min || 60);
    $('#v-tipo').value = v.tipo || 'medicao';
    $('#v-status').value = v.status || 'agendada';
    $('#v-obs').value = v.observacoes || '';

    conferirConflito();
    $('#painel').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#v-nome').focus(); }, 60);
  }

  function fecharPainel() {
    $('#painel').hidden = true;
    document.body.style.overflow = '';
    atual = null;
  }

  $$('[data-fechar]').forEach(function (el) { el.addEventListener('click', fecharPainel); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#painel').hidden) fecharPainel();
  });
  $('#btn-nova').addEventListener('click', function () { abrirPainel(visitaNova()); });

  function conferirConflito() {
    var data = $('#v-data').value, hora = $('#v-hora').value;
    var dur = parseInt($('#v-duracao').value, 10) || 60;
    var el = $('#conflito');
    if (!data || !hora) { el.hidden = true; return; }

    function min(h) { var p = h.split(':'); return (+p[0]) * 60 + (+p[1]); }
    var ini = min(hora), fim = ini + dur;

    var choques = App.visitas.filter(function (v) {
      if (atual && v.id === atual.id) return false;
      if (v.data !== data || v.status === 'cancelada') return false;
      var vi = min(App.hhmm(v.hora)), vf = vi + (v.duracao_min || 60);
      return ini < vf && vi < fim;
    });

    if (!choques.length) { el.hidden = true; return; }
    el.innerHTML = 'Você já tem <b>' + esc(choques[0].cliente_nome || 'uma visita') + '</b> às ' +
                   App.hhmm(choques[0].hora) + ' neste dia. Dá para salvar assim mesmo — é só um aviso.';
    el.hidden = false;
  }
  ['#v-data', '#v-hora', '#v-duracao'].forEach(function (s) {
    $(s).addEventListener('change', conferirConflito);
  });

  /* ---------------- salvar ---------------- */
  function coletar() {
    return {
      user_id: App.usuario.id,
      cliente_nome: $('#v-nome').value.trim(),
      cliente_telefone: $('#v-telefone').value.trim(),
      endereco: $('#v-endereco').value.trim(),
      data: $('#v-data').value,
      hora: $('#v-hora').value,
      duracao_min: parseInt($('#v-duracao').value, 10) || 60,
      tipo: $('#v-tipo').value,
      status: $('#v-status').value,
      observacoes: $('#v-obs').value
    };
  }

  function salvar() {
    var d = coletar();
    if (!d.cliente_nome) { App.avisar('Coloque o nome do cliente.', 'erro'); $('#v-nome').focus(); return Promise.reject(); }
    if (!d.data || !d.hora) { App.avisar('Escolha data e hora.', 'erro'); return Promise.reject(); }

    App.carregando(true);
    var q = atual.id
      ? App.sb.from('visitas').update(d).eq('id', atual.id).select().single()
      : App.sb.from('visitas').insert(d).select().single();

    return q.then(function (r) {
      App.carregando(false);
      if (r.error) throw r.error;
      App.avisar(atual.id ? 'Visita atualizada' : 'Visita marcada');
      inicioSemana = App.segundaDe(App.doISO(r.data.data));
      fecharPainel();
      return App.recarregar(true).then(function () { return r.data; });
    }).catch(function (e) {
      App.carregando(false);
      if (e) App.avisar(App.textoErro(e), 'erro');
      throw e;
    });
  }

  $('#btn-salvar-visita').addEventListener('click', function () { salvar().catch(function () {}); });

  $('#btn-excluir-visita').addEventListener('click', function () {
    if (!atual || !atual.id) return;
    if (!confirm('Excluir esta visita?')) return;
    App.carregando(true);
    App.sb.from('visitas').delete().eq('id', atual.id).then(function (r) {
      App.carregando(false);
      if (r.error) { App.avisar(App.textoErro(r.error), 'erro'); return; }
      App.avisar('Visita excluída');
      fecharPainel();
      App.recarregar(true);
    });
  });

  /* ---------------- da visita para o orçamento ---------------- */
  $('#btn-orc-da-visita').addEventListener('click', function () {
    var d = coletar();
    fecharPainel();
    App.ir('orcamentos');
    setTimeout(function () {
      App.novoOrcamentoCom({
        cliente_nome: d.cliente_nome,
        cliente_telefone: d.cliente_telefone,
        cliente_endereco: d.endereco
      });
      App.avisar('Orçamento iniciado com os dados da visita');
    }, 50);
  });

  /* ---------------- confirmar no WhatsApp ---------------- */
  $('#btn-zap-visita').addEventListener('click', function () {
    var d = coletar();
    var tel = d.cliente_telefone.replace(/\D/g, '');
    if (!tel) { App.avisar('Coloque o WhatsApp do cliente.', 'erro'); $('#v-telefone').focus(); return; }
    if (tel.length <= 11) tel = '55' + tel;

    var emp = CFG.empresa || {};
    var dia = App.doISO(d.data).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    var primeiro = d.cliente_nome ? d.cliente_nome.split(' ')[0] : '';

    var msg = 'Olá' + (primeiro ? ', ' + primeiro : '') + '! Aqui é da ' + (emp.nome || 'marcenaria') + '.\n\n' +
      'Confirmando nossa ' + TIPOS[d.tipo].toLowerCase() + ':\n' +
      '📅 ' + dia + '\n' + '🕐 ' + App.hhmm(d.hora) + '\n' +
      (d.endereco ? '📍 ' + d.endereco + '\n' : '') +
      '\nFica bom pra você? Se precisar remarcar, é só me avisar.';

    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  App.aoCarregarDados.push(pintarAgenda);
})();
