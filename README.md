# Marcenaria Costa — site institucional

Landing page mobile-first para **Marcenaria Costa**, Curitiba – PR.
Feita para receber tráfego pago (Meta Ads) e jogar tudo no WhatsApp.

- HTML, CSS e JS puros. **Sem build, sem dependências, sem framework.**
- Página única, ~40 KB de código + imagens.
- Atendimento pelo WhatsApp **(41) 99991-7485**.
- Instagram: [@marcenariacostactba](https://www.instagram.com/marcenariacostactba/)

---

## 1. Rodar na sua máquina

```bash
cd marcenaria-costa
python3 -m http.server 8000
```

Abra <http://localhost:8000>.

> Não abra o `index.html` com dois cliques. Alguns recursos só funcionam
> servidos por HTTP.

---

## 2. Trocar as fotos (o passo mais importante)

Hoje o site está com **placeholders**. Todas as imagens ficam em `assets/img/`.

**Regra única: salve a foto real por cima, com o mesmo nome de arquivo.**
Nada no código precisa mudar.

| Arquivo | Onde aparece | Proporção ideal |
|---|---|---|
| `hero.jpg` | fundo do topo | 4:3 — 1600×1200 |
| `og-image.jpg` | prévia ao compartilhar no WhatsApp/Face | 1200×630 |
| `oficina.jpg` | seção "Sobre" | 4:3 — 1200×900 |
| `projeto-01.jpg` … `projeto-12.jpg` | galeria de projetos | 4:5 — 1000×1250 (foto em pé) |

Depois de trocar, ajuste no `index.html` o `alt` e o `data-legenda` de cada
foto da galeria (é o texto que aparece ao ampliar) e o `data-cat`, que define
em qual filtro ela entra: `cozinha`, `dormitorio`, `closet`, `sala` ou `outros`.

**Dica de peso:** deixe cada foto abaixo de 300 KB. Foto pesada em anúncio
custa caro — o cliente sai antes da página carregar.
Comprima em <https://squoosh.app> ou pelo terminal:

```bash
# macOS: brew install imagemagick
magick foto-original.jpg -resize 1000x1250^ -gravity center -extent 1000x1250 \
  -quality 82 -strip assets/img/projeto-01.jpg
```

Se quiser gerar os placeholders de novo:

```bash
pip3 install pillow
python3 tools/gerar-placeholders.py
```

---

## 3. Mudar telefone, pixel do Meta e GA4

Tudo num lugar só: topo de **`assets/js/main.js`**, no bloco `CONFIG`.

```js
const CONFIG = {
  whatsapp:    '5541999917485',  // 55 + DDD + número, só dígitos
  msgPadrao:   'Olá! Vim pelo site...',
  metaPixelId: '',               // coloque o ID para ligar o pixel
  ga4Id:       ''                // coloque o G-XXXXXXXXXX para ligar o GA4
};
```

Os pixels **só carregam se você preencher**. Enquanto estiverem vazios, nenhum
script de terceiro é baixado — a página fica mais rápida e sem cookie banner.

Com o pixel ligado, todo clique de WhatsApp dispara `Contact` e o envio do
formulário dispara `Lead`. É esse `Lead` que você otimiza na campanha.

O número também aparece em texto no `index.html` (rodapé e "Ou ligue"), nos
links `tel:` e no JSON-LD do topo. Se trocar o número, busque por
`41999917485` e `99991-7485` no arquivo.

---

## 4. Subir no GitHub

Pré-requisitos no seu Mac:

```bash
brew install gh          # GitHub CLI
npm install -g vercel    # Vercel CLI
```

Depois, dentro da pasta do projeto:

```bash
gh auth login            # escolha GitHub.com > HTTPS > login pelo navegador

git init
git add .
git commit -m "Site da Marcenaria Costa"
git branch -M main

gh repo create marcenaria-costa --public --source=. --remote=origin --push
```

Se quiser o repositório privado, troque `--public` por `--private`.

---

## 5. Publicar

### Opção A — Vercel (mais rápido)

```bash
vercel login
vercel --prod
```

Responda: projeto novo, nome `marcenaria-costa`, diretório `./`,
sem framework, sem build. Em ~20 segundos sai a URL
`https://marcenaria-costa.vercel.app`.

Alternativa sem terminal: <https://vercel.com/new> → *Import Git Repository*
→ escolha o repo → **Deploy**. A partir daí, todo `git push` republica sozinho.

### Opção B — Cloudflare Pages

<https://dash.cloudflare.com> → **Workers & Pages** → *Create* → *Pages* →
*Connect to Git* → escolha o repo.

- Framework preset: **None**
- Build command: *(deixe vazio)*
- Output directory: `/`

> O `vercel.json` deste projeto (cache e cabeçalhos de segurança) só vale na
> Vercel. Na Cloudflare, configure equivalentes em *Settings → Headers* se
> quiser — o site funciona sem isso.

### Domínio próprio

Nos dois casos: painel do projeto → *Domains* → adicione o domínio → aponte o
DNS conforme as instruções da plataforma.

**Depois de definir o domínio final, atualize a URL em 4 lugares:**

1. `index.html` — `<link rel="canonical">`
2. `index.html` — as tags `og:url` e `og:image`
3. `index.html` — o `"url"` e o `"image"` dentro do JSON-LD
4. `robots.txt` e `sitemap.xml`

---

## 6. Depois de publicar

- [ ] Trocar os placeholders pelas fotos reais dos projetos
- [ ] Cadastrar o site no **Google Meu Negócio** (é o que mais traz orçamento
      orgânico para marcenaria em Curitiba)
- [ ] Enviar o `sitemap.xml` no **Google Search Console**
- [ ] Colocar o link do site na bio do Instagram
- [ ] Ligar o Meta Pixel antes de subir campanha e conferir com o
      *Meta Pixel Helper*
- [ ] Testar o botão do WhatsApp **no celular**, não só no desktop

---

## Estrutura

```
marcenaria-costa/
├── index.html              página inteira
├── assets/
│   ├── css/style.css       estilos (mobile-first)
│   ├── js/main.js          CONFIG + interações
│   ├── img/                fotos e placeholders
│   └── icons/              favicon e ícones do app
├── tools/
│   └── gerar-placeholders.py
├── vercel.json             cache e cabeçalhos de segurança
├── robots.txt
├── sitemap.xml
├── site.webmanifest
└── deploy.sh               atalho para os passos 4 e 5
```

## O que tem na página

Topo com CTA · barra de diferenciais · 8 serviços · galeria filtrável com
lightbox · processo em 5 passos · sobre · **quiz de orçamento em 4 etapas que
abre o WhatsApp com tudo preenchido** · bairros atendidos (SEO local) ·
8 perguntas frequentes com dados estruturados FAQ · CTA final · botão flutuante.

Acessibilidade: navegação por teclado, foco visível, `aria-*` nos componentes
interativos e respeito a `prefers-reduced-motion`.
