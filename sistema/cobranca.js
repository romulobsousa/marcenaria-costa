/* =====================================================================
   Cobrança de resposta — orçamentos enviados que ficaram parados.

   A régua: 3 dias depois do envio vale um toque leve; passando de uma
   semana, o lembrete carrega valor e validade; passando da validade,
   é uma última chamada que abre espaço para renegociar em vez de
   insistir no mesmo preço.
   ===================================================================== */

(function () {
  'use strict';
  var App = window.App;
  var $ = App.$, $$ = App.$$, esc = App.esc, dinheiro = App.dinheiro;

  var DIA = 86400000;
  var ESPERA_INICIAL = 3;   // dias após o envio até o primeiro toque
  var ESPERA_ENTRE   = 5;   // dias entre uma cobrança e a próxima

  function diasDesde(iso) {
    if (!iso) return null;
    return Math.floor((Date.now() - new Date(iso)) / DIA);
  }

  /* ---------------- quem precisa de empurrão ---------------- */
  App.filaCobranca = function () {
    return App.orcamentos.filter(function (o) {
      if (o.status !== 'enviado') return false;

      var base = o.ultimo_contato || o.enviado_em || o.atualizado_em || o.criado_em;
      var parado = diasDesde(base);
      if (parado === null) return false;

      // ainda cedo para o primeiro toque
      if (!o.ultimo_contato) return parado >= ESPERA_INICIAL;
      // já cobrou: respeita o intervalo
      return parado >= ESPERA_ENTRE;
    }).sort(function (a, b) {
      var da = diasDesde(a.enviado_em || a.criado_em);
      var db = diasDesde(b.enviado_em || b.criado_em);
      return db - da;   // os mais esquecidos primeiro
    });
  };

  /* ---------------- o texto certo para cada momento ---------------- */
  function estagio(o) {
    var desdeEnvio = diasDesde(o.enviado_em || o.criado_em) || 0;
    var validade = o.validade_dias || 15;
    if (desdeEnvio >= validade) return 'vencido';
    if (desdeEnvio >= 7) return 'reforco';
    return 'leve';
  }

  var ROTULO_ESTAGIO = {
    leve:    { txt: 'primeiro toque', cor: 'rascunho' },
    reforco: { txt: 'insistir',       cor: 'enviado'  },
    vencido: { txt: 'validade vencida', cor: 'recusado' }
  };

  App.mensagemCobranca = function (o) {
    var emp = App.cfg.empresa || {};
    var primeiro = o.cliente_nome ? o.cliente_nome.split(' ')[0] : '';
    var ola = 'Oi' + (primeiro ? ', ' + primeiro : '') + '! ';
    var num = String(o.numero).padStart(3, '0');
    var total = dinheiro(App.totalOrcamento(o));

    switch (estagio(o)) {
      case 'leve':
        return ola + 'Tudo bem? Passando para saber se você conseguiu ver o orçamento nº ' + num +
          ' que te mandei.\n\nQualquer dúvida sobre os móveis, materiais ou prazo, é só me chamar — ' +
          'posso ajustar o que precisar.';

      case 'reforco':
        return ola + 'Tudo certo? Fiquei na dúvida se o orçamento nº ' + num + ' chegou direitinho.\n\n' +
          'Ficou em ' + total + (o.prazo_entrega ? ', com prazo de ' + o.prazo_entrega : '') + '.\n\n' +
          'Se algum ponto não fechou pra você — valor, prazo ou algum móvel — me fala que a gente vê junto. ' +
          'Prefiro ajustar do que deixar você sem resposta.';

      default:
        return ola + 'Tudo bem? O orçamento nº ' + num + ' que te enviei venceu o prazo de validade, ' +
          'então os valores podem ter mudado um pouco.\n\n' +
          'Se o projeto ainda estiver de pé, me avisa que eu atualizo pra você sem compromisso. ' +
          'E se não for o momento, sem problema nenhum — fico à disposição quando fizer sentido.';
    }
  };

  /* ---------------- registrar que cobrou ---------------- */
  function registrarContato(o) {
    return App.sb.from('orcamentos')
      .update({ ultimo_contato: new Date().toISOString(), contatos: (o.contatos || 0) + 1 })
      .eq('id', o.id).select().single()
      .then(function (r) {
        if (r.error) throw r.error;
        return App.recarregar(true);
      })
      .catch(function (e) {
        // o WhatsApp já abriu; se o registro falhar, avisa mas não atrapalha
        App.avisar('Cobrança enviada, mas não consegui registrar (' + App.textoErro(e) + ')', 'erro');
      });
  }

  App.cobrar = function (o) {
    var tel = String(o.cliente_telefone || '').replace(/\D/g, '');
    if (!tel) { App.avisar('Este orçamento não tem WhatsApp do cliente.', 'erro'); return; }
    if (tel.length <= 11) tel = '55' + tel;

    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(App.mensagemCobranca(o)),
                '_blank', 'noopener');
    registrarContato(o);
  };

  App.desistirDe = function (o) {
    if (!confirm('Marcar o orçamento ' + String(o.numero).padStart(3, '0') +
                 ' como recusado? Ele sai desta fila.')) return;
    App.sb.from('orcamentos').update({ status: 'recusado' }).eq('id', o.id)
      .then(function (r) {
        if (r.error) { App.avisar(App.textoErro(r.error), 'erro'); return; }
        App.avisar('Marcado como recusado');
        App.recarregar(true);
      });
  };

  /* ---------------- a fila na tela ---------------- */
  App.pintarCobranca = function () {
    var fila = App.filaCobranca();
    var caixa = $('#empurrao');
    var alvo = $('#empurrao-lista');
    if (!caixa || !alvo) return;

    caixa.hidden = fila.length === 0;
    if (!fila.length) return;

    $('#empurrao-conta').textContent = fila.length === 1
      ? '1 orçamento esperando' : fila.length + ' orçamentos esperando';

    alvo.innerHTML = fila.slice(0, 6).map(function (o) {
      var dias = diasDesde(o.enviado_em || o.criado_em) || 0;
      var est = ROTULO_ESTAGIO[estagio(o)];
      var jaCobrou = (o.contatos || 0) > 0;

      return '<div class="empurrao__item" data-cobranca="' + o.id + '">' +
        '<div class="empurrao__meio">' +
          '<div class="empurrao__cliente">' + esc(o.cliente_nome || 'Sem cliente') +
            ' <span class="empurrao__num">nº ' + String(o.numero).padStart(3, '0') + '</span></div>' +
          '<div class="empurrao__linha">' +
            'enviado há ' + dias + (dias === 1 ? ' dia' : ' dias') +
            (jaCobrou ? ' · já cobrado ' + o.contatos + (o.contatos === 1 ? ' vez' : ' vezes') : '') +
            ' · <span class="marca-status marca-status--' + est.cor + '">' + est.txt + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="empurrao__dir">' +
          '<span class="empurrao__valor">' + dinheiro(App.totalOrcamento(o)) + '</span>' +
          '<div class="empurrao__botoes">' +
            '<button class="btn btn--pequeno" type="button" data-ver="' + o.id + '">Ver</button>' +
            '<button class="btn btn--pequeno btn--desistir" type="button" data-desistir="' + o.id + '">Desistir</button>' +
            '<button class="btn btn--zap btn--pequeno" type="button" data-cobrar="' + o.id + '">Cobrar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('') +
    (fila.length > 6 ? '<p class="empurrao__resto">e mais ' + (fila.length - 6) + ' na aba Orçamentos</p>' : '');

    function achar(id) { return App.orcamentos.filter(function (x) { return x.id === id; })[0]; }

    $$('[data-cobrar]', alvo).forEach(function (b) {
      b.addEventListener('click', function () { var o = achar(b.dataset.cobrar); if (o) App.cobrar(o); });
    });
    $$('[data-desistir]', alvo).forEach(function (b) {
      b.addEventListener('click', function () { var o = achar(b.dataset.desistir); if (o) App.desistirDe(o); });
    });
    $$('[data-ver]', alvo).forEach(function (b) {
      b.addEventListener('click', function () {
        var o = achar(b.dataset.ver);
        if (o) { App.ir('orcamentos'); setTimeout(function () { App.abrirOrcamento(o); }, 40); }
      });
    });
  };

  App.aoCarregarDados.push(App.pintarCobranca);
})();
