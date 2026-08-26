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

  SUPABASE_URL:   'COLE_AQUI_A_URL',
  SUPABASE_CHAVE: 'COLE_AQUI_A_CHAVE_ANON',

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

  /* ---- textos que já vêm preenchidos num orçamento novo ---- */
  padroes: {
    validade_dias:   15,
    prazo_entrega:   '30 a 45 dias úteis após aprovação do projeto',
    forma_pagamento: '50% na aprovação do projeto e 50% na entrega',
    observacoes:     'Valores incluem projeto, materiais, montagem e instalação.\n' +
                     'Alterações no projeto após a aprovação podem alterar prazo e valor.'
  }
};
