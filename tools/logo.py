#!/usr/bin/env python3
"""
Prepara a logomarca para o site, para o sistema e para o PDF.

Entrada:  assets/img/logo.jpeg  (a arte original, fundo branco)
Saídas:   assets/img/logo.png / .webp        — logo inteira, fundo transparente
          assets/img/logo-marca.png / .webp  — só o "MC", para a barra do topo
          sistema/logo-dados.js              — a logo embutida, usada no PDF

Trocou a logo? Substitua assets/img/logo.jpeg e rode:

    python3 tools/logo.py
"""

import base64
import io
import os
import sys

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print('Falta a biblioteca Pillow. Rode: pip3 install pillow numpy')
    sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, 'assets', 'img', 'logo.jpeg')


def recorta(caminho):
    """Tira o fundo branco e apara as sobras em volta."""
    im = Image.open(caminho).convert('RGB')
    a = np.array(im).astype(np.float32)
    lum = a.max(axis=2)
    alfa = np.clip((248.0 - lum) / 38.0 * 255.0, 0, 255)
    alfa[lum <= 210] = 255      # a arte, inteira
    alfa[lum >= 246] = 0        # o papel, invisível
    img = Image.fromarray(np.dstack([a, alfa]).astype(np.uint8), 'RGBA')
    return img.crop(img.getbbox())


def para_fundo_escuro(arte):
    """Versão para fundo escuro: o azul-marinho da logo some contra o
    carvão do site, então ele vira areia clara. O dourado fica igual."""
    a = np.array(arte).astype(np.int16)
    r, g, b, alfa = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]

    # marinho: escuro e mais azul que vermelho. dourado: vermelho na frente.
    marinho = (b >= r - 4) & (r + g + b < 330)

    AREIA = (247, 243, 237)
    for i, v in enumerate(AREIA):
        canal = a[:, :, i]
        canal[marinho] = v
        a[:, :, i] = canal
    a[:, :, 3] = alfa
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def salva(img, nome, qualidade=85):
    base = os.path.join(RAIZ, 'assets', 'img', nome)
    img.save(base + '.png', optimize=True)
    img.save(base + '.webp', quality=qualidade, method=6)
    print('  %-16s %5.0f KB' % (nome, os.path.getsize(base + '.png') / 1024))


def main():
    if not os.path.exists(ORIGEM):
        print('Não achei %s' % ORIGEM)
        return 1

    print('Preparando a logomarca')
    arte = recorta(ORIGEM)

    # logo inteira, 520 px de largura (o dobro do tamanho em que aparece)
    salva(arte.resize((520, round(520 * arte.height / arte.width)), Image.LANCZOS), 'logo')

    # só o monograma de cima, 72 px de altura, para a barra do sistema
    mono = arte.crop((0, 0, arte.width, int(arte.height * 0.60)))
    mono = mono.crop(mono.getbbox())
    salva(mono.resize((round(72 * mono.width / mono.height), 72), Image.LANCZOS), 'logo-marca')

    # versões para fundo escuro (cabeçalho e rodapé do site)
    escura = para_fundo_escuro(arte)
    salva(escura.resize((520, round(520 * escura.height / escura.width)), Image.LANCZOS),
          'logo-escura')
    monoE = escura.crop((0, 0, escura.width, int(escura.height * 0.60)))
    monoE = monoE.crop(monoE.getbbox())
    salva(monoE.resize((round(72 * monoE.width / monoE.height), 72), Image.LANCZOS),
          'logo-marca-escura')

    # para o PDF: assentada na mesma cor da faixa do cabeçalho, para não
    # aparecer um retângulo branco em volta dela
    FAIXA = (246, 242, 234)
    im = Image.new('RGB', arte.size, FAIXA)
    im.paste(arte, (0, 0), arte)
    im = im.resize((560, round(560 * im.height / im.width)), Image.LANCZOS)

    buf = io.BytesIO()
    im.save(buf, 'JPEG', quality=86, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()

    destino = os.path.join(RAIZ, 'sistema', 'logo-dados.js')
    with open(destino, 'w') as f:
        f.write(
            '/* =====================================================================\n'
            '   A logomarca embutida no arquivo, para o PDF sair com ela mesmo sem\n'
            '   internet no momento de gerar. Trocou de logo? Rode tools/logo.py.\n'
            '   ===================================================================== */\n\n'
            'window.LOGO_ORCAMENTO = {\n'
            "  dados: 'data:image/jpeg;base64,%s',\n"
            '  largura: %d,\n'
            '  altura: %d\n'
            '};\n' % (b64, im.width, im.height))
    print('  %-16s %5.0f KB' % ('logo-dados.js', os.path.getsize(destino) / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
