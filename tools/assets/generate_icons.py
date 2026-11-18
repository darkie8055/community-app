"""Rasterize the existing SVG brand mark for native launcher icons."""
from pathlib import Path
import fitz
assets = Path(__file__).resolve().parents[2] / 'apps/mobile/assets'
svg = fitz.open(assets / 'icon.svg')
document = fitz.open('pdf', svg.convert_to_pdf())
page = document[0]
page.get_pixmap(matrix=fitz.Matrix(1024 / page.rect.width, 1024 / page.rect.height), alpha=False).save(assets / 'icon.png')
print('Generated assets/icon.png from the original brand mark.')
