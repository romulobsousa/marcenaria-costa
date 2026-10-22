/* =====================================================================
   Contrato — nasce do orçamento, não de um formulário novo.

   Tudo que o contrato precisa já está no orçamento: cliente, móveis,
   valor, forma de pagamento, prazo. O que falta (CPF do cliente e os
   dados da marcenaria) o sistema cobra antes de gerar, em vez de
   imprimir um contrato com lacuna.

   IMPORTANTE: isto é um MODELO. Vale a pena mandar um advogado ler uma
   vez — depois disso ele serve para sempre, é o mesmo texto em todo
   contrato. Quem vende para consumidor está sob o Código de Defesa do
   Consumidor, e cláusula abusiva não vale nem que esteja assinada.
   ===================================================================== */

window.gerarContrato = (function () {
  'use strict';

  var TINTA   = [27, 24, 18];
  var TINTA_2 = [86, 80, 63];
  var TINTA_3 = [139, 131, 113];
  var LATAO   = [143, 102, 32];
  var LINHA   = [214, 205, 188];
  var FUNDO   = [246, 242, 234];

  var M = 56;              // margem — contrato pede respiro maior
  var L = 595.28;          // A4 em pt
  var A = 841.89;
  var UTIL = L - M * 2;

  function dinheiro(v) {
    return 'R$ ' + (Number(v) || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2, maximumFractionDigits: 2
    });
  }

  function porExtenso(v) {
    // sem biblioteca: só os reais, que é o que importa na conferência
    var n = Math.floor(Number(v) || 0);
    var U = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
             'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis',
             'dezessete', 'dezoito', 'dezenove'];
    var D = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta',
             'setenta', 'oitenta', 'noventa'];
    var C = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
             'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

    function ate999(x) {
      if (x === 0) return '';
      if (x === 100) return 'cem';
      var partes = [];
      var c = Math.floor(x / 100), r = x % 100;
      if (c) partes.push(C[c]);
      if (r < 20) { if (r) partes.push(U[r]); }
      else {
        var d = Math.floor(r / 10), u = r % 10;
        partes.push(D[d] + (u ? ' e ' + U[u] : ''));
      }
      return partes.join(' e ');
    }

    if (n === 0) return 'zero reais';
    var mil = Math.floor(n / 1000), resto = n % 1000;
    var txt = '';
    if (mil) txt += (mil === 1 ? 'mil' : ate999(mil) + ' mil');
    if (resto) txt += (txt ? (resto < 100 ? ' e ' : ' ') : '') + ate999(resto);
    return txt + (n === 1 ? ' real' : ' reais');
  }

  function dataPorExtenso(d) {
    var meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
                 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function dataCurta(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }

  /* ---------------- o que falta para poder gerar ---------------- */
  function oQueFalta(orc, cfg) {
    var c = (cfg.contrato && cfg.contrato.contratada) || {};
    var faltas = [];

    /* os quatro campos da marcenaria viram UMA reclamação só: listar os
       quatro separados faz um aviso que ninguém lê até o fim */
    var ROTULO = { nome: 'razão social', documento: 'CNPJ', endereco: 'endereço',
                   representante: 'quem assina' };
    var semConfig = ['nome', 'documento', 'endereco', 'representante'].filter(function (campo) {
      var v = String(c[campo] || '');
      return !v || /COLE AQUI/i.test(v);
    });
    if (semConfig.length) {
      faltas.push('preencher os dados da marcenaria em sistema/config.js (' +
        semConfig.map(function (k) { return ROTULO[k]; }).join(', ') + ')');
    }

    if (!String(orc.cliente_nome || '').trim())      faltas.push('nome do cliente');
    if (!String(orc.cliente_documento || '').trim()) faltas.push('CPF ou CNPJ do cliente');
    if (!String(orc.cliente_endereco || '').trim())  faltas.push('endereço do cliente');

    var itens = (Array.isArray(orc.itens) ? orc.itens : [])
      .filter(function (it) { return (it.descricao || '').trim(); });
    if (!itens.length) faltas.push('pelo menos um móvel no orçamento');

    return faltas;
  }

  return function gerarContrato(orc, opcoes) {
    opcoes = opcoes || {};
    var cfg = window.CONFIG_ORCAMENTO || {};
    var emp = cfg.empresa || {};
    var K = cfg.contrato || {};
    var C = K.contratada || {};

    var faltas = oQueFalta(orc, cfg);
    if (faltas.length) {
      var e = new Error('Falta ' + faltas.join('; ') + '.');
      e.faltas = faltas;
      throw e;
    }

    var jsPDFctor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFctor) throw new Error('Biblioteca de PDF não carregou. Recarregue a página.');

    var doc = new jsPDFctor({ unit: 'pt', format: 'a4', compress: true });
    var y = 0;

    /* ---------------- motor de texto ---------------- */
    function espaco(n) { y += n; }

    function quebraSePreciso(altura) {
      if (y + altura <= A - 70) return;
      doc.addPage();
      y = M;
    }

    function escreve(texto, op) {
      op = op || {};
      var tam   = op.tamanho || 9.5;
      var fonte = op.fonte || 'helvetica';
      var peso  = op.peso || 'normal';
      var cor   = op.cor || TINTA_2;
      var recuo = op.recuo || 0;
      var largura = UTIL - recuo;

      doc.setFont(fonte, peso);
      doc.setFontSize(tam);
      doc.setTextColor(cor[0], cor[1], cor[2]);

      var linhas = doc.splitTextToSize(String(texto), largura);
      var alturaLinha = tam * 1.45;

      linhas.forEach(function (linha) {
        quebraSePreciso(alturaLinha);
        doc.setFont(fonte, peso);
        doc.setFontSize(tam);
        doc.setTextColor(cor[0], cor[1], cor[2]);
        doc.text(linha, M + recuo, y);
        y += alturaLinha;
      });
    }

    function titulo(texto) {
      espaco(12);
      quebraSePreciso(40);
      escreve(texto, { tamanho: 9, peso: 'bold', cor: TINTA, fonte: 'helvetica' });
      espaco(3);
    }

    function paragrafo(texto, op) {
      escreve(texto, op);
      espaco(6);
    }

    /* ---------------- cabeçalho ---------------- */
    var logo = window.LOGO_ORCAMENTO;
    doc.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]);
    doc.rect(0, 0, L, logo ? 118 : 96, 'F');
    doc.setFillColor(LATAO[0], LATAO[1], LATAO[2]);
    doc.rect(0, 0, L, 3, 'F');

    if (logo) {
      var larg = 104;
      try { doc.addImage(logo.dados, 'JPEG', M, 20, larg, larg * logo.altura / logo.largura); }
      catch (x) { logo = null; }
    }
    if (!logo) {
      doc.setFont('times', 'bold'); doc.setFontSize(19);
      doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
      doc.text(emp.nome || 'Marcenaria', M, 48);
    }

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(LATAO[0], LATAO[1], LATAO[2]);
    doc.text('CONTRATO', L - M, 40, { align: 'right' });

    doc.setFont('times', 'bold'); doc.setFontSize(17);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text('Nº ' + String(orc.numero || 0).padStart(3, '0'), L - M, 60, { align: 'right' });

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
    doc.text(dataCurta(new Date().toISOString()), L - M, 74, { align: 'right' });

    y = (logo ? 118 : 96) + 34;

    doc.setFont('times', 'bold'); doc.setFontSize(13);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    var tituloDoc = doc.splitTextToSize(
      'CONTRATO DE FORNECIMENTO E INSTALAÇÃO DE MÓVEIS SOB MEDIDA', UTIL);
    tituloDoc.forEach(function (linha) {
      doc.text(linha, L / 2, y, { align: 'center' });
      y += 17;
    });
    espaco(14);

    /* ---------------- as partes ---------------- */
    titulo('AS PARTES');

    /* empresa se escreve "inscrita", pessoa "inscrito" — e quem assina
       por si mesmo não precisa de representante nenhum */
    var ehEmpresa = /CNPJ/i.test(C.documento);
    var repr = String(C.representante || '').trim();
    var semRepr = !repr || /^(o pr[óo]prio|ele mesmo|eu mesmo|n\/a|-)$/i.test(repr);

    paragrafo('CONTRATADA: ' + C.nome + (ehEmpresa ? ', inscrita sob o ' : ', inscrito sob o ') +
      C.documento + ', com endereço em ' + C.endereco +
      (semRepr ? '' : ', neste ato representada por ' + repr) + '.');

    paragrafo('CONTRATANTE: ' + orc.cliente_nome + ', inscrito sob o ' +
      orc.cliente_documento + ', com endereço em ' + orc.cliente_endereco +
      (orc.cliente_telefone ? ', telefone ' + orc.cliente_telefone : '') + '.');

    paragrafo('As partes acima, de comum acordo, celebram o presente contrato, ' +
      'que se regerá pelas cláusulas a seguir e, no que couber, pelo Código Civil ' +
      'e pelo Código de Defesa do Consumidor.');

    /* ---------------- 1. objeto ---------------- */
    titulo('CLÁUSULA 1ª — DO OBJETO');
    paragrafo('A CONTRATADA se obriga a projetar, fabricar, entregar e instalar, no ' +
      'endereço do CONTRATANTE, os móveis sob medida descritos abaixo, conforme ' +
      'o orçamento nº ' + String(orc.numero || 0).padStart(3, '0') +
      ', que integra este contrato para todos os efeitos:');
    espaco(2);

    var itens = (Array.isArray(orc.itens) ? orc.itens : [])
      .filter(function (it) { return (it.descricao || '').trim(); });

    var subtotal = 0;
    itens.forEach(function (it, i) {
      var qtd = Number(it.qtd) || 0, val = Number(it.valor) || 0;
      subtotal += qtd * val;

      quebraSePreciso(34);
      escreve((i + 1) + '. ' + it.descricao + '  —  ' + qtd +
              (qtd === 1 ? ' unidade' : ' unidades') + '  —  ' + dinheiro(qtd * val),
              { peso: 'bold', cor: TINTA, recuo: 10 });
      if (it.detalhes) {
        escreve(it.detalhes, { tamanho: 8.8, cor: TINTA_3, recuo: 22 });
      }
      espaco(5);
    });

    espaco(4);
    paragrafo('§ 1º As medidas finais serão conferidas pela CONTRATADA no local, ' +
      'antes do início da fabricação. Diferença entre a medida conferida e a que ' +
      'serviu de base ao orçamento pode alterar valor e prazo, sempre mediante ' +
      'aviso e concordância prévia do CONTRATANTE, por escrito.');
    paragrafo('§ 2º Cor, acabamento, ferragens e puxadores são os definidos no ' +
      'projeto aprovado. Pequenas variações de tonalidade da madeira e do MDF são ' +
      'próprias do material e não caracterizam defeito.');

    /* o que as partes combinaram à parte entra como parágrafo do objeto:
       se foi combinado, tem que estar escrito */
    if (String(orc.observacoes || '').trim()) {
      paragrafo('§ 3º Fica ainda acordado: ' + String(orc.observacoes).trim());
    }

    /* ---------------- 2. preço ---------------- */
    var desconto = Number(orc.desconto) || 0;
    var total = Math.max(0, subtotal - desconto);

    titulo('CLÁUSULA 2ª — DO PREÇO E DA FORMA DE PAGAMENTO');

    if (desconto > 0) {
      paragrafo('O valor dos móveis é de ' + dinheiro(subtotal) + ', com desconto de ' +
        dinheiro(desconto) + ', totalizando ' + dinheiro(total) + ' (' +
        porExtenso(total) + ').');
    } else {
      paragrafo('O valor total é de ' + dinheiro(total) + ' (' + porExtenso(total) + ').');
    }

    if (orc.forma_pagamento) {
      paragrafo('Forma de pagamento: ' + orc.forma_pagamento + '.');
    }

    paragrafo('§ 1º O valor acima cobre projeto, materiais, fabricação, entrega e ' +
      'instalação, e não será reajustado durante a execução, salvo alteração pedida ' +
      'pelo CONTRATANTE na forma da Cláusula 6ª.');
    if (K.multas) {
      paragrafo('§ 2º Parcela paga com atraso terá multa de 2% e juros de ' +
        (K.juros_mes || 1) + '% ao mês, calculados pro rata.');
    }

    /* ---------------- 3. prazo ---------------- */
    titulo('CLÁUSULA 3ª — DO PRAZO');

    if (orc.entrega_em) {
      paragrafo('A CONTRATADA entregará e instalará os móveis até ' +
        dataCurta(orc.entrega_em) + '.');
    } else if (orc.prazo_entrega) {
      paragrafo('Prazo de entrega e instalação: ' + orc.prazo_entrega + '.');
    } else {
      paragrafo('Prazo de entrega e instalação a ser definido entre as partes, por escrito.');
    }

    paragrafo('§ 1º O prazo começa a contar da aprovação do projeto final pelo ' +
      'CONTRATANTE e da confirmação do pagamento inicial, o que ocorrer por último.');
    paragrafo('§ 2º O prazo fica suspenso enquanto o local não estiver em condições ' +
      'de receber a instalação (obra, pintura, elétrica, hidráulica ou piso ' +
      'inacabados), pelo tempo que durar o impedimento.');

    /* ---------------- 4. obrigações da contratada ---------------- */
    titulo('CLÁUSULA 4ª — DO QUE CABE À CONTRATADA');
    paragrafo('a) executar os móveis conforme o projeto aprovado, com os materiais ' +
      'especificados;\n' +
      'b) conferir as medidas no local antes de fabricar;\n' +
      'c) entregar e instalar dentro do prazo da Cláusula 3ª;\n' +
      'd) retirar do local as sobras e embalagens geradas pela instalação;\n' +
      'e) responder pela garantia da Cláusula 7ª;\n' +
      'f) reparar danos que sua equipe causar ao imóvel durante a instalação.',
      { recuo: 10 });

    /* ---------------- 5. obrigações do contratante ---------------- */
    titulo('CLÁUSULA 5ª — DO QUE CABE AO CONTRATANTE');
    paragrafo('a) aprovar o projeto por escrito antes do início da fabricação;\n' +
      'b) efetuar os pagamentos nas datas combinadas;\n' +
      'c) deixar o local pronto e livre para a instalação, com energia elétrica ' +
      'disponível e os pontos de água, gás e elétrica já posicionados conforme o projeto;\n' +
      'd) garantir o acesso da equipe no dia combinado e, em condomínio, providenciar ' +
      'a autorização de entrada;\n' +
      'e) conferir os móveis no ato da instalação e apontar de imediato o que estiver ' +
      'em desacordo.',
      { recuo: 10 });

    /* ---------------- 6. alterações ---------------- */
    titulo('CLÁUSULA 6ª — DAS ALTERAÇÕES DO PROJETO');
    paragrafo('Alteração pedida depois da aprovação do projeto só será executada se ' +
      'as partes acertarem, por escrito, o novo valor e o novo prazo. Se a fabricação ' +
      'já tiver começado, o material já produzido ou comprado para o item alterado ' +
      'será cobrado do CONTRATANTE.');

    /* ---------------- 7. garantia ---------------- */
    var gm = K.garantia_meses || 12;
    titulo('CLÁUSULA 7ª — DA GARANTIA');
    paragrafo('A CONTRATADA garante os móveis por ' + gm + ' (' +
      porExtenso(gm).replace(' reais', '').replace(' real', '') + ') meses, ' +
      'contados da instalação, contra defeito de fabricação, de material e de ' +
      'montagem. Esta garantia é somada à garantia legal do Código de Defesa do ' +
      'Consumidor, não a substitui.');
    paragrafo('§ 1º A garantia cobre: estrutura, ferragens, corrediças, dobradiças, ' +
      'desalinhamento de portas e gavetas e descolamento de fita de borda.');
    paragrafo('§ 2º A garantia não cobre: mau uso, peso acima do previsto, infiltração ' +
      'e umidade vindas do imóvel, risco e batida após a entrega, limpeza com produto ' +
      'abrasivo, e intervenção feita por terceiros nos móveis.');
    paragrafo('§ 3º Chamado de garantia será atendido em até 10 dias úteis do aviso ' +
      'do CONTRATANTE.');

    /* ---------------- 8. atraso ---------------- */
    /* Sem multa (contrato.multas = false) a cláusula não some: ela diz o
       que acontece, que é o que a lei já garante ao consumidor. Vale
       escrever — assim o cliente sabe o caminho e não inventa outro. */
    titulo('CLÁUSULA 8ª — DO ATRASO');
    if (K.multas) {
      paragrafo('Atrasando a entrega por causa que lhe seja imputável, a CONTRATADA ' +
        'pagará multa de ' + (K.multa_atraso || 0.5) + '% do valor do contrato por dia ' +
        'de atraso, limitada a ' + (K.teto_atraso || 10) + '% do total. Não contam como ' +
        'atraso os dias de suspensão previstos no § 2º da Cláusula 3ª, nem caso fortuito ' +
        'ou força maior.');
    } else {
      paragrafo('Havendo atraso por causa imputável à CONTRATADA, ela comunicará o ' +
        'CONTRATANTE e informará a nova data. O CONTRATANTE poderá, à sua escolha, ' +
        'aguardar o cumprimento na nova data ou desfazer o contrato, recebendo de volta ' +
        'tudo o que houver pago, na forma do art. 35 do Código de Defesa do Consumidor. ' +
        'Não contam como atraso os dias de suspensão previstos no § 2º da Cláusula 3ª, ' +
        'nem caso fortuito ou força maior.');
    }

    /* ---------------- 9. rescisão ---------------- */
    titulo('CLÁUSULA 9ª — DA DESISTÊNCIA E DA RESCISÃO');
    paragrafo('§ 1º Tendo este contrato sido assinado fora do estabelecimento da ' +
      'CONTRATADA, o CONTRATANTE pode desistir em até 7 (sete) dias corridos contados ' +
      'da assinatura, com devolução integral do que houver pago, na forma do art. 49 ' +
      'do Código de Defesa do Consumidor.');
    if (K.multas) {
      paragrafo('§ 2º Passado esse prazo, a parte que desistir pagará à outra multa de ' +
        (K.multa_rescisao || 20) + '% sobre o valor do contrato, além do custo do ' +
        'material já comprado e da mão de obra já empregada, comprovados.');
      paragrafo('§ 3º A multa do § 2º vale igualmente para as duas partes.');
    } else {
      paragrafo('§ 2º Passado esse prazo, a parte que desistir ressarcirá à outra o ' +
        'material já comprado e a mão de obra já empregada até ali, mediante ' +
        'comprovação. Não há multa de desistência para nenhuma das partes.');
    }

    /* ---------------- 10. foro ---------------- */
    titulo('CLÁUSULA 10ª — DO FORO');
    paragrafo('As partes elegem o foro de ' + (K.foro || 'Curitiba, Paraná') +
      ' para as questões deste contrato, ressalvado o direito do CONTRATANTE, ' +
      'como consumidor, de propor ação no foro do seu domicílio.');

    /* ---------------- fecho ---------------- */
    espaco(16);
    quebraSePreciso(120);
    paragrafo('E por estarem de acordo, as partes assinam este contrato ' +
      'eletronicamente, em via única, com a mesma validade do documento assinado ' +
      'de próprio punho.');

    espaco(6);
    paragrafo((emp.cidade ? String(emp.cidade).split('·')[0].trim() + ', ' : '') +
      dataPorExtenso(new Date()) + '.');

    espaco(26);
    quebraSePreciso(90);

    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
    doc.setLineWidth(0.7);

    var meio = L / 2;
    doc.line(M, y, meio - 14, y);
    doc.line(meio + 14, y, L - M, y);
    y += 13;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    doc.setTextColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.text(doc.splitTextToSize(C.nome, meio - M - 20), M, y);
    doc.text(doc.splitTextToSize(orc.cliente_nome, meio - M - 20), meio + 14, y);
    y += 12;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
    doc.text('CONTRATADA  ·  ' + C.documento, M, y);
    doc.text('CONTRATANTE  ·  ' + orc.cliente_documento, meio + 14, y);

    /* ---------------- rodapé em todas as páginas ---------------- */
    var paginas = doc.internal.getNumberOfPages();
    for (var p = 1; p <= paginas; p++) {
      doc.setPage(p);
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]);
      doc.setLineWidth(0.5);
      doc.line(M, A - 46, L - M, A - 46);

      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(TINTA_3[0], TINTA_3[1], TINTA_3[2]);
      doc.text('Contrato nº ' + String(orc.numero || 0).padStart(3, '0') +
               '  ·  ' + C.nome, M, A - 32);
      doc.text(p + ' de ' + paginas, L - M, A - 32, { align: 'right' });
    }

    var nome = 'contrato-' + String(orc.numero || 0).padStart(3, '0') + '-' +
      String(orc.cliente_nome || 'cliente').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pdf';

    if (opcoes.retornarBlob) {
      return { blob: doc.output('blob'), nome: nome, total: total };
    }
    doc.save(nome);
    return { nome: nome, total: total };
  };
})();
