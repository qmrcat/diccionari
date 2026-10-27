"""
Genera la icona de la web: una fitxa amb la lletra D.

Crea docs/favicon.svg (la que fan servir els navegadors moderns), docs/favicon.ico
(16, 32 i 48 px) i docs/apple-touch-icon.png (180 px, per a la pantalla d'inici dels mòbils).
Totes surten del mateix dibuix, en una quadrícula de 64x64.

Ús (des de la carpeta diccionari):
    python eines/genera_icones.py
"""

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ARREL = Path(__file__).resolve().parent.parent
DESTI = ARREL / "docs"

FONS = "#b5442b"
LLETRA = "#ffffff"

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="2" y="2" width="60" height="60" rx="12" fill="{FONS}"/>
  <path fill="{LLETRA}" fill-rule="evenodd"
        d="M18 14H32A18 18 0 0 1 32 50H18Z M27 23H32A9 9 0 0 1 32 41H27Z"/>
  <rect x="49" y="42" width="4" height="12" rx="1" fill="{LLETRA}"/>
</svg>
"""


def mig_cercle(mida, escala, caixa, recta):
    """Rectangle + mig cercle dret: la forma de la D (o del seu forat)."""
    capa = Image.new("L", (mida, mida), 0)
    d = ImageDraw.Draw(capa)
    d.ellipse([v * escala for v in caixa], fill=255)
    d.rectangle([0, 0, recta[2] * escala, mida], fill=0)
    d.rectangle([v * escala for v in recta], fill=255)
    return capa


def dibuixa(px: int) -> Image.Image:
    escala = 16  # es dibuixa gran i es redueix, per suavitzar les vores
    mida = 64 * escala
    imatge = Image.new("RGBA", (mida, mida), (0, 0, 0, 0))
    d = ImageDraw.Draw(imatge)
    d.rounded_rectangle([2 * escala, 2 * escala, 62 * escala, 62 * escala], 12 * escala, fill=FONS)

    lletra = ImageChops.subtract(
        mig_cercle(mida, escala, (14, 14, 50, 50), (18, 14, 32, 50)),
        mig_cercle(mida, escala, (23, 23, 41, 41), (27, 23, 32, 41)),
    )
    ImageDraw.Draw(lletra).rounded_rectangle(
        [49 * escala, 42 * escala, 53 * escala, 54 * escala], escala, fill=255
    )
    imatge.paste(LLETRA, (0, 0), lletra)
    return imatge.resize((px, px), Image.LANCZOS)


def main() -> None:
    (DESTI / "favicon.svg").write_text(SVG, encoding="utf-8")
    dibuixa(256).save(DESTI / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

    # A l'iOS les icones no poden ser transparents: fons de color a tota la superfície.
    tactil = Image.new("RGBA", (180, 180), FONS)
    tactil.alpha_composite(dibuixa(180))
    tactil.convert("RGB").save(DESTI / "apple-touch-icon.png")
    print("Icones creades a", DESTI)


if __name__ == "__main__":
    main()
