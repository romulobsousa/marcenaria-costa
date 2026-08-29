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

> O painel do Supabase mudou em 2025. Se algum tutorial mandar você em
> "Settings → API" atrás da chave, é o caminho antigo.

### A chave

**Settings** (engrenagem, no fim do menu lateral) → **API Keys**

| O que aparece na tela | Usar aqui? |
|---|---|
| `anon` `public` | **sim** — chave antiga, continua funcionando |
| **Publishable key** (`sb_publishable_...`) | **sim** — é o nome novo da mesma coisa |
| `service_role` `secret` | **nunca** |
| **Secret keys** (`sb_secret_...`) | **nunca** |

Se as duas de cima aparecerem, tanto faz qual você copia. As de baixo ignoram
todas as proteções do banco — elas nunca podem ir para um arquivo do site.

### A URL

**Settings** → **API** → campo *Project URL*.

Não achou? Olhe o endereço do navegador enquanto está no projeto:

```
supabase.com/dashboard/project/abcdefghijklmnop
                               └── este pedaço ──┘
```

Sua URL é `https://` + esse pedaço + `.supabase.co`

> Atalho: o botão **Connect**, no topo da página do projeto, mostra a URL e a
> chave lado a lado, prontas para copiar.

### Colando

Abra `orcamentos/config.js` e troque:

```js
SUPABASE_URL:   'https://abcdefghijklmnop.supabase.co',
SUPABASE_CHAVE: 'sb_publishable_AbC123...',
```

Mantenha as aspas e a vírgula no fim de cada linha.

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
