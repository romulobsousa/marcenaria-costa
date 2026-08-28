#!/usr/bin/env python3
"""
Carimba cada arquivo do sistema com uma marca do seu conteúdo.

Sem isso, o navegador guarda o JavaScript antigo e você publica uma
correção que o seu próprio celular não vê. Com a marca, o endereço do
arquivo muda junto com o conteúdo, e o navegador é obrigado a buscar
a versão nova.

Roda sozinho dentro do deploy.sh — você não precisa chamar à mão.
"""

import hashlib
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINA = os.path.join(RAIZ, 'sistema', 'index.html')
PASTA = os.path.join(RAIZ, 'sistema')


def marca(nome):
    caminho = os.path.join(PASTA, nome)
    if not os.path.exists(caminho):
        return None
    with open(caminho, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()[:8]


def main():
    if not os.path.exists(PAGINA):
        print('  (sistema/index.html não encontrado — nada a versionar)')
        return 0

    with open(PAGINA, encoding='utf-8') as f:
        html = f.read()

    original = html

    # limpa marcas antigas
    html = re.sub(r'(/sistema/[a-z0-9-]+\.(?:js|css))\?v=[a-z0-9]+', r'\1', html)

    # aplica as novas
    trocas = 0
    for nome in sorted(os.listdir(PASTA)):
        if not nome.endswith(('.js', '.css')):
            continue
        v = marca(nome)
        if not v:
            continue
        alvo = '"/sistema/%s"' % nome
        if alvo in html:
            html = html.replace(alvo, '"/sistema/%s?v=%s"' % (nome, v))
            trocas += 1

    if html != original:
        with open(PAGINA, 'w', encoding='utf-8') as f:
            f.write(html)

    print('  %d arquivos carimbados' % trocas)
    return 0


if __name__ == '__main__':
    sys.exit(main())
