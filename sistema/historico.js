/* =====================================================================
   Histórico — o que cada pessoa fez, em ordem, só para o admin.

   Quase tudo aqui vem de gatilhos no banco: se um orçamento mudou,
   ficou registrado, mesmo que a mudança não tenha passado por esta tela.
   O sistema só acrescenta o que o banco não teria como saber — entrar,
   sair, mandar no WhatsApp, baixar o PDF.
   ===================================================================== */

(function () {
  'use strict';

  var App = window.App;
  var $ = App.$, $$ = App.$$, esc = App.esc;

  var PAGINA = 60;          // quantos registros por vez
  var linhas = [];
  var acabou = false;
  var pessoa = '';
  var tipo   = 'todos';
  var carregando = false;

  /* Como cada ação é dita em português, e de que família ela é.
     [texto, família, cor] — a família alimenta os filtros de cima. */
  var ACOES = {
    entrou:              ['Entrou no sistema',        'acesso',    'neutro'],
    saiu:                ['Saiu do sistema',          'acesso',    'neutro'],

    orcamento_criado:    ['Criou o orçamento',        'orcamento', 'novo'],
    orcamento_editado:   ['Editou o orçamento',       'orcamento', 'neutro'],
    orcamento_enviado:   ['Marcou como enviado',      'orcamento', 'aviso'],
    orcamento_aprovado:  ['Orçamento aprovado',       'orcamento', 'bom'],
    orcamento_recusado:  ['Orçamento recusado',       'orcamento', 'ruim'],
    orcamento_rascunho:  ['Voltou para rascunho',     'orcamento', 'neutro'],
    orcamento_cobrado:   ['Cobrou resposta',          'orcamento', 'aviso'],
    orcamento_whatsapp:  ['Mandou no WhatsApp',       'orcamento', 'aviso'],
    orcamento_pdf:       ['Baixou o PDF',             'orcamento', 'neutro'],
    orcamento_excluido:  ['Excluiu o orçamento',      'orcamento', 'ruim'],

    visita_criada:       ['Marcou uma visita',        'visita',    'novo'],
    visita_editada:      ['Mexeu na visita',          'visita',    'neutro'],
    visita_remarcada:    ['Remarcou a visita',        'visita',    'aviso'],
    visita_confirmada:   ['Cliente confirmou',        'visita',    'bom'],
    visita_realizada:    ['Visita realizada',         'visita',    'bom'],
    visita_cancelada:    ['Visita cancelada',         'visita',    'ruim'],
    visita_agendada:     ['Voltou para agendada',     'visita',    'neutro'],
    visita_excluida:     ['Excluiu a visita',         'visita',    'ruim'],

    equipe_entrou:       ['Conta criada',             'equipe',    'neutro'],
    equipe_liberada:     ['Liberou o acesso',         'equipe',    'bom'],
    equipe_desligada:    ['Desligou o acesso',        'equipe',    'ruim'],
    equipe_papel:        ['Mudou o papel',            'equipe',    'aviso'],
    equipe_removida:     ['Removeu da equipe',        'equipe',    'ruim']
  };

  function daAcao(a) { return ACOES[a] || [a.replace(/_/g, ' '), 'outro', 'neutro']; }

  /* ---------------- buscar ---------------- */
  function buscar(continuar) {
    if (carregando || !App.ehAdmin()) return Promise.resolve();
    carregando = true;
    if (!continuar) { linhas = []; acabou = false; }

    var q = App.sb.from('historico').select('*')
              .order('quando', { ascending: false })
              .limit(PAGINA);

    if (pessoa) q = q.eq('user_id', pessoa);
    if (linhas.length) q = q.lt('quando', linhas[linhas.length - 1].quando);

    App.carregando(true);
    return q.then(function (r) {
      App.carregando(false);
      carregando = false;
      if (r.error) throw r.error;
      var novas = r.data || [];
      if (novas.length < PAGINA) acabou = true;
      linhas = linhas.concat(novas);
      pintar();
    }).catch(function (e) {
      App.carregando(false);
      carregando = false;
      var m = (e && e.message) || '';
      if (/relation .*historico.* does not exist/i.test(m)) {
        $('#historico-lista').innerHTML =
          '<div class="vazio"><strong>Falta preparar o histórico</strong>' +
          'Rode o <code>banco-historico.sql</code> no Supabase e volte aqui.</div>';
        $('#historico-resumo').textContent = '';
      } else {
        App.avisar(App.textoErro(e), 'erro');
      }
    });
  }

  /* ---------------- desenhar ---------------- */
  function daFamilia(l) { return daAcao(l.acao)[1]; }

  function pintar() {
    var alvo = $('#historico-lista');
    var vis = linhas.filter(function (l) {
      return tipo === 'todos' || daFamilia(l) === tipo;
    });

    $('#historico-resumo').textContent = linhas.length
      ? vis.length + (vis.length === 1 ? ' registro' : ' registros') +
        (acabou ? '' : ' (há mais para trás)')
      : '';

    $('#btn-historico-mais').hidden = acabou || !linhas.length;

    if (!vis.length) {
      alvo.innerHTML = '<div class="vazio"><strong>' +
        (linhas.length ? 'Nada deste tipo por aqui' : 'Nada registrado ainda') + '</strong>' +
        (linhas.length ? 'Experimente outro filtro.'
                       : 'Assim que a equipe começar a mexer, aparece tudo aqui.') + '</div>';
      return;
    }

    // agrupa por dia, que é como a gente lembra das coisas
    var html = '';
    var diaAtual = '';
    vis.forEach(function (l) {
      var d = new Date(l.quando);
      var dia = diaBonito(d);
      if (dia !== diaAtual) {
        diaAtual = dia;
        html += '<h2 class="hist__dia">' + esc(dia) + '</h2>';
      }
      var a = daAcao(l.acao);
      html += '<article class="hist" data-cor="' + a[2] + '">' +
        '<time class="hist__hora">' +
          d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + '</time>' +
        '<div class="hist__meio">' +
          '<p class="hist__acao">' + esc(a[0]) +
            (l.alvo ? ' <span class="hist__alvo">' + esc(l.alvo) + '</span>' : '') + '</p>' +
          (l.detalhe ? '<p class="hist__detalhe">' + esc(l.detalhe) + '</p>' : '') +
        '</div>' +
        '<span class="hist__quem">' + esc(nomeDe(l.user_id)) + '</span>' +
      '</article>';
    });
    alvo.innerHTML = html;
  }

  function nomeDe(id) {
    if (!id) return 'sistema';
    for (var i = 0; i < App.equipe.length; i++) {
      if (App.equipe[i].id === id) {
        return App.equipe[i].nome || App.equipe[i].email || 'alguém';
      }
    }
    return App.usuario && id === App.usuario.id ? 'você' : 'alguém';
  }

  function diaBonito(d) {
    var hoje = new Date();
    var ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
    var iso = App.paraISO(d);
    if (iso === App.paraISO(hoje)) return 'Hoje';
    if (iso === App.paraISO(ontem)) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  /* ---------------- controles ---------------- */
  function encherPessoas() {
    var sel = $('#historico-pessoa');
    if (!sel) return;
    var antes = sel.value;
    sel.innerHTML = '<option value="">Todo mundo</option>' +
      App.equipe.map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.nome || p.email) + '</option>';
      }).join('');
    sel.value = antes;
  }

  $('#historico-pessoa').addEventListener('change', function (e) {
    pessoa = e.target.value;
    buscar(false);
  });

  $$('#pg-historico .pilulas button').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#pg-historico .pilulas button').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
      b.setAttribute('aria-pressed', 'true');
      tipo = b.dataset.h;
      pintar();
      // se o filtro deixou pouca coisa na tela, vai buscar mais para trás
      if (!acabou && $('#historico-lista').querySelectorAll('.hist').length < 12) buscar(true);
    });
  });

  $('#btn-historico-mais').addEventListener('click', function () { buscar(true); });
  $('#btn-historico-recarregar').addEventListener('click', function () { buscar(false); });

  App.aoTrocarRota.push(function (rota) {
    if (rota !== 'historico') return;
    encherPessoas();
    if (!linhas.length) buscar(false);
    else pintar();
  });
})();
