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

  /* O que conta como faturamento: orçamento aprovado, pelo valor que o
     cliente paga. A data que vale é a do fechamento (aprovado_em), não a
     da criação — senão um orçamento feito em janeiro e fechado em março
     entraria no mês errado. Nos antigos, antes da coluna existir, sobra
     a data de criação como aproximação. */
  function mesDe(o) {
    return String(o.aprovado_em || o.criado_em).slice(0, 7);
  }

  function mesVizinho(passo) {
    var d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + passo);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  }

  function nomeDoMes(chave) {
    var p = chave.split('-');
    return new Date(+p[0], +p[1] - 1, 1)
      .toLocaleDateString('pt-BR', { month: 'long' });
  }

  function aprovados(mes) {
    return App.orcamentos.filter(function (o) {
      return o.status === 'aprovado' && (!mes || mesDe(o) === mes);
    });
  }

  function somar(lista) {
    return lista.reduce(function (a, o) { return a + App.totalOrcamento(o); }, 0);
  }

  function pintarFaturamento() {
    var esteMes  = mesVizinho(0);
    var passado  = mesVizinho(-1);

    var doMes    = aprovados(esteMes);
    var doPasado = aprovados(passado);
    var geral    = aprovados(null);

    var vMes = somar(doMes), vPas = somar(doPasado), vGeral = somar(geral);

    var celulas = [
      { r: 'Este mês', v: dinheiro(vMes), n: quantos(doMes.length), destaque: true },
      { r: nomeDoMes(passado).replace(/^./, function (c) { return c.toUpperCase(); }),
        v: dinheiro(vPas), n: quantos(doPasado.length) },
      { r: 'Desde o começo', v: dinheiro(vGeral), n: quantos(geral.length) }
    ];

    $('#faturamento-grade').innerHTML = celulas.map(function (c) {
      return '<div class="fat">' +
        '<p class="fat__rot">' + esc(c.r) + '</p>' +
        '<div class="fat__val' + (c.destaque ? ' fat__val--destaque' : '') + '">' + esc(c.v) + '</div>' +
        '<div class="fat__nota">' + esc(c.n) + '</div></div>';
    }).join('');

    // a comparação só diz alguma coisa se houve mês passado
    var nota = '';
    if (vPas > 0) {
      var dif = Math.round((vMes - vPas) / vPas * 100);
      nota = dif === 0 ? 'igual ao mês passado'
           : dif > 0   ? '+' + dif + '% que o mês passado'
                       : dif + '% que o mês passado';
    } else if (vMes > 0) {
      nota = 'primeiro mês com fechamento';
    }
    $('#faturamento-nota').textContent = nota;
  }

  function quantos(n) {
    return n === 0 ? 'nada fechado'
         : n === 1 ? '1 orçamento fechado'
                   : n + ' orçamentos fechados';
  }

  /* ---------------- prazo de entrega ---------------- */
  /* Três estados, e só três: dentro do prazo, esgotando (a última
     semana) e estourado. Mais faixas do que isso viram enfeite. */
  var AVISO_DIAS = 7;

  App.estadoPrazo = function (o) {
    if (o.status !== 'aprovado' || o.entregue_em || !o.entrega_em) return null;
    var faltam = App.diasAte(o.entrega_em);
    return {
      faltam: faltam,
      cor: faltam < 0 ? 'estourou' : faltam <= AVISO_DIAS ? 'esgotando' : 'noprazo',
      texto: faltam < 0
        ? 'atrasado ' + (-faltam) + (faltam === -1 ? ' dia' : ' dias')
        : faltam === 0 ? 'entrega hoje'
        : faltam === 1 ? 'falta 1 dia'
        : 'faltam ' + faltam + ' dias'
    };
  };

  /* selo pequeno, usado também na lista de orçamentos */
  App.seloPrazo = function (o, comPonto) {
    var p = App.estadoPrazo(o);
    if (!p) return '';
    return (comPonto ? '  ·  ' : '') +
      '<span class="prazo prazo--' + p.cor + '">' + esc(p.texto) + '</span>';
  };

  function pintarEntregas() {
    var lista = App.orcamentos.filter(function (o) { return !!App.estadoPrazo(o); })
      .sort(function (a, b) { return String(a.entrega_em).localeCompare(String(b.entrega_em)); });

    // aprovados sem data combinada: aparecem no fim, pedindo a data
    var semData = App.orcamentos.filter(function (o) {
      return o.status === 'aprovado' && !o.entregue_em && !o.entrega_em;
    });

    var caixa = $('#entregas');
    var alvo = $('#entregas-lista');
    if (!caixa || !alvo) return;

    caixa.hidden = !lista.length && !semData.length;
    if (caixa.hidden) { alvo.innerHTML = ''; return; }

    var apertados = lista.filter(function (o) { return App.estadoPrazo(o).cor !== 'noprazo'; }).length;
    $('#entregas-conta').textContent = apertados
      ? apertados + (apertados === 1 ? ' pedindo atenção' : ' pedindo atenção')
      : lista.length + (lista.length === 1 ? ' serviço em produção' : ' serviços em produção');

    alvo.innerHTML = lista.map(function (o) {
      var p = App.estadoPrazo(o);
      var quando = App.doISO(String(o.entrega_em).slice(0, 10))
        .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return '<button class="entrega" type="button" data-orc="' + o.id + '" data-cor="' + p.cor + '">' +
        '<span class="entrega__num">' + String(o.numero).padStart(3, '0') + '</span>' +
        '<div class="entrega__meio">' +
          '<div class="entrega__cliente">' + esc(o.cliente_nome || 'Sem cliente') + '</div>' +
          '<div class="entrega__linha">até ' + quando +
            '<span class="prazo prazo--' + p.cor + '">' + esc(p.texto) + '</span></div>' +
        '</div>' +
        '<span class="entrega__valor">' + dinheiro(App.totalOrcamento(o)) + '</span>' +
        '<span class="entrega__feito" data-feito="' + o.id + '">Entreguei</span>' +
      '</button>';
    }).join('') +
    (semData.length
      ? '<p class="entregas__semdata">' + semData.length +
        (semData.length === 1 ? ' serviço aprovado está' : ' serviços aprovados estão') +
        ' sem data de entrega combinada. ' +
        semData.map(function (o) {
          return '<button type="button" data-orc="' + o.id + '">nº ' +
                 String(o.numero).padStart(3, '0') + '</button>';
        }).join(' ') + '</p>'
      : '');

    App.$$('[data-orc]', alvo).forEach(function (el) {
      el.addEventListener('click', function (ev) {
        if (ev.target.closest('[data-feito]')) return;    // esse tem dono
        var o = App.orcamentos.filter(function (x) { return x.id === el.dataset.orc; })[0];
        if (o) { App.ir('orcamentos'); setTimeout(function () { App.abrirOrcamento(o); }, 40); }
      });
    });

    App.$$('[data-feito]', alvo).forEach(function (el) {
      el.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var o = App.orcamentos.filter(function (x) { return x.id === el.dataset.feito; })[0];
        if (!o) return;
        if (!confirm('Marcar o orçamento ' + String(o.numero).padStart(3, '0') +
                     ' como entregue?\n\nEle sai desta lista, mas continua aprovado e ' +
                     'contando no faturamento.')) return;

        App.carregando(true);
        App.sb.from('orcamentos').update({ entregue_em: App.hoje() }).eq('id', o.id)
          .then(function (r) {
            App.carregando(false);
            if (r.error) throw r.error;
            App.avisar('Marcado como entregue');
            App.registrar('orcamento_entregue', 'Orçamento ' + String(o.numero).padStart(3, '0') +
              (o.cliente_nome ? ' · ' + o.cliente_nome : ''), '', o.id);
            App.recarregar(true);
          })
          .catch(function (e) {
            App.carregando(false);
            var m = (e && e.message) || '';
            App.avisar(/entregue_em/.test(m)
              ? 'Falta rodar o banco-entrega.sql no Supabase.' : App.textoErro(e), 'erro');
          });
      });
    });
  }

  /* ---------------- limpar a tela ---------------- */
  /* Vencido: enviado, passou da validade e ninguém respondeu. Arquivar
     tira da tela inicial — o orçamento continua inteiro na lista. */
  function vencidos() {
    return App.orcamentos.filter(function (o) {
      if (o.status !== 'enviado' || o.arquivado_em) return false;
      var base = o.enviado_em || o.criado_em;
      var dias = Math.floor((Date.now() - new Date(base)) / 86400000);
      return dias >= (o.validade_dias || 15);
    });
  }

  function pintarLimpar() {
    var lista = vencidos();
    var bt = $('#btn-limpar');
    bt.hidden = !lista.length;
    bt.textContent = 'Limpar a tela (' + lista.length + ')';
  }

  $('#btn-limpar').addEventListener('click', function () {
    var lista = vencidos();
    if (!lista.length) return;

    if (!confirm('Tirar ' + lista.length +
        (lista.length === 1 ? ' orçamento vencido' : ' orçamentos vencidos') +
        ' desta tela?\n\nEles NÃO são apagados: continuam na lista de orçamentos, ' +
        'inteiros. Só param de aparecer aqui.')) return;

    App.carregando(true);
    App.sb.from('orcamentos')
      .update({ arquivado_em: new Date().toISOString() })
      .in('id', lista.map(function (o) { return o.id; }))
      .then(function (r) {
        App.carregando(false);
        if (r.error) throw r.error;
        App.avisar(lista.length + (lista.length === 1 ? ' orçamento saiu' : ' orçamentos saíram') + ' da tela');
        App.registrar('orcamento_arquivado', lista.length +
          (lista.length === 1 ? ' vencido' : ' vencidos'), 'limpeza da tela inicial');
        App.recarregar(true);
      })
      .catch(function (e) {
        App.carregando(false);
        var m = (e && e.message) || '';
        if (/arquivado_em/.test(m)) {
          App.avisar('Falta rodar o banco-faturamento.sql no Supabase.', 'erro');
        } else {
          App.avisar(App.textoErro(e), 'erro');
        }
      });
  });

  function pintarNumeros() {
    var hoje = App.hoje();

    var visitasHoje = App.visitas.filter(function (v) {
      return v.data === hoje && v.status !== 'cancelada';
    }).length;

    var aguardando = App.orcamentos.filter(function (o) {
      return o.status === 'enviado' && !o.arquivado_em;
    });
    var valorAguardando = aguardando.reduce(function (a, o) { return a + App.totalOrcamento(o); }, 0);

    var aprovadosMes = aprovados(mesVizinho(0));
    var valorMes = somar(aprovadosMes);

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
    // os que já estão na fila de cobrança não se repetem aqui
    var naFila = {};
    (App.filaCobranca ? App.filaCobranca() : []).forEach(function (o) { naFila[o.id] = 1; });
    var enviados = App.orcamentos.filter(function (o) {
      return o.status === 'enviado' && !naFila[o.id] && !o.arquivado_em;
    });
    var alvo = $('#hoje-orcamentos');

    if (!enviados.length) {
      alvo.innerHTML = '<p class="dica-vazia">Nada esperando resposta fora da fila acima.</p>';
      return;
    }

    alvo.innerHTML = enviados.slice(0, 5).map(function (o) {
      // conta desde o ENVIO, igual à fila de cobrança e ao "Limpar a tela"
      var dias = Math.floor((Date.now() - new Date(o.enviado_em || o.criado_em)) / 86400000);
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
    pintarFaturamento();
    pintarEntregas();
    pintarLimpar();
    pintarVisitas();
    pintarOrcamentos();
  }

  App.aoCarregarDados.push(pintarHoje);

  /* arranca o sistema depois que todas as áreas se registraram */
  App.iniciar();
})();
