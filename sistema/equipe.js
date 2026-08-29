/* =====================================================================
   Equipe — quem entra no sistema e o que cada um pode fazer.
   Só o admin vê esta tela. Quem cria a conta (e a senha) é o Supabase;
   aqui você diz o papel da pessoa e liga ou desliga o acesso dela.
   ===================================================================== */

(function () {
  'use strict';

  var App = window.App;
  var $ = App.$, esc = App.esc;

  var PAPEIS = [
    ['admin',      'Admin',      'Faz tudo, inclusive mexer nesta lista.'],
    ['marceneiro', 'Marceneiro', 'Faz tudo, menos mexer na equipe.'],
    ['vendedor',   'Vendedor',   'Cria, edita e envia orçamentos — mas não apaga nada.'],
    ['montador',   'Montador',   'Só a agenda: vê as visitas e marca o que já foi feito.']
  ];

  App.ROTULO_PAPEL = {};
  PAPEIS.forEach(function (p) { App.ROTULO_PAPEL[p[0]] = p[1]; });

  App.equipe = [];

  /* nome de quem criou um orçamento ou uma visita, para mostrar na lista */
  App.nomeDe = function (id) {
    if (!id) return '';
    if (App.usuario && id === App.usuario.id) return 'você';
    for (var i = 0; i < App.equipe.length; i++) {
      if (App.equipe[i].id === id) {
        return (App.equipe[i].nome || App.equipe[i].email || '').split(' ')[0] || '';
      }
    }
    return '';
  };

  App.carregarEquipe = function () {
    if (!App.papel) { App.equipe = []; return Promise.resolve([]); }
    return App.sb.from('equipe').select('*').order('criado_em', { ascending: true })
      .then(function (r) {
        App.equipe = (r && !r.error && r.data) ? r.data : [];
        if (App.rotaAtual === 'equipe') pintar();
        return App.equipe;
      })
      .catch(function () { App.equipe = []; return []; });
  };

  /* ---------------- a lista ---------------- */
  function pintar() {
    var alvo = $('#equipe-lista');
    if (!alvo) return;

    var esperando = App.equipe.filter(function (p) { return !p.ativo; }).length;
    $('#equipe-resumo').textContent =
      App.equipe.length + (App.equipe.length === 1 ? ' pessoa' : ' pessoas') +
      (esperando ? ' · ' + esperando + ' esperando liberação' : '');

    if (!App.equipe.length) {
      alvo.innerHTML = '<p class="dica-vazia">Ninguém cadastrado ainda. ' +
        'Rode o banco-equipe.sql no Supabase se esta lista deveria ter você.</p>';
      return;
    }

    alvo.innerHTML = App.equipe.map(function (p) {
      var euMesmo = App.usuario && p.id === App.usuario.id;
      return '<article class="pessoa' + (p.ativo ? '' : ' pessoa--parada') + '" data-id="' + esc(p.id) + '">' +
        '<div class="pessoa__quem">' +
          '<h3 class="pessoa__nome">' + esc(p.nome || p.email || 'Sem nome') +
            (euMesmo ? ' <span class="pessoa__eu">você</span>' : '') + '</h3>' +
          '<p class="pessoa__email">' + esc(p.email || '') + '</p>' +
          (p.ativo ? '' : '<p class="pessoa__aviso">Esperando liberação — ainda não vê nada.</p>') +
        '</div>' +
        '<div class="pessoa__controles">' +
          '<label class="campo campo--enxuto"><span class="campo__rot">Papel</span>' +
            '<select data-papel' + (euMesmo ? ' disabled' : '') + '>' +
              PAPEIS.map(function (op) {
                return '<option value="' + op[0] + '"' + (p.papel === op[0] ? ' selected' : '') + '>' +
                       op[1] + '</option>';
              }).join('') +
            '</select></label>' +
          (euMesmo
            ? '<span class="pessoa__trava">Você não muda o próprio acesso</span>'
            : '<button class="btn btn--pequeno' + (p.ativo ? ' btn--fantasma' : '') + '" type="button" data-liga>' +
              (p.ativo ? 'Desligar acesso' : 'Liberar acesso') + '</button>') +
        '</div>' +
        '<p class="pessoa__oque">' + esc(descricao(p.papel)) + '</p>' +
      '</article>';
    }).join('');
  }

  function descricao(papel) {
    for (var i = 0; i < PAPEIS.length; i++) if (PAPEIS[i][0] === papel) return PAPEIS[i][2];
    return '';
  }

  /* ---------------- mudanças ---------------- */
  function salvar(id, mudanca, aviso) {
    App.carregando(true);
    return App.sb.from('equipe').update(mudanca).eq('id', id).select().single()
      .then(function (r) {
        App.carregando(false);
        if (r.error) throw r.error;
        for (var i = 0; i < App.equipe.length; i++) {
          if (App.equipe[i].id === id) App.equipe[i] = r.data;
        }
        pintar();
        App.avisar(aviso);
      })
      .catch(function (e) {
        App.carregando(false);
        App.avisar(App.textoErro(e), 'erro');
        pintar();                       // devolve a tela ao que o banco diz
      });
  }

  document.addEventListener('change', function (e) {
    var sel = e.target.closest('#equipe-lista [data-papel]');
    if (!sel) return;
    var cartao = sel.closest('.pessoa');
    salvar(cartao.dataset.id, { papel: sel.value },
           'Papel alterado para ' + App.ROTULO_PAPEL[sel.value] + '.');
  });

  document.addEventListener('click', function (e) {
    var bt = e.target.closest('#equipe-lista [data-liga]');
    if (!bt) return;
    var cartao = bt.closest('.pessoa');
    var pessoa = null;
    App.equipe.forEach(function (p) { if (p.id === cartao.dataset.id) pessoa = p; });
    if (!pessoa) return;

    if (pessoa.ativo && !confirm('Desligar o acesso de ' + (pessoa.nome || pessoa.email) +
        '? A conta continua existindo, mas não entra mais no sistema.')) return;

    salvar(pessoa.id, { ativo: !pessoa.ativo },
           pessoa.ativo ? 'Acesso desligado.' : 'Acesso liberado.');
  });

  App.aoTrocarRota.push(function (rota) { if (rota === 'equipe') pintar(); });
})();
