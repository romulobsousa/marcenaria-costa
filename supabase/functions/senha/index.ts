// =====================================================================
// Marcenaria Costa — trocar a senha da equipe pelo sistema
//
// Isto roda DENTRO do Supabase, não no navegador. A diferença importa:
// trocar a senha de outra pessoa exige a chave secreta do projeto, e
// chave secreta no navegador é chave entregue a quem abrir o site. Aqui
// ela nunca sai do servidor.
//
// Antes de mexer em qualquer coisa a função confere duas vezes:
//   1. quem chamou está mesmo logado (o Supabase valida o token)
//   2. essa pessoa é admin na tabela equipe
// Se falhar em qualquer uma das duas, responde e vai embora.
// =====================================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function resposta(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta(405, { erro: 'Método não aceito.' });

  const url     = Deno.env.get('SUPABASE_URL')!;
  const anon    = Deno.env.get('SUPABASE_ANON_KEY')!;
  const secreta = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const autorizacao = req.headers.get('Authorization') ?? '';
  if (!autorizacao) return resposta(401, { erro: 'Entre no sistema de novo.' });

  // ---- quem está chamando ----
  const comoEle = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false },
  });

  const { data: { user }, error: erroUser } = await comoEle.auth.getUser();
  if (erroUser || !user) return resposta(401, { erro: 'Sua sessão expirou. Entre de novo.' });

  const { data: papel } = await comoEle.rpc('meu_papel');
  if (papel !== 'admin') return resposta(403, { erro: 'Só o admin mexe em senha.' });

  // ---- o que ele quer ----
  let corpo: { acao?: string; id?: string; senha?: string };
  try { corpo = await req.json(); } catch { return resposta(400, { erro: 'Pedido malformado.' }); }

  const admin = createClient(url, secreta, { auth: { persistSession: false } });

  // ------------------------------------------------------------------
  // estado das contas: quem já entrou alguma vez, quem tem e-mail
  // confirmado. É o que explica "digito a senha certa e não entra".
  // ------------------------------------------------------------------
  if (corpo.acao === 'estado') {
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) return resposta(500, { erro: error.message });

    return resposta(200, {
      contas: data.users.map((u) => ({
        id: u.id,
        email: u.email ?? '',
        confirmado: !!(u.email_confirmed_at || u.confirmed_at),
        ultimo_acesso: u.last_sign_in_at ?? null,
      })),
    });
  }

  // ------------------------------------------------------------------
  // trocar a senha
  // ------------------------------------------------------------------
  if (corpo.acao === 'senha') {
    const id = String(corpo.id ?? '');
    const senha = String(corpo.senha ?? '');

    if (!id) return resposta(400, { erro: 'Faltou dizer de quem é a senha.' });
    if (senha.length < 8) return resposta(400, { erro: 'A senha precisa de pelo menos 8 caracteres.' });

    // só mexe em quem está na equipe — não em qualquer conta do projeto
    const { data: pessoa } = await admin
      .from('equipe').select('id, nome, email').eq('id', id).maybeSingle();
    if (!pessoa) return resposta(404, { erro: 'Essa pessoa não está na equipe.' });

    // email_confirm resolve de uma vez o caso mais comum de "senha certa
    // e não entra": conta criada sem confirmar o e-mail
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: senha,
      email_confirm: true,
    });
    if (error) return resposta(400, { erro: error.message });

    return resposta(200, { ok: true, email: pessoa.email, nome: pessoa.nome });
  }

  return resposta(400, { erro: 'Não entendi o pedido.' });
});
