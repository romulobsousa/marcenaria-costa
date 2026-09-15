#!/usr/bin/env bash
#
# Marcenaria Costa — publica no Supabase a função que troca senha.
#
#   ./tools/publicar-funcao.sh
#
# Roda uma vez. Só precisa rodar de novo se um dia a função mudar.
#
# O que ela faz lá dentro: trocar a senha de outra pessoa exige a chave
# secreta do projeto, e essa chave não pode viver no navegador. Então o
# código vai para o servidor do Supabase, onde a chave já existe.

set -uo pipefail

azul()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$1"; }
ok()    { printf '\033[1;32m✓ %s\033[0m\n' "$1"; }
aviso() { printf '\033[1;33m! %s\033[0m\n' "$1"; }
erro()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$1"; exit 1; }

cd "$(dirname "$0")/.." || exit 1

command -v node >/dev/null || erro "Node não encontrado. Baixe a versão LTS em https://nodejs.org e rode de novo."

# npm com cache dentro do projeto, para não esbarrar em permissão
export npm_config_cache="$PWD/.tools/npm-cache"
mkdir -p "$npm_config_cache"

# ============ qual é o projeto ============
azul "Descobrindo o projeto no Supabase"

REF=$(sed -n "s|.*https://\([a-z0-9]*\)\.supabase\.co.*|\1|p" sistema/config.js | head -1)
[ -n "$REF" ] || erro "Não achei a URL do Supabase em sistema/config.js."
ok "Projeto: $REF"

SUPA="npx --yes supabase@latest"

# ============ login ============
azul "Conferindo o login no Supabase"

if ! $SUPA projects list >/dev/null 2>&1; then
  aviso "Sem login — vou abrir o navegador para você autorizar"
  $SUPA login || erro "Login no Supabase falhou."
fi
ok "Logado"

# ============ publicar ============
azul "Publicando a função 'senha'"

$SUPA functions deploy senha --project-ref "$REF" \
  || erro "A publicação falhou. Confira a mensagem acima e tente de novo."

printf '\n\033[1;32m════════════════════════════════════════\033[0m\n'
ok "Função no ar!"
cat << 'FIM'

Agora, dentro do sistema:
  Equipe → em cada pessoa aparece "Trocar senha".
  A senha nova vale na hora, e o e-mail dela já sai confirmado.

FIM
