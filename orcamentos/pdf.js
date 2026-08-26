/* =====================================================================
   Geração do PDF do orçamento.
   Desenhado ponto a ponto com jsPDF: o texto sai selecionável e o
   arquivo fica leve (uns 30 KB), diferente de "printar" a tela.
   ===================================================================== */

window.gerarPDF = (function () {
  'use strict';

  var TINTA      = [27, 24, 18];
  var TINTA_2    = [86, 80, 63];
  var TINTA_3    = [139, 131, 113];
  var LATAO      = [143, 102, 32];
  var LINHA      = [214, 205, 188];
  var FUNDO_SUAVE= [246, 242, 234];

  var M = 42;              // margem
  var L = 595.28;          // largura A4 em pt
  var A = 841.89;          // altura A4 em pt

  function dinheiro(v) {
    return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function dataBR(iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function somaDias(iso, dias) {
    var d = iso ? new Date(iso) : new Date();
    d.setDate(d.getDate() + (Number(dias) || 0));
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function limpaTel(t) { return String(t || '').replace(/\D/g, ''); }

  return function gerarPDF(orc, opcoes) {
    opcoes = opcoes || {};
    var emp = (window.CONFIG_ORCAMENTO && window.CONFIG_ORCAMENTO.empresa) || {};
    var jsPDFctor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFctor) throw new Error('Biblioteca de PDF não carregou. Verifique sua conexão e recarregue a página.');

    var doc = new jsPDFctor({ unit: 'pt', format: 'a4', compress: true });
    var y = 0;

    /* ---------------- cabeçalho ---------------- */
    doc.setFillColor(FUNDO_SUAVE[0], FUNDO_SUAVE[1], FUNDO_SUAVE[2]);
    doc.rect(0, 0, L, 108, 'F');
    doc.setFillColor(LATAO[0], LATAO[1], LATAO[2]);
    doc.rect(0, 0, L, 3, 'F');

    doc.setFont('times', 'bold');
    doc.setFontSize(21);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text(emp.nome || 'Marcenaria', M, 46);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
    doc.text((emp.subtitulo || '') + (emp.cidade ? '  ·  ' + emp.cidade : ''), M, 62);

    var contato = [];
    if (emp.telefone) contato.push(emp.telefone);
    if (emp.site) contato.push(emp.site);
    if (emp.email) contato.push(emp.email);
    if (emp.documento) contato.push(emp.documento);
    doc.text(contato.join('   ·   '), M, 76);

    // bloco do número, à direita
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(LATAO[0], LATAO[1], LATAO[2]);
    doc.text('ORÇAMENTO', L - M, 42, { align: 'right' });

    doc.setFont('times', 'bold');
    doc.setFontSize(19);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text('Nº ' + String(orc.numero || 0).padStart(3, '0'), L - M, 62, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
    doc.text(dataBR(orc.criado_em), L - M, 76, { align: 'right' });

    y = 140;

    /* ---------------- cliente ---------------- */
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
    doc.text('PARA', M, y);
    y += 15;

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text(orc.cliente_nome || 'Cliente', M, y);
    y += 15;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
    var dadosCli = [];
    if (orc.cliente_telefone) dadosCli.push(orc.cliente_telefone);
    if (orc.cliente_email) dadosCli.push(orc.cliente_email);
    if (orc.cliente_endereco) dadosCli.push(orc.cliente_endereco);
    if (dadosCli.length) { doc.text(dadosCli.join('   ·   '), M, y); y += 14; }

    y += 12;

    /* ---------------- tabela de itens ---------------- */
    var COL_DESC = M;
    var COL_QTD  = 348;
    var COL_UNIT = 408;
    var COL_TOT  = L - M;

    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
    doc.setLineWidth(0.8);
    doc.line(M, y, L - M, y);
    y += 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
    doc.text('MÓVEL', COL_DESC, y);
    doc.text('QTD', COL_QTD, y, { align: 'right' });
    doc.text('VALOR UNIT.', COL_UNIT + 52, y, { align: 'right' });
    doc.text('TOTAL', COL_TOT, y, { align: 'right' });
    y += 8;
    doc.setLineWidth(0.5);
    doc.line(M, y, L - M, y);
    y += 16;

    var itens = Array.isArray(orc.itens) ? orc.itens : [];
    var subtotal = 0;

    itens.forEach(function (it) {
      var qtd = Number(it.qtd) || 0;
      var val = Number(it.valor) || 0;
      var tot = qtd * val;
      subtotal += tot;

      // quebra de página
      if (y > A - 210) {
        doc.addPage();
        y = M + 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
      var desc = doc.splitTextToSize(it.descricao || 'Item', COL_QTD - COL_DESC - 24);
      doc.text(desc, COL_DESC, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
      doc.text(String(qtd), COL_QTD, y, { align: 'right' });
      doc.text(dinheiro(val), COL_UNIT + 52, y, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
      doc.text(dinheiro(tot), COL_TOT, y, { align: 'right' });

      var alturaDesc = desc.length * 12;
      y += alturaDesc;

      if (it.detalhes) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
        var det = doc.splitTextToSize(it.detalhes, COL_QTD - COL_DESC - 24);
        det.forEach(function (linha) {
          if (y > A - 190) { doc.addPage(); y = M + 20; }
          doc.text(linha, COL_DESC, y + 2);
          y += 11;
        });
        y += 2;
      }

      y += 8;
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
      doc.setLineWidth(0.4);
      doc.line(M, y, L - M, y);
      y += 15;
    });

    /* ---------------- totais ---------------- */
    if (y > A - 190) { doc.addPage(); y = M + 20; }

    var desconto = Number(orc.desconto) || 0;
    var total = Math.max(0, subtotal - desconto);
    var xRot = 360;

    if (desconto > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
      doc.text('Subtotal', xRot, y);
      doc.text(dinheiro(subtotal), COL_TOT, y, { align: 'right' });
      y += 16;
      doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
      doc.text('Desconto', xRot, y);
      doc.text('- ' + dinheiro(desconto), COL_TOT, y, { align: 'right' });
      y += 18;
    }

    doc.setFillColor(FUNDO_SUAVE[0], FUNDO_SUAVE[1], FUNDO_SUAVE[2]);
    doc.roundedRect(xRot - 16, y - 14, L - M - xRot + 16, 38, 5, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
    doc.text('TOTAL', xRot, y + 5);
    doc.setFont('times', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(LATAO[0], LATAO[1], LATAO[2]);
    doc.text(dinheiro(total), COL_TOT, y + 8, { align: 'right' });
    y += 48;

    /* ---------------- condições ---------------- */
    var cond = [];
    if (orc.prazo_entrega) cond.push(['Prazo de entrega', orc.prazo_entrega]);
    if (orc.forma_pagamento) cond.push(['Forma de pagamento', orc.forma_pagamento]);
    cond.push(['Validade desta proposta', somaDias(orc.criado_em, orc.validade_dias || 15) +
               ' (' + (orc.validade_dias || 15) + ' dias)']);

    if (cond.length) {
      if (y > A - 170) { doc.addPage(); y = M + 20; }
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
      doc.setLineWidth(0.8);
      doc.line(M, y, L - M, y);
      y += 18;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
      doc.text('CONDIÇÕES', M, y);
      y += 15;

      cond.forEach(function (c) {
        if (y > A - 120) { doc.addPage(); y = M + 20; }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
        doc.text(c[0], M, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
        var txt = doc.splitTextToSize(String(c[1]), L - M - 178);
        doc.text(txt, M + 160, y);
        y += Math.max(14, txt.length * 12) + 4;
      });
      y += 6;
    }

    if (orc.observacoes) {
      if (y > A - 130) { doc.addPage(); y = M + 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
      doc.text('OBSERVAÇÕES', M, y);
      y += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(TINTA_2[0], TINTA_2[1], TINTA_2[2]);
      var obs = doc.splitTextToSize(String(orc.observacoes), L - 2 * M);
      obs.forEach(function (linha) {
        if (y > A - 100) { doc.addPage(); y = M + 20; }
        doc.text(linha, M, y);
        y += 12;
      });
    }

    /* ---------------- rodapé em todas as páginas ---------------- */
    var paginas = doc.internal.getNumberOfPages();
    for (var p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
      doc.setLineWidth(0.5);
      doc.line(M, A - 52, L - M, A - 52);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
      doc.text((emp.nome || '') + (emp.telefone ? '  ·  ' + emp.telefone : '') +
               (emp.site ? '  ·  ' + emp.site : ''), M, A - 36);
      if (paginas > 1) {
        doc.text('Página ' + p + ' de ' + paginas, L - M, A - 36, { align: 'right' });
      }
    }

    var nome = 'Orcamento-' + String(orc.numero || 0).padStart(3, '0') +
               (orc.cliente_nome ? '-' + orc.cliente_nome.trim().split(/\s+/)[0] : '') + '.pdf';
    nome = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]/g, '');

    if (opcoes.retornarBlob) return { blob: doc.output('blob'), nome: nome, total: total };
    doc.save(nome);
    return { nome: nome, total: total };
  };
})();
