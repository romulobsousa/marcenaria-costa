/* =========================================================
   Marcenaria Costa — scripts do site
   ---------------------------------------------------------
   >>> PARA TROCAR O WHATSAPP OU LIGAR OS PIXELS,
   >>> MEXA SÓ NO BLOCO "CONFIG" ABAIXO.
   ========================================================= */

const CONFIG = {
  // Número do WhatsApp: 55 (Brasil) + DDD + número, só dígitos.
  whatsapp: '5541999917485',

  // Mensagem usada quando o botão não tiver uma própria.
  msgPadrao: 'Olá! Vim pelo site da Marcenaria Costa e gostaria de fazer um orçamento.',

  // Deixe como está para desligar. Para ligar, coloque o ID entre as aspas.
  metaPixelId: '',   // ex.: '123456789012345'
  ga4Id: ''          // ex.: 'G-XXXXXXXXXX'
};

/* ========================================================= */

(function () {
  'use strict';

  const $  = (s, e = document) => e.querySelector(s);
  const $$ = (s, e = document) => Array.from(e.querySelectorAll(s));

  /* ---------- Links do WhatsApp ---------- */
  function linkZap(msg) {
    return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(msg || CONFIG.msgPadrao);
  }

  function rastrear(nome, dados) {
    try { if (window.fbq) window.fbq('track', 'Contact', dados || {}); } catch (e) {}
    try { if (window.gtag) window.gtag('event', 'clique_whatsapp', Object.assign({ origem: nome }, dados || {})); } catch (e) {}
  }

  $$('[data-zap]').forEach(function (el) {
    el.setAttribute('href', linkZap(el.dataset.msg));
    el.setAttribute('target', '_blank');
    el.setAttribute('rel', 'noopener');
    el.addEventListener('click', function () { rastrear(el.dataset.evt || 'link'); });
  });

  /* ---------- Menu mobile ---------- */
  const menuBtn = $('.menu-btn');
  const menu = $('#menu-mobile');

  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function () {
      const aberto = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', String(!aberto));
      menu.hidden = aberto;
    });
    $$('a', menu).forEach(function (a) {
      a.addEventListener('click', function () {
        menuBtn.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
      });
    });
  }

  /* ---------- Filtro da galeria ---------- */
  const itens = $$('.galeria__item');
  const vazio = $('.galeria__vazio');

  $$('.filtro').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $$('.filtro').forEach(function (b) { b.classList.remove('filtro--ativo'); });
      btn.classList.add('filtro--ativo');

      const cat = btn.dataset.filtro;
      let visiveis = 0;

      itens.forEach(function (item) {
        const mostra = cat === 'todos' || item.dataset.cat === cat;
        item.hidden = !mostra;
        if (mostra) visiveis++;
      });

      if (vazio) vazio.hidden = visiveis > 0;
    });
  });

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbImg = $('#lightbox-img');
  const lbLeg = $('#lightbox-legenda');
  let atual = 0;

  function visiveis() { return itens.filter(function (i) { return !i.hidden; }); }

  function abrir(item) {
    const lista = visiveis();
    atual = lista.indexOf(item);
    mostrar();
    lb.hidden = false;
    document.body.classList.add('travado');
    $('.lightbox__fechar').focus();
  }

  function mostrar() {
    const lista = visiveis();
    if (!lista.length) return;
    if (atual < 0) atual = lista.length - 1;
    if (atual >= lista.length) atual = 0;
    const img = $('img', lista[atual]);
    lbImg.src = img.currentSrc || img.src;
    lbImg.alt = img.alt;
    lbLeg.textContent = lista[atual].dataset.legenda || img.alt;
  }

  function fechar() {
    lb.hidden = true;
    document.body.classList.remove('travado');
  }

  if (lb) {
    itens.forEach(function (item) {
      item.addEventListener('click', function () { abrir(item); });
    });
    $('.lightbox__fechar').addEventListener('click', fechar);
    $('.lightbox__nav--ant').addEventListener('click', function () { atual--; mostrar(); });
    $('.lightbox__nav--prox').addEventListener('click', function () { atual++; mostrar(); });
    lb.addEventListener('click', function (e) { if (e.target === lb) fechar(); });
    document.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') fechar();
      if (e.key === 'ArrowLeft') { atual--; mostrar(); }
      if (e.key === 'ArrowRight') { atual++; mostrar(); }
    });

    // Deslizar com o dedo
    let x0 = null;
    lb.addEventListener('touchstart', function (e) { x0 = e.changedTouches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) { atual += dx < 0 ? 1 : -1; mostrar(); }
      x0 = null;
    }, { passive: true });
  }

  /* ---------- Quiz de orçamento ---------- */
  const quiz = $('#quiz');

  if (quiz) {
    const etapas = $$('.quiz__etapa', quiz);
    const barra = $('#quiz-progresso');
    const btnAvancar = $('#quiz-avancar');
    const btnVoltar = $('#quiz-voltar');
    const nav = $('.quiz__nav', quiz);
    const resumo = $('#quiz-resumo');
    const enviar = $('#quiz-enviar');
    let etapa = 0;

    function pintar() {
      etapas.forEach(function (f, i) { f.classList.toggle('quiz__etapa--ativa', i === etapa); });
      barra.style.width = ((etapa + 1) / etapas.length * 100) + '%';
      btnVoltar.hidden = etapa === 0;
      nav.hidden = etapa === etapas.length - 1;
      btnAvancar.textContent = etapa === etapas.length - 2 ? 'Ver resumo' : 'Continuar';
    }

    function valores(nome) {
      return $$('[name="' + nome + '"]', quiz)
        .filter(function (i) { return i.checked; })
        .map(function (i) { return i.value; });
    }

    function texto(nome) {
      const el = $('[name="' + nome + '"]', quiz);
      return el ? el.value.trim() : '';
    }

    function validar() {
      if (etapa === 0 && valores('ambiente').length === 0) {
        alerta('Escolha pelo menos um ambiente para continuar.');
        return false;
      }
      if (etapa === 1 && valores('prazo').length === 0) { alerta('Escolha um prazo.'); return false; }
      if (etapa === 2 && valores('imovel').length === 0) { alerta('Escolha a situação do imóvel.'); return false; }
      if (etapa === 3 && !texto('nome')) {
        alerta('Escreva seu nome para o atendimento.');
        $('[name="nome"]', quiz).focus();
        return false;
      }
      return true;
    }

    function alerta(msg) {
      let el = $('.quiz__erro', etapas[etapa]);
      if (!el) {
        el = document.createElement('p');
        el.className = 'quiz__erro';
        el.setAttribute('role', 'alert');
        el.style.cssText = 'color:#E8A87C;font-size:.83rem;margin:12px 0 0;';
        etapas[etapa].appendChild(el);
      }
      el.textContent = msg;
    }

    function montarMensagem() {
      const amb = valores('ambiente');
      const linhas = [
        'Olá! Vim pelo site da Marcenaria Costa e quero um orçamento.',
        '',
        '• Nome: ' + (texto('nome') || '—'),
        '• Ambientes: ' + (amb.length ? amb.join(', ') : '—'),
        '• Prazo: ' + (valores('prazo')[0] || '—'),
        '• Imóvel: ' + (valores('imovel')[0] || '—'),
        '• Bairro/cidade: ' + (texto('bairro') || '—')
      ];
      const obs = texto('obs');
      if (obs) linhas.push('• Observações: ' + obs);
      return linhas.join('\n');
    }

    function montarResumo() {
      const amb = valores('ambiente');
      resumo.textContent = [
        'Nome: ' + (texto('nome') || '—'),
        'Ambientes: ' + (amb.length ? amb.join(', ') : '—'),
        'Prazo: ' + (valores('prazo')[0] || '—'),
        'Imóvel: ' + (valores('imovel')[0] || '—'),
        'Bairro/cidade: ' + (texto('bairro') || '—')
      ].join('\n');
      enviar.setAttribute('href', linkZap(montarMensagem()));
      enviar.setAttribute('target', '_blank');
      enviar.setAttribute('rel', 'noopener');
    }

    btnAvancar.addEventListener('click', function () {
      if (!validar()) return;
      const erro = $('.quiz__erro', etapas[etapa]);
      if (erro) erro.remove();
      etapa++;
      if (etapa === etapas.length - 1) montarResumo();
      pintar();
      quiz.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    btnVoltar.addEventListener('click', function () {
      etapa = Math.max(0, etapa - 1);
      pintar();
    });

    if (enviar) {
      enviar.addEventListener('click', function () {
        rastrear('quiz', { etapas_concluidas: etapas.length });
        try { if (window.fbq) window.fbq('track', 'Lead'); } catch (e) {}
      });
    }

    // Enter avança no último passo de texto
    $$('input[type="text"]', quiz).forEach(function (i) {
      i.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); btnAvancar.click(); }
      });
    });

    pintar();
  }

  /* ---------- Revelar ao rolar ---------- */
  const alvos = $$('.servico, .passo, .faq__item, .sobre__foto, .sobre__texto, .confianca__grade > div');
  if ('IntersectionObserver' in window && alvos.length) {
    alvos.forEach(function (el) { el.classList.add('revelar'); });
    const obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e, i) {
        if (!e.isIntersecting) return;
        setTimeout(function () { e.target.classList.add('revelar--visivel'); }, i * 55);
        obs.unobserve(e.target);
      });
    }, { rootMargin: '200px 0px -40px 0px', threshold: 0 });
    alvos.forEach(function (el) { obs.observe(el); });

    // Rede de segurança: nada pode ficar invisível se o observer falhar
    // ou se o usuário rolar rápido demais.
    setTimeout(function () {
      alvos.forEach(function (el) { el.classList.add('revelar--visivel'); });
    }, 2500);
  }

  /* ---------- Ano no rodapé ---------- */
  const ano = $('#ano');
  if (ano) ano.textContent = new Date().getFullYear();

  /* ---------- Pixels (só carregam se você preencher o CONFIG) ---------- */
  if (CONFIG.metaPixelId) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CONFIG.metaPixelId);
    window.fbq('track', 'PageView');
  }

  if (CONFIG.ga4Id) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + CONFIG.ga4Id;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CONFIG.ga4Id);
  }
})();
