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

  /* O que o banco não guarda: se a conta já confirmou o e-mail e quando
     entrou pela última vez. Quem sabe isso é o Supabase, e só a função
     'senha' consegue perguntar. É o que costuma explicar "digito a senha
     certa e não entra": conta criada sem confirmar o e-mail. */
  var contas = {};
  var funcaoNoAr = true;

  function chamarFuncao(corpo) {
    return App.sb.functions.invoke('senha', { body: corpo }).then(function (r) {
      if (r.error) {
        // a mensagem útil vem no corpo da resposta, não no erro
        return (r.error.context && typeof r.error.context.json === 'function'
                  ? r.error.context.json().catch(function () { return {}; })
                  : Promise.resolve({}))
          .then(function (d) { throw new Error(d.erro || r.error.message || 'Falhou.'); });
      }
      return r.data;
    });
  }

  function carregarContas() {
    if (!App.ehAdmin()) return Promise.resolve();
    return chamarFuncao({ acao: 'estado' }).then(function (d) {
      contas = {};
      (d.contas || []).forEach(function (c) { contas[c.id] = c; });
      funcaoNoAr = true;
      if (App.rotaAtual === 'equipe') pintar();
    }).catch(function () {
      funcaoNoAr = false;                 // função ainda não publicada
      if (App.rotaAtual === 'equipe') pintar();
    });
  }

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
          estadoDaConta(p) +
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
        (funcaoNoAr
          ? '<div class="senha" data-senha-de="' + esc(p.id) + '">' +
              '<button class="senha__abrir" type="button" data-abrir-senha>Trocar senha</button>' +
            '</div>'
          : '') +
      '</article>';
    }).join('');
  }

  function estadoDaConta(p) {
    var c = contas[p.id];
    if (!c) return '';
    var linhas = [];
    if (!c.confirmado) {
      linhas.push('<p class="pessoa__aviso">E-mail não confirmado — com isso o Supabase recusa o login, ' +
                  'mesmo com a senha certa. Trocar a senha aqui embaixo já confirma.</p>');
    }
    linhas.push('<p class="pessoa__acesso">' + (c.ultimo_acesso
      ? 'Último acesso em ' + new Date(c.ultimo_acesso).toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'short', year: 'numeric' })
      : 'Nunca entrou') + '</p>');
    return linhas.join('');
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

  /* ---------------- trocar a senha ---------------- */
  function sortearSenha() {
    // sem l, I, 0, O: ninguém quer ditar senha no telefone e errar letra
    var letras = 'abcdefghjkmnpqrstuvwxyz';
    var numeros = '23456789';
    var s = '';
    for (var i = 0; i < 6; i++) s += letras[Math.floor(Math.random() * letras.length)];
    for (var j = 0; j < 3; j++) s += numeros[Math.floor(Math.random() * numeros.length)];
    return s;
  }

  function abrirSenha(caixa) {
    var pessoa = null;
    App.equipe.forEach(function (p) { if (p.id === caixa.dataset.senhaDe) pessoa = p; });
    if (!pessoa) return;

    caixa.innerHTML =
      '<p class="senha__titulo">Senha nova para ' + esc(pessoa.nome || pessoa.email) + '</p>' +
      '<div class="senha__linha">' +
        '<input type="text" class="senha__campo" data-nova autocomplete="off" ' +
               'spellcheck="false" placeholder="pelo menos 8 caracteres" value="' + sortearSenha() + '">' +
        '<button class="btn btn--pequeno btn--fantasma" type="button" data-sortear>Sortear outra</button>' +
      '</div>' +
      '<p class="senha__nota">Anote antes de salvar — depois não dá para ver de novo, ' +
        'só trocar por outra. Passe para a pessoa por WhatsApp e peça para trocar depois, se quiser.</p>' +
      '<div class="senha__acoes">' +
        '<button class="btn btn--pequeno" type="button" data-gravar-senha>Salvar senha</button>' +
        '<button class="btn btn--pequeno btn--fantasma" type="button" data-fechar-senha>Cancelar</button>' +
      '</div>';
    var campo = caixa.querySelector('[data-nova]');
    campo.focus(); campo.select();
  }

  function fecharSenha(caixa) {
    caixa.innerHTML = '<button class="senha__abrir" type="button" data-abrir-senha>Trocar senha</button>';
  }

  document.addEventListener('click', function (e) {
    var caixa = e.target.closest('#equipe-lista .senha');
    if (!caixa) return;

    if (e.target.closest('[data-abrir-senha]'))  return abrirSenha(caixa);
    if (e.target.closest('[data-fechar-senha]')) return fecharSenha(caixa);

    if (e.target.closest('[data-sortear]')) {
      var c = caixa.querySelector('[data-nova]');
      c.value = sortearSenha(); c.focus(); c.select();
      return;
    }

    if (e.target.closest('[data-gravar-senha]')) {
      var campo = caixa.querySelector('[data-nova]');
      var nova = (campo.value || '').trim();
      if (nova.length < 8) {
        App.avisar('A senha precisa de pelo menos 8 caracteres.', 'erro');
        campo.focus();
        return;
      }
      var id = caixa.dataset.senhaDe;
      var pessoa = null;
      App.equipe.forEach(function (p) { if (p.id === id) pessoa = p; });

      App.carregando(true);
      chamarFuncao({ acao: 'senha', id: id, senha: nova })
        .then(function () {
          App.carregando(false);
          App.avisar('Senha trocada. Passe para a pessoa: ' + nova);
          App.registrar('equipe_senha', (pessoa && (pessoa.nome || pessoa.email)) || '', '', id);
          fecharSenha(caixa);
          carregarContas();       // o e-mail sai confirmado; atualiza o aviso
        })
        .catch(function (err) {
          App.carregando(false);
          App.avisar(err.message || 'Não consegui trocar a senha.', 'erro');
        });
    }
  });

  App.aoTrocarRota.push(function (rota) {
    if (rota !== 'equipe') return;
    pintar();
    carregarContas();
  });
})();
