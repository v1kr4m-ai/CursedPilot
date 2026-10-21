"""Makes every app icon from one picture: assets/icon/cursed_pilot_icon_source.png (the large tile of the icon sheet).

  python scripts/make_icons.py

Writes the web icons (public/), the Android launcher icons (android/app/src/main/res/mipmap-*), the iOS app icon set
(assets/icons/ios/AppIcon.appiconset), a Windows icon and the Play Store icon (assets/icons/). Run it again after changing
the source picture. The source is only about 400 px across, so the big sizes are scaled up and a little soft; a larger
source picture gives sharper icons.
"""
import json
import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets', 'icon', 'cursed_pilot_icon_source.png')
tile = Image.open(SRC).convert('RGB')                      # the whole tile: frame, rounded corners and the picture
W = tile.size[0]
FRAME = round(W * 0.06)                                    # the metal frame and its shadow are about 6% of the width
inner = tile.crop((FRAME, FRAME, W - FRAME, W - FRAME))   # the picture inside the frame, full bleed, square corners


def up(img, size):
    """Scaled to size x size: Lanczos, then a gentle sharpen so the line work stays crisp."""
    out = img.resize((size, size), Image.LANCZOS)
    return out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2)) if size > img.size[0] else out


def rounded_tile(size):
    """The tile with its frame and rounded corners on a transparent background."""
    im = up(tile, size).convert('RGBA')
    radius = round(size * 0.22)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 4 - 1, size * 4 - 1), radius=radius * 4, fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    im.putalpha(ImageChops.multiply(im.getchannel('A'), mask))
    return im


def fullbleed(size):
    return up(inner, size).convert('RGB')


def circle(size):
    """The picture in a circle, with a ring in the frame colour."""
    art = up(inner, size).convert('RGBA')
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    art.putalpha(mask)
    ring = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(ring).ellipse((1, 1, size - 2, size - 2), outline=(110, 124, 120, 255), width=max(2, size // 40))
    return Image.alpha_composite(art, ring)


def adaptive_background(size):
    """The picture blurred and enlarged: a dark slate that matches the picture's own edges."""
    return up(inner, size).convert('RGB').filter(ImageFilter.GaussianBlur(size / 12))


def adaptive_foreground(size):
    """The picture at 72% of the canvas (so the skull stays inside the 66 dp safe zone), its edges feathered into the background."""
    s = round(size * 0.72)
    art = up(inner, s).convert('RGBA')
    feather = max(2, s // 14)
    mask = Image.new('L', (s, s), 0)
    ImageDraw.Draw(mask).rectangle((feather, feather, s - feather, s - feather), fill=255)
    art.putalpha(mask.filter(ImageFilter.GaussianBlur(feather / 2)))
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((size - s) // 2, (size - s) // 2))
    return canvas


def save(img, *path, fmt='PNG'):
    full = os.path.join(ROOT, *path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    img.save(full, fmt)
    return full


made = []

# ---- web: favicon, PWA icons, apple-touch-icon (the PWA 'maskable' icon is full bleed, the others keep the frame)
for n, size in (('favicon-16.png', 16), ('favicon-32.png', 32), ('icon-192.png', 192), ('icon-512.png', 512)):
    made.append(save(rounded_tile(size), 'public', n))
made.append(save(fullbleed(180), 'public', 'apple-touch-icon.png'))
made.append(save(fullbleed(512), 'public', 'maskable-512.png'))
ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
rounded_tile(256).save(os.path.join(ROOT, 'public', 'favicon.ico'), format='ICO', sizes=ico_sizes)
os.makedirs(os.path.join(ROOT, 'assets', 'icons'), exist_ok=True)
rounded_tile(256).save(os.path.join(ROOT, 'assets', 'icons', 'cursed-pilot.ico'), format='ICO', sizes=ico_sizes)
made.append(save(rounded_tile(512), 'assets', 'icons', 'play-store-512.png'))
made.append(save(fullbleed(1024), 'assets', 'icons', 'app-icon-1024.png'))

# ---- Android: legacy square and round launcher icons, and the adaptive icon's two layers
RES = os.path.join('android', 'app', 'src', 'main', 'res')
DENSITY = {'mdpi': 1.0, 'hdpi': 1.5, 'xhdpi': 2.0, 'xxhdpi': 3.0, 'xxxhdpi': 4.0}
for d, k in DENSITY.items():
    made.append(save(rounded_tile(round(48 * k)), RES, f'mipmap-{d}', 'ic_launcher.png'))
    made.append(save(circle(round(48 * k)), RES, f'mipmap-{d}', 'ic_launcher_round.png'))
    made.append(save(adaptive_foreground(round(108 * k)), RES, f'mipmap-{d}', 'ic_launcher_foreground.png'))
    made.append(save(adaptive_background(round(108 * k)), RES, f'mipmap-{d}', 'ic_launcher_background.png'))
xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@mipmap/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>'
for name in ('ic_launcher.xml', 'ic_launcher_round.xml'):
    p = os.path.join(ROOT, RES, 'mipmap-anydpi-v26', name)
    open(p, 'w', encoding='utf-8').write(xml)
    made.append(p)

# ---- iOS: the app icon set for an Xcode project (the system rounds the corners, so the images are full bleed with no transparency)
IOS = os.path.join('assets', 'icons', 'ios', 'AppIcon.appiconset')
ios_images = []
for idiom, entries in (
    ('iphone', [(20, 2), (20, 3), (29, 2), (29, 3), (40, 2), (40, 3), (60, 2), (60, 3)]),
    ('ipad', [(20, 1), (20, 2), (29, 1), (29, 2), (40, 1), (40, 2), (76, 1), (76, 2), (83.5, 2)]),
    ('ios-marketing', [(1024, 1)]),
):
    for pt, scale in entries:
        px = round(pt * scale)
        fname = f'icon-{idiom}-{pt}@{scale}x.png'.replace('.0@', '@')
        save(fullbleed(px), IOS, fname)
        ios_images.append({'idiom': idiom, 'size': f'{pt:g}x{pt:g}', 'scale': f'{scale}x', 'filename': fname})
open(os.path.join(ROOT, IOS, 'Contents.json'), 'w', encoding='utf-8').write(json.dumps({'images': ios_images, 'info': {'version': 1, 'author': 'xcode'}}, indent=2))

print(f'{len([m for m in made if m])} files written, {len(ios_images)} iOS icons')
