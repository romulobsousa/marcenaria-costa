#!/usr/bin/env python3
"""
Carimba cada arquivo de código com uma marca do seu conteúdo.

Sem isso, o navegador guarda o JavaScript e o CSS antigos e você publica
uma correção que o seu próprio celular não vê — ainda mais porque a pasta
assets é servida com cache de um ano. Com a marca, o endereço do arquivo
muda junto com o conteúdo, e o navegador é obrigado a buscar a versão nova.

Cuida de duas páginas:
  sistema/index.html  →  os arquivos de sistema/
  index.html (o site) →  assets/css/*.css e assets/js/*.js

Roda sozinho dentro do deploy.sh — você não precisa chamar à mão.
"""

import hashlib
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def marca(caminho):
    if not os.path.exists(caminho):
        return None
    with open(caminho, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def carimba(pagina, prefixos):
    """prefixos: lista de (prefixo_no_html, pasta_no_disco)"""
    if not os.path.exists(pagina):
        return 0

    with open(pagina, encoding='utf-8') as f:
        html = f.read()
    original = html
    trocas = 0

    for prefixo, pasta in prefixos:
        if not os.path.isdir(pasta):
            continue

        # limpa marcas antigas deste prefixo
        html = re.sub(re.escape(prefixo) + r'([a-z0-9-]+\.(?:js|css))\?v=[a-z0-9]+',
                      prefixo + r'\1', html)

        for nome in sorted(os.listdir(pasta)):
            if not nome.endswith(('.js', '.css')):
                continue
            v = marca(os.path.join(pasta, nome))
            if not v:
                continue
            alvo = '"%s%s"' % (prefixo, nome)
            if alvo in html:
                html = html.replace(alvo, '"%s%s?v=%s"' % (prefixo, nome, v))
                trocas += 1

    if html != original:
        with open(pagina, 'w', encoding='utf-8') as f:
            f.write(html)
    return trocas


def main():
    total = 0

    total += carimba(
        os.path.join(RAIZ, 'sistema', 'index.html'),
        [('/sistema/', os.path.join(RAIZ, 'sistema'))])

    total += carimba(
        os.path.join(RAIZ, 'index.html'),
        [('assets/css/', os.path.join(RAIZ, 'assets', 'css')),
         ('assets/js/',  os.path.join(RAIZ, 'assets', 'js'))])

    total += carimba(
        os.path.join(RAIZ, 'p', 'index.html'),
        [('/sistema/', os.path.join(RAIZ, 'sistema'))])

    print('  %d arquivos carimbados' % total)
    return 0


if __name__ == '__main__':
    sys.exit(main())
