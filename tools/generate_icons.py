"""Rasterize the original code-native SVG mark into platform launcher icons."""
from pathlib import Path
import fitz

root = Path(__file__).resolve().parents[1] / 'apps' / 'mobile'
svg = fitz.open(root / 'web' / 'favicon.svg')
document = fitz.open('pdf', svg.convert_to_pdf())
targets = list((root / 'web').rglob('*.png'))
targets += list((root / 'android' / 'app' / 'src' / 'main' / 'res').glob('mipmap-*/ic_launcher.png'))
targets += list((root / 'ios' / 'Runner' / 'Assets.xcassets' / 'AppIcon.appiconset').glob('*.png'))
for target in targets:
    original = fitz.Pixmap(str(target))
    size = original.width
    page = document[0]
    page.get_pixmap(matrix=fitz.Matrix(size / page.rect.width, size / page.rect.height), alpha=False).save(str(target))
print(f'Generated {len(targets)} platform icons from favicon.svg.')
