/* =====================================================================
   Marcenaria Costa — agenda de visitas
   ===================================================================== */

(function () {
  'use strict';

  var CFG = window.CONFIG_ORCAMENTO || {};
  var $  = function (s, e) { return (e || document).querySelector(s); };
  var $$ = function (s, e) { return Array.prototype.slice.call((e || document).querySelectorAll(s)); };

  var sb = null;
  var estado = {
    usuario: null,
    visitas: [],
    atual: null,
    inicioSemana: segundaDe(new Date())
  };

  var TIPOS = {
    medicao:      'Medição',
    apresentacao: 'Apresentação',
    montagem:     'Montagem',
    entrega:      'Entrega',
    assistencia:  'Assistência'
  };
  var SITUACOES = {
    agendada:   'Agendada',
    confirmada: 'Confirmada',
    realizada:  'Realizada',
    cancelada:  'Cancelada'
  };

  /* ---------------- datas ---------------- */
  // Datas de visita são dia civil, sem fuso: montamos sempre ao meio-dia
  // local para o dia nunca escorregar para o anterior.
  function doISO(iso) {
    var p = String(iso).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2], 12, 0, 0);
  }
  function paraISO(d) {
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }
  function segundaDe(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    var dia = x.getDay();                    // 0 domingo … 6 sábado
    x.setDate(x.getDate() - (dia === 0 ? 6 : dia - 1));
    return x;
  }
  function somaDias(d, n) {
    var x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
  }
  function hhmm(h) { return String(h || '').slice(0, 5); }

  function nomeDia(d) {
    var s = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    // pt-BR devolve "segunda-feira"; queremos "Segunda-feira", não "Segunda-Feira"
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function diaMes(d) {
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  function ehHoje(d) { return paraISO(d) === paraISO(new Date()); }

  function comoQuando(iso, hora) {
    var hoje = paraISO(new Date());
    var amanha = paraISO(somaDias(new Date(), 1));
    if (iso === hoje) return 'Hoje, ' + hhmm(hora);
    if (iso === amanha) return 'Amanhã, ' + hhmm(hora);
    var d = doISO(iso);
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
            .replace('.', '') + ', ' + hhmm(hora);
  }

  /* ---------------- utilidades ---------------- */
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
    timerAviso = setTimeout(function () { el.removeAttribute('data-on'); }, tipo === 'erro' ? 5000 : 2600);
  }

  function textoErro(e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail no Supabase (marque Auto Confirm User).';
    if (/relation .*visitas.* does not exist/i.test(m))
      return 'A tabela de visitas ainda não existe. Rode o banco-agenda.sql no Supabase.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor.';
    return m || 'Algo deu errado.';
  }

  function mostrarTela(qual) {
    ['#tela-login', '#tela-agenda'].forEach(function (s) { $(s).hidden = s !== qual; });
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
        '<p style="color:#56503f;margin:0">Preencha a URL e a chave em <code>orcamentos/config.js</code>. ' +
        'A agenda usa a mesma configuração dos orçamentos.</p></div>';
      return;
    }
    if (!window.supabase || !window.supabase.createClient) {
      avisar('A biblioteca do banco não carregou. Recarregue a página.', 'erro');
      return;
    }

    sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_CHAVE);

    sb.auth.getSession().then(function (r) {
      var s = r && r.data && r.data.session;
      if (s) { estado.usuario = s.user; abrirAgenda(); }
      else mostrarTela('#tela-login');
    }).catch(function () { mostrarTela('#tela-login'); });

    sb.auth.onAuthStateChange(function (ev) {
      if (ev === 'SIGNED_OUT') { estado.usuario = null; mostrarTela('#tela-login'); }
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
      abrirAgenda();
    }).catch(function (e) {
      erro.textContent = textoErro(e);
      erro.hidden = false;
    }).then(function () {
      $('#login-btn').disabled = false;
      carregando(false);
    });
  });

  $('#btn-sair').addEventListener('click', function () {
    carregando(true);
    sb.auth.signOut().then(function () {
      estado.usuario = null; estado.visitas = [];
      carregando(false);
      mostrarTela('#tela-login');
    });
  });

  /* ---------------- carregar ---------------- */
  function abrirAgenda() {
    mostrarTela('#tela-agenda');
    carregar();
  }

  function carregar() {
    carregando(true);
    // pega uma janela larga: semana visível + próximas, para o bloco "A seguir"
    var de = paraISO(somaDias(estado.inicioSemana, -35));
    var ate = paraISO(somaDias(estado.inicioSemana, 90));

    sb.from('visitas').select('*').gte('data', de).lte('data', ate)
      .order('data', { ascending: true }).order('hora', { ascending: true })
      .then(function (r) {
        carregando(false);
        if (r.error) { avisar(textoErro(r.error), 'erro'); return; }
        estado.visitas = r.data || [];
        pintar();
      });
  }

  /* ---------------- render ---------------- */
  function pintar() {
    pintarProximas();
    pintarSemana();
    pintarResumo();
  }

  function pintarResumo() {
    var hoje = paraISO(new Date());
    var doDia = estado.visitas.filter(function (v) {
      return v.data === hoje && v.status !== 'cancelada';
    });
    var futuras = estado.visitas.filter(function (v) {
      return v.data >= hoje && v.status !== 'cancelada' && v.status !== 'realizada';
    });
    $('#agenda-resumo').textContent = doDia.length
      ? doDia.length + (doDia.length === 1 ? ' visita hoje' : ' visitas hoje') +
        (futuras.length > doDia.length ? '  ·  ' + futuras.length + ' pela frente' : '')
      : (futuras.length ? futuras.length + (futuras.length === 1 ? ' visita marcada' : ' visitas marcadas')
                        : 'Nenhuma visita marcada');
  }

  function pintarProximas() {
    var agora = new Date();
    var hoje = paraISO(agora);
    var horaAgora = String(agora.getHours()).padStart(2, '0') + ':' +
                    String(agora.getMinutes()).padStart(2, '0');

    var proximas = estado.visitas.filter(function (v) {
      if (v.status === 'cancelada' || v.status === 'realizada') return false;
      if (v.data > hoje) return true;
      return v.data === hoje && hhmm(v.hora) >= horaAgora;
    }).slice(0, 3);

    $('#proximas').hidden = proximas.length === 0;
    if (!proximas.length) return;

    $('#proximas-lista').innerHTML = proximas.map(function (v) {
      return cartaoVisita(v, true);
    }).join('');
    ligarCliques($('#proximas-lista'));
  }

  function cartaoVisita(v, comData) {
    var quando = comData ? comoQuando(v.data, v.hora) : hhmm(v.hora);
    var partes = [];
    partes.push('<span class="visita__tipo">' + TIPOS[v.tipo] + '</span>');
    if (v.endereco) partes.push(esc(v.endereco));
    if (v.status === 'confirmada') partes.push('confirmada');

    return '<button class="visita visita--' + v.tipo + (v.status === 'cancelada' ? ' visita--cancelada' : '') +
           (v.status === 'realizada' ? ' visita--realizada' : '') + '" type="button" data-id="' + v.id + '">' +
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
  }

  function pintarSemana() {
    var ini = estado.inicioSemana;
    var fim = somaDias(ini, 6);
    $('#semana-rotulo').textContent = diaMes(ini) + ' — ' + diaMes(fim);

    var html = '';
    for (var i = 0; i < 7; i++) {
      var d = somaDias(ini, i);
      var iso = paraISO(d);
      var doDia = estado.visitas.filter(function (v) { return v.data === iso; });

      html += '<div class="dia' + (ehHoje(d) ? ' dia--hoje' : '') + '">' +
        '<div class="dia__cabeca">' +
          '<span class="dia__num">' + String(d.getDate()).padStart(2, '0') + '</span>' +
          '<span class="dia__nome">' + nomeDia(d) + (ehHoje(d) ? ' · hoje' : '') + '</span>' +
        '</div>' +
        (doDia.length
          ? doDia.map(function (v) { return cartaoVisita(v, false); }).join('')
          : '<p class="dia__vazio">Livre</p>') +
      '</div>';
    }
    $('#dias').innerHTML = html;
    ligarCliques($('#dias'));
  }

  function ligarCliques(raiz) {
    $$('.visita', raiz).forEach(function (el) {
      el.addEventListener('click', function () {
        var v = estado.visitas.filter(function (x) { return x.id === el.dataset.id; })[0];
        if (v) abrirPainel(v);
      });
    });
  }

  /* ---------------- navegação de semana ---------------- */
  $('#btn-semana-ant').addEventListener('click', function () {
    estado.inicioSemana = somaDias(estado.inicioSemana, -7); pintar();
  });
  $('#btn-semana-prox').addEventListener('click', function () {
    estado.inicioSemana = somaDias(estado.inicioSemana, 7); pintar();
  });
  $('#btn-hoje').addEventListener('click', function () {
    estado.inicioSemana = segundaDe(new Date()); pintar();
  });

  /* ---------------- painel ---------------- */
  function visitaNova() {
    var amanha = somaDias(new Date(), 1);
    return {
      id: null, cliente_nome: '', cliente_telefone: '', endereco: '',
      data: paraISO(amanha), hora: '09:00', duracao_min: 60,
      tipo: 'medicao', status: 'agendada', observacoes: ''
    };
  }

  function abrirPainel(v) {
    estado.atual = JSON.parse(JSON.stringify(v));
    var nova = !v.id;

    $('#painel-titulo').textContent = nova ? 'Nova visita' : 'Visita de ' + (v.cliente_nome || 'cliente');
    $('#btn-excluir-visita').hidden = nova;

    $('#v-nome').value = v.cliente_nome || '';
    $('#v-telefone').value = v.cliente_telefone || '';
    $('#v-endereco').value = v.endereco || '';
    $('#v-data').value = v.data;
    $('#v-hora').value = hhmm(v.hora);
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
    estado.atual = null;
  }

  $$('[data-fechar]').forEach(function (el) { el.addEventListener('click', fecharPainel); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#painel').hidden) fecharPainel();
  });
  $('#btn-nova').addEventListener('click', function () { abrirPainel(visitaNova()); });

  /* aviso de choque de horário — não impede, só avisa */
  function conferirConflito() {
    var data = $('#v-data').value;
    var hora = $('#v-hora').value;
    var dur = parseInt($('#v-duracao').value, 10) || 60;
    var el = $('#conflito');
    if (!data || !hora) { el.hidden = true; return; }

    function emMinutos(h) { var p = h.split(':'); return (+p[0]) * 60 + (+p[1]); }
    var ini = emMinutos(hora), fim = ini + dur;

    var choques = estado.visitas.filter(function (v) {
      if (estado.atual && v.id === estado.atual.id) return false;
      if (v.data !== data || v.status === 'cancelada') return false;
      var vi = emMinutos(hhmm(v.hora)), vf = vi + (v.duracao_min || 60);
      return ini < vf && vi < fim;
    });

    if (!choques.length) { el.hidden = true; return; }
    el.innerHTML = 'Você já tem <b>' + esc(choques[0].cliente_nome || 'uma visita') + '</b> às ' +
                   hhmm(choques[0].hora) + ' neste dia. Dá para salvar assim mesmo — é só um aviso.';
    el.hidden = false;
  }
  ['#v-data', '#v-hora', '#v-duracao'].forEach(function (s) {
    $(s).addEventListener('change', conferirConflito);
  });

  /* ---------------- salvar ---------------- */
  function coletar() {
    return {
      user_id: estado.usuario.id,
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
    if (!d.cliente_nome) { avisar('Coloque o nome do cliente.', 'erro'); $('#v-nome').focus(); return Promise.reject(); }
    if (!d.data || !d.hora) { avisar('Escolha data e hora.', 'erro'); return Promise.reject(); }

    carregando(true);
    var q = estado.atual.id
      ? sb.from('visitas').update(d).eq('id', estado.atual.id).select().single()
      : sb.from('visitas').insert(d).select().single();

    return q.then(function (r) {
      carregando(false);
      if (r.error) throw r.error;
      avisar(estado.atual.id ? 'Visita atualizada' : 'Visita marcada');
      // leva a semana visível para a data salva
      estado.inicioSemana = segundaDe(doISO(r.data.data));
      fecharPainel();
      carregar();
      return r.data;
    }).catch(function (e) {
      carregando(false);
      if (e) avisar(textoErro(e), 'erro');
      throw e;
    });
  }

  $('#btn-salvar-visita').addEventListener('click', function () { salvar().catch(function () {}); });

  $('#btn-excluir-visita').addEventListener('click', function () {
    if (!estado.atual || !estado.atual.id) return;
    if (!confirm('Excluir esta visita?')) return;
    carregando(true);
    sb.from('visitas').delete().eq('id', estado.atual.id).then(function (r) {
      carregando(false);
      if (r.error) { avisar(textoErro(r.error), 'erro'); return; }
      avisar('Visita excluída');
      fecharPainel();
      carregar();
    });
  });

  /* ---------------- confirmar no WhatsApp ---------------- */
  $('#btn-zap-visita').addEventListener('click', function () {
    var d = coletar();
    var tel = d.cliente_telefone.replace(/\D/g, '');
    if (!tel) { avisar('Coloque o WhatsApp do cliente.', 'erro'); $('#v-telefone').focus(); return; }
    if (tel.length <= 11) tel = '55' + tel;

    var emp = CFG.empresa || {};
    var dia = doISO(d.data).toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long'
    });
    var primeiro = d.cliente_nome ? d.cliente_nome.split(' ')[0] : '';

    var msg = 'Olá' + (primeiro ? ', ' + primeiro : '') + '! Aqui é da ' + (emp.nome || 'marcenaria') + '.\n\n' +
      'Confirmando nossa ' + TIPOS[d.tipo].toLowerCase() + ':\n' +
      '📅 ' + dia + '\n' +
      '🕐 ' + hhmm(d.hora) + '\n' +
      (d.endereco ? '📍 ' + d.endereco + '\n' : '') +
      '\nFica bom pra você? Se precisar remarcar, é só me avisar.';

    window.open('https://wa.me/' + tel + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  iniciar();
})();
