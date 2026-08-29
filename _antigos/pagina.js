/* =====================================================================
   Página do orçamento — o que o cliente abre no celular.

   Um PDF A4 no celular obriga a dar zoom. Esta página é o mesmo
   conteúdo em HTML: lê bem na tela pequena, carrega instantâneo, e
   deixa o PDF num botão para quem quiser guardar o arquivo.

   O HTML sai daqui pronto e autocontido — nada de consulta ao banco
   do lado do cliente, então nenhum dado além deste orçamento fica
   acessível pelo link.
   ===================================================================== */

window.gerarPaginaOrcamento = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dinheiro(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  function dataBR(iso) {
    return new Date(iso || Date.now()).toLocaleDateString('pt-BR',
      { day: '2-digit', month: 'long', year: 'numeric' });
  }
  function validoAte(iso, dias) {
    var d = new Date(iso || Date.now());
    d.setDate(d.getDate() + (Number(dias) || 15));
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  return function gerarPaginaOrcamento(orc, opcoes) {
    opcoes = opcoes || {};
    var emp = (window.CONFIG_ORCAMENTO && window.CONFIG_ORCAMENTO.empresa) || {};
    var num = String(orc.numero || 0).padStart(3, '0');
    var itens = Array.isArray(orc.itens) ? orc.itens : [];

    var subtotal = itens.reduce(function (a, it) {
      return a + (Number(it.qtd) || 0) * (Number(it.valor) || 0);
    }, 0);
    var desconto = Number(orc.desconto) || 0;
    var total = Math.max(0, subtotal - desconto);

    var zap = emp.whatsapp
      ? 'https://wa.me/' + emp.whatsapp + '?text=' +
        encodeURIComponent('Olá! Estou vendo o orçamento nº ' + num + ' e tenho uma dúvida.')
      : null;

    var linhasItens = itens.map(function (it) {
      var qtd = Number(it.qtd) || 0;
      var val = Number(it.valor) || 0;
      return '<article class="movel">' +
        '<h3 class="movel__nome">' + esc(it.descricao || 'Item') + '</h3>' +
        (it.detalhes ? '<p class="movel__det">' + esc(it.detalhes) + '</p>' : '') +
        '<div class="movel__conta">' +
          '<span class="movel__calc">' + qtd + ' × ' + dinheiro(val) + '</span>' +
          '<strong class="movel__total">' + dinheiro(qtd * val) + '</strong>' +
        '</div>' +
      '</article>';
    }).join('');

    var condicoes = [];
    if (orc.prazo_entrega) condicoes.push(['Prazo de entrega', orc.prazo_entrega]);
    if (orc.forma_pagamento) condicoes.push(['Forma de pagamento', orc.forma_pagamento]);
    condicoes.push(['Proposta válida até', validoAte(orc.criado_em, orc.validade_dias)]);

    return '<!doctype html>\n' +
'<html lang="pt-BR">\n' +
'<head>\n' +
'<meta charset="utf-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<meta name="robots" content="noindex, nofollow">\n' +
'<title>Orçamento ' + num + ' · ' + esc(emp.nome || 'Marcenaria') + '</title>\n' +
'<meta property="og:type" content="website">\n' +
'<meta property="og:title" content="Orçamento ' + num + ' — ' + esc(emp.nome || 'Marcenaria') + '">\n' +
'<meta property="og:description" content="' +
  esc((orc.cliente_nome ? orc.cliente_nome + ', s' : 'S') + 'eu orçamento no valor de ' +
      dinheiro(total) + '. Toque para ver os detalhes.') + '">\n' +
(emp.site ? '<meta property="og:image" content="https://' + esc(emp.site) + '/assets/img/og-image.jpg">\n' : '') +
'<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Inter:wght@400;500;600&display=swap">\n' +
'<style>\n' +
':root{--ground:#f7f4ee;--surface:#fffdf9;--surface-2:#f1ece2;--line:#e2dbcc;--ink:#1b1812;--ink-2:#56503f;--ink-3:#8b8371;--latao:#8f6620;--latao-bg:#f3e7d0;--zap:#1faa54}\n' +
'@media(prefers-color-scheme:dark){:root{--ground:#14120d;--surface:#1e1b14;--surface-2:#27231a;--line:#383221;--ink:#f4efe3;--ink-2:#b7af9e;--ink-3:#837c6c;--latao:#d9ae5e;--latao-bg:#2f2717}}\n' +
'*{box-sizing:border-box}\n' +
'body{margin:0;background:var(--ground);color:var(--ink);font-family:Inter,system-ui,-apple-system,sans-serif;font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}\n' +
'.folha{max-width:640px;margin:0 auto;padding:0 18px 56px}\n' +

'.topo{padding:26px 0 20px;border-bottom:3px solid var(--latao);margin-bottom:22px}\n' +
'.marca{font-family:Fraunces,Georgia,serif;font-size:1.55rem;font-weight:600;margin:0;letter-spacing:-.01em}\n' +
'.marca__sub{color:var(--ink-3);font-size:.82rem;margin:3px 0 0}\n' +
'.selo{display:inline-block;margin-top:14px;background:var(--latao-bg);color:var(--latao);font-size:.72rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;padding:5px 11px;border-radius:6px}\n' +
'.num-grande{font-family:Fraunces,Georgia,serif;font-size:1.9rem;font-weight:600;margin:8px 0 0;line-height:1.1}\n' +
'.data{color:var(--ink-3);font-size:.85rem;margin:2px 0 0}\n' +

'.para{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:15px 17px;margin-bottom:24px}\n' +
'.para__rot{font-size:.7rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin:0 0 5px}\n' +
'.para__nome{font-family:Fraunces,Georgia,serif;font-size:1.2rem;font-weight:600;margin:0}\n' +
'.para__dados{color:var(--ink-2);font-size:.87rem;margin:5px 0 0}\n' +

'h2.secao{font-family:Inter,sans-serif;font-size:.72rem;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);margin:0 0 12px}\n' +

'.movel{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 17px;margin-bottom:10px}\n' +
'.movel__nome{font-family:Fraunces,Georgia,serif;font-size:1.13rem;font-weight:600;margin:0;line-height:1.3}\n' +
'.movel__det{color:var(--ink-2);font-size:.9rem;margin:7px 0 0;white-space:pre-wrap}\n' +
'.movel__conta{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-top:13px;padding-top:12px;border-top:1px dashed var(--line)}\n' +
'.movel__calc{color:var(--ink-3);font-size:.85rem;font-variant-numeric:tabular-nums}\n' +
'.movel__total{font-size:1.08rem;font-weight:600;font-variant-numeric:tabular-nums}\n' +

'.somas{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 17px;margin:20px 0 26px}\n' +
'.soma{display:flex;justify-content:space-between;gap:12px;color:var(--ink-2);font-size:.93rem;padding:4px 0;font-variant-numeric:tabular-nums}\n' +
'.soma--total{border-top:1px solid var(--line);margin-top:9px;padding-top:14px;color:var(--ink);align-items:baseline}\n' +
'.soma--total span:first-child{font-size:1rem;font-weight:600}\n' +
'.soma--total strong{font-family:Fraunces,Georgia,serif;font-size:1.75rem;font-weight:600;color:var(--latao);line-height:1.1}\n' +

'.cond{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:6px 17px;margin-bottom:22px}\n' +
'.cond__item{padding:12px 0;border-bottom:1px solid var(--line)}\n' +
'.cond__item:last-child{border-bottom:0}\n' +
'.cond__rot{font-size:.75rem;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--ink-3);margin:0 0 3px}\n' +
'.cond__val{margin:0;font-size:.95rem}\n' +

'.obs{background:var(--surface-2);border-radius:12px;padding:15px 17px;margin-bottom:26px;font-size:.9rem;color:var(--ink-2);white-space:pre-wrap}\n' +

'.acoes{display:flex;flex-direction:column;gap:10px;margin-bottom:30px}\n' +
'.bt{display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none;font-size:1rem;font-weight:600;padding:15px 20px;border-radius:11px;transition:opacity .15s}\n' +
'.bt:active{opacity:.82}\n' +
'.bt--zap{background:var(--zap);color:#fff}\n' +
'.bt--pdf{background:var(--surface);color:var(--ink);border:1px solid var(--line)}\n' +

'.rodape{text-align:center;color:var(--ink-3);font-size:.83rem;line-height:1.7;padding-top:22px;border-top:1px solid var(--line)}\n' +
'.rodape a{color:var(--latao);text-decoration:none}\n' +
'@media(min-width:560px){.acoes{flex-direction:row}.bt{flex:1}}\n' +
'</style>\n' +
'</head>\n' +
'<body>\n' +
'<div class="folha">\n' +

'  <header class="topo">\n' +
'    <h1 class="marca">' + esc(emp.nome || 'Marcenaria') + '</h1>\n' +
(emp.subtitulo || emp.cidade
  ? '    <p class="marca__sub">' + esc(emp.subtitulo || '') +
    (emp.cidade ? (emp.subtitulo ? ' · ' : '') + esc(emp.cidade) : '') + '</p>\n' : '') +
'    <span class="selo">Orçamento</span>\n' +
'    <p class="num-grande">Nº ' + num + '</p>\n' +
'    <p class="data">' + dataBR(orc.criado_em) + '</p>\n' +
'  </header>\n' +

'  <section class="para">\n' +
'    <p class="para__rot">Para</p>\n' +
'    <p class="para__nome">' + esc(orc.cliente_nome || 'Cliente') + '</p>\n' +
(orc.cliente_endereco ? '    <p class="para__dados">' + esc(orc.cliente_endereco) + '</p>\n' : '') +
'  </section>\n' +

'  <h2 class="secao">' + (itens.length === 1 ? 'O móvel' : 'Os móveis') + '</h2>\n' +
linhasItens +

'  <section class="somas">\n' +
(desconto > 0
  ? '    <div class="soma"><span>Subtotal</span><span>' + dinheiro(subtotal) + '</span></div>\n' +
    '    <div class="soma"><span>Desconto</span><span>- ' + dinheiro(desconto) + '</span></div>\n'
  : '') +
'    <div class="soma soma--total"><span>Total</span><strong>' + dinheiro(total) + '</strong></div>\n' +
'  </section>\n' +

'  <h2 class="secao">Condições</h2>\n' +
'  <section class="cond">\n' +
condicoes.map(function (c) {
  return '    <div class="cond__item"><p class="cond__rot">' + esc(c[0]) + '</p>' +
         '<p class="cond__val">' + esc(c[1]) + '</p></div>\n';
}).join('') +
'  </section>\n' +

(orc.observacoes ? '  <div class="obs">' + esc(orc.observacoes) + '</div>\n' : '') +

'  <div class="acoes">\n' +
(zap ? '    <a class="bt bt--zap" href="' + zap + '">Falar sobre o orçamento</a>\n' : '') +
(opcoes.linkPdf ? '    <a class="bt bt--pdf" href="' + esc(opcoes.linkPdf) + '" download>Baixar em PDF</a>\n' : '') +
'  </div>\n' +

'  <footer class="rodape">\n' +
'    ' + esc(emp.nome || '') + (emp.telefone ? '<br>' + esc(emp.telefone) : '') +
(emp.site ? '<br><a href="https://' + esc(emp.site) + '">' + esc(emp.site) + '</a>' : '') +
(emp.documento ? '<br>' + esc(emp.documento) : '') + '\n' +
'  </footer>\n' +

'</div>\n' +
'</body>\n' +
'</html>';
  };
})();
