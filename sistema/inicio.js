/* =====================================================================
   Tela "Hoje" — o resumo do dia. Última a carregar, pois usa
   funções que orcamentos.js e agenda.js registram em App.
   ===================================================================== */

(function () {
  'use strict';
  var App = window.App;
  var $ = App.$, esc = App.esc, dinheiro = App.dinheiro;

  function saudacao() {
    var h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  function pintarCabeca() {
    $('#saudacao').textContent = saudacao();
    var d = new Date();
    var s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    $('#hoje-data').textContent = s.charAt(0).toUpperCase() + s.slice(1);
  }

  function pintarNumeros() {
    var hoje = App.hoje();

    var visitasHoje = App.visitas.filter(function (v) {
      return v.data === hoje && v.status !== 'cancelada';
    }).length;

    var aguardando = App.orcamentos.filter(function (o) { return o.status === 'enviado'; });
    var valorAguardando = aguardando.reduce(function (a, o) { return a + App.totalOrcamento(o); }, 0);

    var mes = hoje.slice(0, 7);
    var aprovadosMes = App.orcamentos.filter(function (o) {
      return o.status === 'aprovado' && String(o.criado_em).slice(0, 7) === mes;
    });
    var valorMes = aprovadosMes.reduce(function (a, o) { return a + App.totalOrcamento(o); }, 0);

    var rascunhos = App.orcamentos.filter(function (o) { return o.status === 'rascunho'; }).length;

    var cartoes = [
      { r: 'Visitas hoje', v: String(visitasHoje), n: visitasHoje ? 'na sua agenda' : 'dia livre' },
      { r: 'Esperando resposta', v: String(aguardando.length),
        n: aguardando.length ? dinheiro(valorAguardando) + ' em jogo' : 'nenhum enviado' },
      { r: 'Aprovado no mês', v: dinheiro(valorMes), n: aprovadosMes.length +
        (aprovadosMes.length === 1 ? ' orçamento fechado' : ' orçamentos fechados'), destaque: valorMes > 0 },
      { r: 'Rascunhos', v: String(rascunhos), n: rascunhos ? 'ainda não enviados' : 'nada parado' }
    ];

    $('#hoje-numeros').innerHTML = cartoes.map(function (c) {
      return '<div class="num">' +
        '<p class="num__rot">' + esc(c.r) + '</p>' +
        '<div class="num__val' + (c.destaque ? ' num__val--destaque' : '') + '">' + esc(c.v) + '</div>' +
        '<div class="num__nota">' + esc(c.n) + '</div></div>';
    }).join('');
  }

  function pintarVisitas() {
    var hoje = App.hoje();
    var amanha = App.paraISO(App.somaDias(new Date(), 1));
    var lista = App.visitas.filter(function (v) {
      return (v.data === hoje || v.data === amanha) && v.status !== 'cancelada';
    });

    var alvo = $('#hoje-visitas');
    if (!lista.length) {
      alvo.innerHTML = '<p class="dica-vazia">Nada marcado para hoje nem amanhã.<br>' +
        '<button class="btn btn--pequeno" type="button" data-ir="agenda-nova" style="margin-top:10px">Marcar visita</button></p>';
      return;
    }
    alvo.innerHTML = lista.map(function (v) { return App.cartaoVisita(v, true); }).join('');
    App.ligarVisitas(alvo);
  }

  function pintarOrcamentos() {
    var enviados = App.orcamentos.filter(function (o) { return o.status === 'enviado'; });
    var alvo = $('#hoje-orcamentos');

    if (!enviados.length) {
      alvo.innerHTML = '<p class="dica-vazia">Nenhum orçamento aguardando resposta.</p>';
      return;
    }

    alvo.innerHTML = enviados.slice(0, 5).map(function (o) {
      var dias = Math.floor((Date.now() - new Date(o.criado_em)) / 86400000);
      var idade = dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : 'há ' + dias + ' dias';
      var frio = dias >= (o.validade_dias || 15);
      return '<button class="item-lista" type="button" data-orc="' + o.id + '">' +
        '<span class="item-lista__num">' + String(o.numero).padStart(3, '0') + '</span>' +
        '<div class="item-lista__meio">' +
          '<div class="item-lista__cliente">' + esc(o.cliente_nome || 'Sem cliente') + '</div>' +
          '<div class="item-lista__resumo">enviado ' + idade +
            (frio ? ' · <span style="color:var(--grave)">validade vencida</span>' : '') + '</div>' +
        '</div>' +
        '<span class="item-lista__valor">' + dinheiro(App.totalOrcamento(o)) + '</span>' +
      '</button>';
    }).join('');

    App.$$('[data-orc]', alvo).forEach(function (el) {
      el.addEventListener('click', function () {
        var o = App.orcamentos.filter(function (x) { return x.id === el.dataset.orc; })[0];
        if (o) { App.ir('orcamentos'); setTimeout(function () { App.abrirOrcamento(o); }, 40); }
      });
    });
  }

  function pintarHoje() {
    pintarCabeca();
    pintarNumeros();
    pintarVisitas();
    pintarOrcamentos();
  }

  App.aoCarregarDados.push(pintarHoje);

  /* arranca o sistema depois que todas as áreas se registraram */
  App.iniciar();
})();
