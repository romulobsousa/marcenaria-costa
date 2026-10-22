/* =====================================================================
   CONFIGURAÇÃO — mexa só aqui.

   Os dois valores do Supabase:

     CHAVE →  Settings (engrenagem) → API Keys
              Copie a "anon public" OU a "Publishable key" (sb_publishable_...)
              NUNCA a service_role nem as Secret keys.

     URL   →  Settings → API → Project URL
              Ou monte a partir do endereço do painel:
              supabase.com/dashboard/project/SEU_ID  →  https://SEU_ID.supabase.co

   A chave publishable/anon é pública de propósito, pode ficar aqui. Quem
   protege os dados é o RLS que o banco.sql ativou: sem login, o banco não
   devolve nada.
   ===================================================================== */

window.CONFIG_ORCAMENTO = {

  SUPABASE_URL:   'https://obbqlnjnicvngexkpypx.supabase.co',
  SUPABASE_CHAVE: 'sb_publishable_zQL334gzjN9yDMOfe396NQ_VwFoc2fe',

  /* ---- dados que saem no PDF ---- */
  empresa: {
    nome:      'Marcenaria Costa',
    subtitulo: 'Móveis planejados sob medida',
    cidade:    'Curitiba · PR',
    telefone:  '(41) 99991-7485',
    whatsapp:  '5541999917485',
    site:      'marcenariacosta.com.br',
    email:     '',
    documento: ''          // CNPJ ou CPF, se quiser que apareça
  },

  /* =====================================================================
     CONTRATO — preencha uma vez, vale para todos

     Quem assina com o cliente é a marcenaria dos irmãos, então os dados
     aqui são os DELES: é o nome e o documento deles que vão no papel, e
     é deles a responsabilidade pela entrega e pela garantia.

     Sem esses dados preenchidos o sistema não gera o contrato — um
     contrato com "COLE AQUI" no lugar do CNPJ não serve para nada.
     ===================================================================== */
  contrato: {
    contratada: {
      nome:         'COLE AQUI a razão social da marcenaria',
      documento:    'COLE AQUI o CNPJ (ou CPF, se não tiver empresa)',
      endereco:     'COLE AQUI rua, número, bairro, cidade/UF, CEP',
      representante: 'COLE AQUI o nome de quem assina pela marcenaria'
    },

    garantia_meses:  12,     // garantia contra defeito de fabricação e montagem
    multa_atraso:    0.5,    // % por dia de atraso, limitada ao teto abaixo
    teto_atraso:     10,     // % — até onde a multa de atraso pode chegar
    multa_rescisao:  20,     // % se uma das partes desistir depois de assinado
    juros_mes:       1,      // % ao mês sobre parcela em atraso
    foro:            'Curitiba, Paraná'
  },

  /* ---- textos que já vêm preenchidos num orçamento novo ---- */
  padroes: {
    validade_dias:   15,
    prazo_entrega:   '30 a 45 dias úteis após aprovação do projeto',
    forma_pagamento: '50% na aprovação do projeto e 50% na entrega',
    observacoes:     'Valores incluem projeto, materiais, montagem e instalação.\n' +
                     'Alterações no projeto após a aprovação podem alterar prazo e valor.'
  }
};
