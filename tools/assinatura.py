#!/usr/bin/env python3
"""
Prepara a rubrica que sai no contrato.

    python3 tools/assinatura.py caminho/da/imagem.png

Pega a foto ou o arquivo da assinatura, tira o fundo, apara as sobras e
grava sistema/assinatura-dados.js, que é de onde o contrato lê.

Serve foto de papel também: o que não for escuro vira transparente.
Quanto mais limpo o fundo, melhor o recorte.

Trocou quem assina pela marcenaria? Rode de novo com a imagem nova, e
não esqueça de trocar o 'representante' em sistema/config.js.
"""

import base64
import os
import sys

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print('Falta a biblioteca Pillow. Rode: pip3 install pillow numpy')
    sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LARGURA = 400          # o dobro do tamanho em que aparece no contrato


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 1

    origem = sys.argv[1]
    if not os.path.exists(origem):
        print('Não achei o arquivo: %s' % origem)
        return 1

    orig = Image.open(origem)

    # Se a imagem já vem com transparência, o fundo costuma ser preto por
    # baixo do alfa. Achatar sobre branco antes evita ler esse preto como
    # se fosse tinta.
    papel = Image.new('RGB', orig.size, (255, 255, 255))
    rgba = orig.convert('RGBA')
    papel.paste(rgba, (0, 0), rgba)

    a = np.array(papel).astype(np.float32)
    lum = a.max(axis=2)

    alfa = np.clip((250.0 - lum) / 60.0 * 255.0, 0, 255)
    alfa[lum <= 190] = 255      # a tinta, inteira
    alfa[lum >= 248] = 0        # o papel, invisível

    img = Image.fromarray(np.dstack([a, alfa]).astype(np.uint8), 'RGBA')
    caixa = img.getbbox()
    if not caixa:
        print('A imagem ficou vazia depois do recorte. O fundo é escuro demais?')
        return 1
    img = img.crop(caixa)
    img = img.resize((LARGURA, round(LARGURA * img.height / img.width)), Image.LANCZOS)

    png = os.path.join(RAIZ, 'sistema', 'assinatura.png')
    img.save(png, optimize=True)

    b64 = base64.b64encode(open(png, 'rb').read()).decode()
    destino = os.path.join(RAIZ, 'sistema', 'assinatura-dados.js')
    with open(destino, 'w') as f:
        f.write(
            '/* =====================================================================\n'
            '   A rubrica da CONTRATADA, embutida no arquivo para sair no contrato.\n'
            '   Trocou de assinatura? Rode tools/assinatura.py com a imagem nova.\n'
            '   ===================================================================== */\n\n'
            'window.ASSINATURA_CONTRATADA = {\n'
            "  dados: 'data:image/png;base64,%s',\n"
            '  largura: %d,\n'
            '  altura: %d\n'
            '};\n' % (b64, img.width, img.height))

    print('  rubrica pronta: %d × %d px, %.0f KB'
          % (img.width, img.height, os.path.getsize(destino) / 1024))
    return 0


if __name__ == '__main__':
    sys.exit(main())
