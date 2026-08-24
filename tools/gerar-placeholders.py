#!/usr/bin/env python3
"""
Gera imagens placeholder para o site da Marcenaria Costa.

Os arquivos saem com os NOMES DEFINITIVOS usados no site.
Para trocar por fotos reais, basta salvar a foto com o mesmo nome
dentro de assets/img/ — nada no codigo precisa mudar.

Uso:  python3 tools/gerar-placeholders.py
"""

import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(BASE, "assets", "img")
os.makedirs(OUT, exist_ok=True)

# Paleta madeira / MDF nude
TOPO = (58, 45, 36)
BASE_COR = (120, 94, 71)
LINHA = (196, 168, 138)
TEXTO = (247, 240, 232)


def fonte(tam):
    caminhos = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for c in caminhos:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, tam)
            except Exception:
                pass
    return ImageFont.load_default()


def gradiente(w, h, topo, base):
    img = Image.new("RGB", (w, h), topo)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(h - 1, 1)
        cor = tuple(int(topo[i] + (base[i] - topo[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=cor)
    return img


def veios(d, w, h):
    """Linhas finas que lembram veios de madeira / frentes de armario."""
    passo = max(h // 9, 40)
    for y in range(passo, h, passo):
        d.line([(0, y), (w, y)], fill=LINHA + (0,), width=1)
    # frentes verticais
    for x in (w // 3, 2 * w // 3):
        d.line([(x, 0), (x, h)], fill=LINHA, width=1)


def centrado(d, texto, cx, y, f, cor=TEXTO):
    caixa = d.textbbox((0, 0), texto, font=f)
    d.text((cx - (caixa[2] - caixa[0]) / 2, y), texto, font=f, fill=cor)
    return caixa[3] - caixa[1]


def placeholder(nome, w, h, rotulo, sub=""):
    img = gradiente(w, h, TOPO, BASE_COR)
    camada = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(camada)
    veios(d, w, h)
    img = Image.alpha_composite(img.convert("RGBA"), camada).convert("RGB")

    d = ImageDraw.Draw(img)
    m = int(min(w, h) * 0.045)
    d.rectangle([m, m, w - m, h - m], outline=LINHA, width=2)

    f_marca = fonte(max(int(min(w, h) * 0.045), 14))
    f_tit = fonte(max(int(min(w, h) * 0.075), 20))
    f_sub = fonte(max(int(min(w, h) * 0.038), 12))

    cx = w // 2
    y = int(h * 0.40)
    centrado(d, "MARCENARIA COSTA", cx, y, f_marca, LINHA)
    y += int(h * 0.09)
    centrado(d, rotulo, cx, y, f_tit)
    if sub:
        y += int(h * 0.11)
        centrado(d, sub, cx, y, f_sub, LINHA)
    y += int(h * 0.09)
    centrado(d, f"{w} x {h}px", cx, y, f_sub, LINHA)

    caminho = os.path.join(OUT, nome)
    img.save(caminho, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"  {nome}  ({w}x{h})")


# nome, largura, altura, rotulo, subtitulo
SLOTS = [
    ("hero.jpg", 1600, 1200, "FOTO PRINCIPAL", "cozinha planejada em destaque"),
    ("og-image.jpg", 1200, 630, "IMAGEM DE COMPARTILHAMENTO", "WhatsApp / Facebook / Google"),
    ("oficina.jpg", 1200, 900, "OFICINA", "bancada, maquinario ou equipe"),
    ("projeto-01.jpg", 1000, 1250, "COZINHA 01", "troque por foto real"),
    ("projeto-02.jpg", 1000, 1250, "COZINHA 02", "troque por foto real"),
    ("projeto-03.jpg", 1000, 1250, "DORMITORIO 01", "troque por foto real"),
    ("projeto-04.jpg", 1000, 1250, "CLOSET 01", "troque por foto real"),
    ("projeto-05.jpg", 1000, 1250, "HOME OFFICE 01", "troque por foto real"),
    ("projeto-06.jpg", 1000, 1250, "PAINEL / RACK 01", "troque por foto real"),
    ("projeto-07.jpg", 1000, 1250, "BANHEIRO 01", "troque por foto real"),
    ("projeto-08.jpg", 1000, 1250, "AREA GOURMET 01", "troque por foto real"),
    ("projeto-09.jpg", 1000, 1250, "DORMITORIO 02", "troque por foto real"),
    ("projeto-10.jpg", 1000, 1250, "COZINHA 03", "troque por foto real"),
    ("projeto-11.jpg", 1000, 1250, "CLOSET 02", "troque por foto real"),
    ("projeto-12.jpg", 1000, 1250, "COMERCIAL 01", "troque por foto real"),
]

if __name__ == "__main__":
    print("Gerando placeholders em assets/img/ ...")
    for nome, w, h, rotulo, sub in SLOTS:
        placeholder(nome, w, h, rotulo, sub)
    print("\nPronto. Para usar fotos reais, salve por cima com o MESMO nome.")
