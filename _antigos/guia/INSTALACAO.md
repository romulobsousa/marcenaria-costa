# Sistema de orçamentos — como ligar

São 3 etapas e leva uns 15 minutos. Você faz uma vez só.

---

## 1. Criar o banco no Supabase (grátis)

1. Entre em **[supabase.com](https://supabase.com)** e crie uma conta (dá para entrar com o GitHub).
2. Clique em **New project**:
   - **Name**: `marcenaria-costa`
   - **Database Password**: gere uma senha forte e **guarde num lugar seguro** — ela não é a senha do sistema, mas você pode precisar dela um dia.
   - **Region**: `South America (São Paulo)` — mais perto, mais rápido.
3. Espere uns 2 minutos enquanto o projeto é criado.

---

## 2. Criar a tabela

1. No menu lateral, abra **SQL Editor** → **New query**.
2. Abra o arquivo `orcamentos/banco.sql` (está nesta pasta), copie **tudo** e cole no editor.
3. Clique em **Run**.

Deve aparecer "Success. No rows returned". É isso mesmo — a tabela foi criada vazia.

---

## 3. Criar seu login

1. No menu lateral: **Authentication** → **Users** → **Add user** → **Create new user**.
2. Preencha:
   - **Email**: o e-mail que você vai usar para entrar
   - **Password**: a senha do sistema
   - Marque **Auto Confirm User** — sem isso o Supabase fica esperando você clicar num link de confirmação.
3. **Create user**.

> Não crie a conta pela tela de login do site: ela só faz login, não cadastro. Isso é de propósito — impede que qualquer pessoa crie uma conta e entre no seu sistema.

---

## 4. Colar as duas chaves no site

1. No Supabase: **Settings** (engrenagem) → **API**.
2. Copie os dois valores:

   | No Supabase | Vai em `config.js` |
   |---|---|
   | **Project URL** | `SUPABASE_URL` |
   | **anon** `public` | `SUPABASE_CHAVE` |

3. Abra `orcamentos/config.js` e substitua `COLE_AQUI_A_URL` e `COLE_AQUI_A_CHAVE_ANON`.

> **A chave `anon` é pública de propósito** — ela vai no código do site, qualquer um pode ver, e tudo bem. Quem protege seus dados é o RLS que o `banco.sql` ativou: sem estar logado, o banco simplesmente não devolve nada. **Nunca** use a chave `service_role` aqui — essa sim ignora todas as proteções.

---

## 5. Publicar

```bash
cd ~/Documents/marcenaria-costa
./deploy.sh
```

Pronto. O sistema fica em **marcenariacosta.com.br/orcamentos**

---

## Usando no dia a dia

- **Novo orçamento** → preenche cliente e móveis → **Salvar**
- **Baixar PDF** → o arquivo cai na pasta de downloads
- **Enviar no WhatsApp** → gera o PDF e abre a conversa com o cliente, com a mensagem pronta; você só anexa o arquivo que acabou de baixar
- **Ctrl/Cmd + S** salva sem tirar a mão do teclado

A numeração é automática (001, 002, 003…) e a situação de cada um — rascunho, enviado, aprovado, recusado — fica na lista, com o total dos aprovados no topo.

Funciona no celular. Dá para abrir na casa do cliente, montar o orçamento na hora e mandar antes de ir embora.

---

## Perguntas que vão aparecer

**Esqueci a senha.** Supabase → Authentication → Users → clique no seu usuário → Reset password.

**Quero mudar os textos padrão** (prazo, forma de pagamento, observações): estão em `config.js`, no bloco `padroes`. Também dá para editar em cada orçamento sem mexer no arquivo.

**Quero meu CNPJ no PDF**: em `config.js`, preencha `documento` dentro de `empresa`.

**Quanto custa?** O plano gratuito do Supabase dá 500 MB de banco. Um orçamento ocupa uns 2 KB — você caberia mais de cem mil orçamentos ali. O único cuidado: projetos gratuitos hibernam depois de **7 dias sem nenhum acesso**. Se isso acontecer, é só entrar no painel do Supabase e reativar. Usando o sistema toda semana, nunca acontece.

**Preciso de backup?** O Supabase já replica os dados. Mas se quiser dormir tranquilo: Supabase → Table Editor → `orcamentos` → botão de exportar CSV. Guarde uma cópia de vez em quando.
