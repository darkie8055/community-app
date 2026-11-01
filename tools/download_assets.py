"""Download bundled sample catalogue photography; no user screenshots are reused."""
from pathlib import Path
from urllib.request import Request, urlopen

target = Path(__file__).resolve().parents[1] / 'apps/mobile/assets/images'
photos = {
    'chair': 'photo-1503602642458-232111445657',
    'sofa': 'photo-1555041469-a586c61ea9bc',
    'car': 'photo-1494976388531-d1058494cdd8',
    'decor': 'photo-1494438639946-1ebd1d20bf85',
    'bicycle': 'photo-1485965120184-e220f721d03e',
    'cleaning': 'photo-1581578731548-c64695cc6952',
    'painting': 'photo-1562259949-e8e7689d7828',
    'moving': 'photo-1600585154340-be6161a56a0c',
    'ac': 'photo-1600585154340-be6161a56a0c',
}
for name, photo in photos.items():
    path = target / f'{name}.jpg'
    if path.exists():
        continue
    try:
        req = Request(f'https://images.unsplash.com/{photo}?auto=format&fit=crop&w=800&q=85', headers={'User-Agent': 'MyCommunity sample asset setup'})
        with urlopen(req, timeout=30) as response:
            data = response.read()
            if not response.headers.get('Content-Type', '').startswith('image/'):
                raise ValueError('Not an image')
        path.write_bytes(data)
        print(f'{name}: {len(data)} bytes')
    except Exception as error:
        print(f'{name}: {error}')
