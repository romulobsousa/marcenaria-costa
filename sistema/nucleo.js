/* =====================================================================
   Núcleo do sistema — login, navegação, dados compartilhados.
   As áreas (orcamentos.js, agenda.js, inicio.js) penduram-se em App.
   ===================================================================== */

window.App = (function () {
  'use strict';

  var CFG = window.CONFIG_ORCAMENTO || {};

  var App = {
    cfg: CFG,
    sb: null,
    usuario: null,
    papel: null,          // admin | marceneiro | vendedor | montador
    orcamentos: [],
    visitas: [],
    aoTrocarRota: [],     // callbacks por rota
    aoCarregarDados: []   // callbacks quando os dados chegam
  };

  /* ---------------- atalhos ---------------- */
  App.$  = function (s, e) { return (e || document).querySelector(s); };
  App.$$ = function (s, e) { return Array.prototype.slice.call((e || document).querySelectorAll(s)); };

  App.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  App.dinheiro = function (v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  App.carregando = function (on) { App.$('#carregando').toggleAttribute('data-on', !!on); };

  var timerAviso;
  App.avisar = function (msg, tipo) {
    var el = App.$('#aviso');
    el.textContent = msg;
    el.setAttribute('data-tipo', tipo || 'ok');
    el.setAttribute('data-on', '');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { el.removeAttribute('data-on'); }, tipo === 'erro' ? 5000 : 2600);
  };

  App.textoErro = function (e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail no Supabase (marque Auto Confirm User).';
    if (/relation .*visitas.* does not exist/i.test(m))
      return 'A tabela de visitas ainda não existe. Rode o banco-agenda.sql no Supabase.';
    if (/relation .*orcamentos.* does not exist/i.test(m))
      return 'A tabela de orçamentos ainda não existe. Rode o banco.sql no Supabase.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor.';
    if (/JWT|session/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    return m || 'Algo deu errado.';
  };

  /* ---------------- datas ---------------- */
  // Dia civil, sem fuso: sempre ao meio-dia local, para a data não escorregar.
  App.doISO = function (iso) {
    var p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
  };
  App.paraISO = function (d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
           '-' + String(d.getDate()).padStart(2, '0');
  };
  App.somaDias = function (d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; };
  App.segundaDe = function (d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    var dia = x.getDay();
    x.setDate(x.getDate() - (dia === 0 ? 6 : dia - 1));
    return x;
  };
  App.hhmm = function (h) { return String(h || '').slice(0, 5); };
  App.hoje = function () { return App.paraISO(new Date()); };

  /* ---------------- navegação ---------------- */
  var PAGINAS = {
    hoje:       '#pg-hoje',
    orcamentos: '#pg-orcamentos',
    editor:     '#pg-editor',
    agenda:     '#pg-agenda',
    equipe:     '#pg-equipe',
    historico:  '#pg-historico'
  };

  /* O que cada papel alcança. O sistema esconde o que não é da pessoa,
     mas quem manda de verdade é a regra no banco: mesmo que alguém force
     o endereço na barra, o banco não devolve o que não é dela. */
  var ALCANCE = {
    admin:      ['hoje', 'orcamentos', 'editor', 'agenda', 'equipe', 'historico'],
    marceneiro: ['hoje', 'orcamentos', 'editor', 'agenda'],
    vendedor:   ['hoje', 'orcamentos', 'editor', 'agenda'],
    montador:   ['agenda']
  };

  App.pode = function (rota) {
    var lista = ALCANCE[App.papel] || [];
    return lista.indexOf(rota) >= 0;
  };

  // atalhos de leitura usados pelas telas
  App.ehAdmin   = function () { return App.papel === 'admin'; };
  App.podeApagar = function () { return App.papel === 'admin' || App.papel === 'marceneiro'; };
  App.podeOrcar  = function () { return App.pode('orcamentos'); };
  App.podeAgendar = function () { return !!App.papel && App.papel !== 'montador'; };

  App.rotaAtual = 'hoje';

  App.ir = function (rota) {
    if (location.hash !== '#/' + rota) { location.hash = '#/' + rota; return; }
    aplicarRota(rota);
  };

  function aplicarRota(rota) {
    if (!PAGINAS[rota]) rota = 'hoje';
    if (App.papel && !App.pode(rota)) rota = (ALCANCE[App.papel] || ['hoje'])[0];
    App.rotaAtual = rota;

    Object.keys(PAGINAS).forEach(function (k) {
      App.$(PAGINAS[k]).hidden = k !== rota;
    });

    // o editor é filho de "orçamentos" para efeito de menu
    var destaque = rota === 'editor' ? 'orcamentos' : rota;
    App.$$('.menu a').forEach(function (a) {
      if (a.dataset.rota === destaque) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    window.scrollTo(0, 0);
    App.aoTrocarRota.forEach(function (f) { try { f(rota); } catch (e) {} });
  }

  window.addEventListener('hashchange', function () {
    aplicarRota((location.hash || '').replace(/^#\//, ''));
  });

  /* ---------------- dados ---------------- */
  App.recarregar = function (silencioso) {
    if (!silencioso) App.carregando(true);

    // montador não enxerga orçamento: nem pede ao banco
    var pOrc = App.podeOrcar()
      ? App.sb.from('orcamentos').select('*').order('criado_em', { ascending: false })
      : Promise.resolve({ data: [], error: null });
    var de  = App.paraISO(App.somaDias(new Date(), -120));
    var ate = App.paraISO(App.somaDias(new Date(), 365));
    var pVis = App.sb.from('visitas').select('*').gte('data', de).lte('data', ate)
                 .order('data', { ascending: true }).order('hora', { ascending: true });

    return Promise.all([pOrc, pVis]).then(function (r) {
      if (!silencioso) App.carregando(false);
      var erros = [];
      if (r[0].error) erros.push(r[0].error); else App.orcamentos = r[0].data || [];
      if (r[1].error) erros.push(r[1].error); else App.visitas = r[1].data || [];
      if (erros.length) App.avisar(App.textoErro(erros[0]), 'erro');
      App.aoCarregarDados.forEach(function (f) { try { f(); } catch (e) {} });
    }).catch(function (e) {
      if (!silencioso) App.carregando(false);
      App.avisar(App.textoErro(e), 'erro');
    });
  };

  /* Registra no histórico o que o banco não tem como saber sozinho:
     entrar, sair, mandar no WhatsApp, baixar o PDF. O resto (orçamento
     criado, visita remarcada, acesso liberado) é anotado pelo próprio
     banco, então fica registrado mesmo que não passe por aqui. */
  App.registrar = function (acao, alvo, detalhe, alvoId) {
    if (!App.sb) return Promise.resolve();
    return App.sb.rpc('anota', {
      p_acao: acao, p_alvo: alvo || '', p_detalhe: detalhe || '', p_alvo_id: alvoId || null
    }).then(function () {}).catch(function () {});   // histórico nunca atrapalha o trabalho
  };

  App.totalOrcamento = function (o) {
    var s = (Array.isArray(o.itens) ? o.itens : []).reduce(function (a, it) {
      return a + (Number(it.qtd) || 0) * (Number(it.valor) || 0);
    }, 0);
    return Math.max(0, s - (Number(o.desconto) || 0));
  };

  /* ---------------- entrar e sair ---------------- */
  function mostrarLogin() {
    App.$('#tela-login').hidden = false;
    App.$('#tela-espera').hidden = true;
    App.$('#app').hidden = true;
  }

  function mostrarEspera(acesso) {
    App.$('#tela-login').hidden = true;
    App.$('#app').hidden = true;
    App.$('#tela-espera').hidden = false;
    App.$('#espera-email').textContent =
      (acesso && acesso.email) || (App.usuario && App.usuario.email) || '';
  }

  /* Quem entrou, e o que essa pessoa alcança. Sem papel liberado o
     sistema não abre — e não é só a tela: o banco também não devolve
     nada para quem não está na equipe. */
  function abrirConformePapel() {
    return App.sb.rpc('meu_acesso').then(function (r) {
      if (r.error) throw r.error;
      var acesso = r.data;

      if (!acesso || !acesso.ativo) { App.papel = null; mostrarEspera(acesso); return; }

      App.papel = acesso.papel;
      App.nome  = acesso.nome || acesso.email || '';

      App.$('#tela-login').hidden = true;
      App.$('#tela-espera').hidden = true;
      App.$('#app').hidden = false;
      ajustarMenu();

      aplicarRota((location.hash || '').replace(/^#\//, '') || (ALCANCE[App.papel] || ['hoje'])[0]);
      if (App.carregarEquipe) App.carregarEquipe();
      App.recarregar();
    }).catch(function (e) {
      var m = (e && e.message) || '';
      if (/meu_acesso.*does not exist|function public\.meu_acesso/i.test(m)) {
        // banco antigo, sem a tabela de equipe: segue como antes
        App.papel = 'admin';
        App.$('#tela-login').hidden = true;
        App.$('#tela-espera').hidden = true;
        App.$('#app').hidden = false;
        ajustarMenu();
        aplicarRota((location.hash || '').replace(/^#\//, '') || 'hoje');
        App.recarregar();
        return;
      }
      App.avisar(App.textoErro(e), 'erro');
      mostrarLogin();
    });
  }

  function ajustarMenu() {
    App.$$('.menu a').forEach(function (a) {
      a.hidden = !App.pode(a.dataset.rota);
    });
    document.body.setAttribute('data-papel', App.papel || '');
    var nova = App.$('#btn-nova');
    if (nova) nova.hidden = !App.podeAgendar();
  }

  function mostrarApp() { return abrirConformePapel(); }

  App.$('#form-login').addEventListener('submit', function (e) {
    e.preventDefault();
    var erro = App.$('#login-erro');
    erro.hidden = true;
    App.$('#login-btn').disabled = true;
    App.carregando(true);

    App.sb.auth.signInWithPassword({
      email: App.$('#login-email').value.trim(),
      password: App.$('#login-senha').value
    }).then(function (r) {
      if (r.error) throw r.error;
      App.usuario = r.data.user;
      App.$('#login-senha').value = '';
      App.registrar('entrou', '', '');
      mostrarApp();
    }).catch(function (e) {
      erro.textContent = App.textoErro(e);
      erro.hidden = false;
    }).then(function () {
      App.$('#login-btn').disabled = false;
      App.carregando(false);
    });
  });

  App.$('#btn-sair-espera').addEventListener('click', function () {
    App.sb.auth.signOut().then(function () { App.usuario = null; App.papel = null; mostrarLogin(); });
  });

  App.$('#btn-sair').addEventListener('click', function () {
    if (App.sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    App.carregando(true);
    App.registrar('saiu', '', '').then(function () {
      return App.sb.auth.signOut();
    }).then(function () {
      App.usuario = null; App.papel = null; App.equipe = [];
      App.orcamentos = []; App.visitas = [];
      App.carregando(false);
      mostrarLogin();
    });
  });

  /* ---------------- arranque ---------------- */
  function faltaConfig() {
    return !CFG.SUPABASE_URL || /COLE_AQUI/.test(CFG.SUPABASE_URL) ||
           !CFG.SUPABASE_CHAVE || /COLE_AQUI/.test(CFG.SUPABASE_CHAVE);
  }

  App.iniciar = function () {
    if (faltaConfig()) {
      document.body.innerHTML =
        '<div style="max-width:560px;margin:14vh auto;padding:28px;font-family:Inter,sans-serif;' +
        'background:#fffdf9;border:1px solid #e2dbcc;border-radius:14px;line-height:1.6">' +
        '<h1 style="font-family:Georgia,serif;margin:0 0 10px;font-size:1.3rem">Falta configurar o banco</h1>' +
        '<p style="color:#56503f;margin:0">Preencha a URL e a chave em <code>sistema/config.js</code>.</p></div>';
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      document.body.insertAdjacentHTML('afterbegin',
        '<p style="padding:20px;font-family:sans-serif">Não consegui carregar a biblioteca do banco. ' +
        'Verifique a conexão e recarregue a página.</p>');
      return;
    }

    App.sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_CHAVE);

    App.sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (s) { App.usuario = s.user; mostrarApp(); } else mostrarLogin();
    }).catch(mostrarLogin);

    App.sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'SIGNED_OUT') { App.usuario = null; App.papel = null; mostrarLogin(); }
    });
  };

  /* atalhos de navegação vindos de botões soltos */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ir]');
    if (!b) return;
    var destino = b.dataset.ir;
    if (destino === 'orcamento-novo') { App.ir('orcamentos'); setTimeout(function () { App.$('#btn-novo').click(); }, 40); }
    else if (destino === 'agenda-nova') { App.ir('agenda'); setTimeout(function () { App.$('#btn-nova').click(); }, 40); }
    else App.ir(destino);
  });

  window.addEventListener('beforeunload', function (e) {
    if (App.sujo) { e.preventDefault(); e.returnValue = ''; }
  });

  return App;
})();
