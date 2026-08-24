#!/usr/bin/env bash
#
# Marcenaria Costa — sobe pro GitHub e publica na Vercel.
#
#   ./deploy.sh              tudo: GitHub + Vercel
#   ./deploy.sh --so-vercel  pula o GitHub
#
# Pode rodar quantas vezes quiser. Da segunda vez em diante ele só
# faz commit, push e republica.

set -uo pipefail

REPO="marcenaria-costa"
VISIBILIDADE="--public"          # troque para --private se preferir
GH_VER="2.63.2"

azul()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
aviso() { printf '\033[1;33m! %s\033[0m\n' "$1"; }
erro()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

cd "$(dirname "$0")" || exit 1

SO_VERCEL=0
[ "${1:-}" = "--so-vercel" ] && SO_VERCEL=1

# ============ ferramentas ============
azul "Conferindo ferramentas"

command -v node >/dev/null || erro "Node não encontrado. Baixe a versão LTS em https://nodejs.org e rode de novo."
ok "Node $(node -v)"

command -v git >/dev/null || erro "git não encontrado. Rode: xcode-select --install"
ok "git $(git --version | awk '{print $3}')"

if command -v vercel >/dev/null; then
  VERCEL="vercel"; ok "Vercel CLI instalada"
else
  mkdir -p .tools/npm-cache
  export npm_config_cache="$PWD/.tools/npm-cache"
  VERCEL="npx --yes vercel@latest"; ok "Vercel CLI via npx (cache próprio, sem sudo)"
fi

# ---- gh: usa o instalado, senão instala sozinho (brew ou download direto) ----
achar_gh() {
  command -v gh 2>/dev/null && return 0
  [ -x "./.tools/gh/bin/gh" ] && { echo "$PWD/.tools/gh/bin/gh"; return 0; }
  return 1
}

GH="$(achar_gh)" || GH=""

if [ -z "$GH" ] && [ "$SO_VERCEL" -eq 0 ]; then
  aviso "GitHub CLI não encontrada — vou instalar (não mexe em nada do sistema)"
  if command -v brew >/dev/null; then
    brew install gh >/dev/null 2>&1 && GH="$(command -v gh)"
  fi
  if [ -z "$GH" ]; then
    ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="amd64" || ARCH="arm64"
    URL="https://github.com/cli/cli/releases/download/v${GH_VER}/gh_${GH_VER}_macOS_${ARCH}.zip"
    echo "  baixando gh ${GH_VER} (${ARCH})…"
    mkdir -p .tools && curl -fsSL "$URL" -o .tools/gh.zip 2>/dev/null \
      && unzip -oq .tools/gh.zip -d .tools 2>/dev/null \
      && mv .tools/gh_${GH_VER}_macOS_${ARCH} .tools/gh 2>/dev/null \
      && chmod +x .tools/gh/bin/gh 2>/dev/null \
      && GH="$PWD/.tools/gh/bin/gh"
    rm -f .tools/gh.zip
  fi
  [ -n "$GH" ] && ok "GitHub CLI pronta" || aviso "Não consegui instalar a gh — sigo sem o GitHub"
fi

# ============ GitHub ============
if [ "$SO_VERCEL" -eq 1 ]; then
  aviso "Pulando o GitHub (--so-vercel)"
else
  azul "Preparando o repositório local"
  [ -d .git ] || git init -q
  git add -A
  if git diff --cached --quiet 2>/dev/null; then
    ok "Nada novo para commitar"
  else
    git -c user.email="${GIT_EMAIL:-romulobsousa@gmail.com}" \
        -c user.name="${GIT_NAME:-Romulo Sousa}" \
        commit -q -m "Site da Marcenaria Costa — $(date '+%d/%m/%Y %H:%M')"
    ok "Commit criado"
  fi
  git branch -M main

  if git remote get-url origin >/dev/null 2>&1; then
    azul "Enviando para o GitHub"
    git push -u origin main 2>/dev/null && ok "Código atualizado no GitHub" \
      || aviso "Push falhou — o site sobe na Vercel do mesmo jeito"
  elif [ -n "$GH" ]; then
    "$GH" auth status >/dev/null 2>&1 || {
      azul "Login no GitHub"
      echo "  Vai abrir o navegador. Escolha: GitHub.com → HTTPS → Login with a web browser"
      "$GH" auth login
    }
    azul "Conectando ao GitHub"
    USUARIO="$("$GH" api user --jq .login 2>/dev/null)"

    if "$GH" repo view "$REPO" >/dev/null 2>&1; then
      ok "Repositório $REPO já existe — vou usar ele"
      git remote add origin "https://github.com/$USUARIO/$REPO.git" 2>/dev/null
    else
      "$GH" repo create "$REPO" $VISIBILIDADE --source=. --remote=origin >/dev/null 2>&1 \
        && ok "Repositório criado" \
        || aviso "Não deu para criar o repositório"
    fi

    if git remote get-url origin >/dev/null 2>&1; then
      azul "Enviando os arquivos"
      if git push -u origin main 2>/dev/null; then
        ok "Código no GitHub: https://github.com/$USUARIO/$REPO"
      else
        aviso "O repositório remoto tem conteúdo diferente — juntando os dois"
        git pull --rebase origin main >/dev/null 2>&1
        git push -u origin main 2>/dev/null \
          && ok "Código no GitHub: https://github.com/$USUARIO/$REPO" \
          || aviso "Push falhou — o site sobe na Vercel do mesmo jeito"
      fi
    fi
  else
    aviso "Sem a gh. Para ligar o GitHub depois:"
    echo "     1. Crie um repo vazio em https://github.com/new  (nome: $REPO)"
    echo "     2. git remote add origin https://github.com/SEU_USUARIO/$REPO.git"
    echo "     3. git push -u origin main"
    echo "     O commit local já está feito — nada se perde."
  fi
fi

# ============ Vercel ============
azul "Publicando na Vercel"
cat << 'DICA'
  Na primeira vez ela faz algumas perguntas. Responda assim:
    Set up and deploy?          Y
    Which scope?                sua conta (Enter)
    Link to existing project?   N
    Project name?               marcenaria-costa
    In which directory?         ./          (Enter)
    Modify settings?            N
DICA
echo ""
$VERCEL --prod || erro "Publicação falhou. Rode '$VERCEL login' e tente de novo."

printf '\n\033[1;32m════════════════════════════════════════\033[0m\n'
ok "Site no ar!"
cat << 'FIM'

Últimos ajustes quando tiver a URL final:
  1. Trocar a URL em index.html (og:url e canonical), robots.txt e sitemap.xml
  2. Testar o botão do WhatsApp pelo celular
  3. Mandar o link pra você mesmo no WhatsApp e ver se a prévia aparece certa
FIM
