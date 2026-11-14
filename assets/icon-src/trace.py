"""Traces Pointo's ghost icon into flat layers for Icon Composer (see the app-icon skill).

    python3 -m venv /tmp/iconenv && /tmp/iconenv/bin/pip install pillow numpy
    /tmp/iconenv/bin/python assets/icon-src/trace.py        # needs potrace (brew install potrace)

Source: `ghost-concept.png`, the GPT Image concept the owner picked. Output, front to back:
`Pointo.icon/Assets/2-face.svg` (eyes and smile, navy) and `1-body.svg` (white silhouette); the
blue background is a fill in `icon.json`, and Icon Composer adds the glass. Also writes
`menubar.svg`, the menu bar template (black silhouette, face cut out).
"""
import os
import re
import subprocess
import tempfile
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "Pointo.icon", "Assets")


def flood_outside(mask):
    """Pixels of ~mask reachable from the top-left corner (the outside)."""
    h, w = mask.shape
    seen = np.zeros_like(mask)
    queue = deque([(0, 0)])
    seen[0, 0] = True
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def component(mask, seed):
    h, w = mask.shape
    seen = np.zeros_like(mask)
    queue = deque([seed])
    seen[seed] = True
    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                queue.append((ny, nx))
    return seen


def masks(path):
    rgb = np.asarray(Image.open(path).convert("RGB")).astype(int)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    blue = b - np.maximum(r, g) > 70
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    bright = (lum > 150) & ~blue
    ys, xs = np.nonzero(bright)
    body = component(bright, (int(np.median(ys)), int(np.median(xs))))
    filled = ~flood_outside(body)
    face = (lum < 90) & filled & ~body
    # Smooth the silhouette: close the shading creases, then blur and threshold.
    img = Image.fromarray((filled * 255).astype(np.uint8))
    r_close = 28
    img = img.filter(ImageFilter.MaxFilter(2 * r_close + 1)).filter(ImageFilter.MinFilter(2 * r_close + 1))
    img = img.filter(ImageFilter.GaussianBlur(7)).point(lambda v: 255 if v > 127 else 0)
    body = ~flood_outside(np.asarray(img) > 127)
    img = Image.fromarray((body * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(14))
    body = np.asarray(img.point(lambda v: 255 if v > 127 else 0)) > 127
    return body, face


def trace(mask, alphamax, opttolerance):
    with tempfile.TemporaryDirectory() as tmp:
        pbm = os.path.join(tmp, "m.pbm")
        Image.fromarray(((~mask) * 255).astype(np.uint8)).convert("1").save(pbm)
        out = os.path.join(tmp, "m.svg")
        subprocess.run(["potrace", "-s", "--flat", "-t", "20", "-a", str(alphamax), "-O", str(opttolerance), pbm, "-o", out], check=True)
        return re.search(r"(<g transform=.*?</g>)", open(out).read(), re.S).group(1)


def svg(body, size=1024):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}">{body}</svg>'


def main():
    body, face = masks(os.path.join(HERE, "ghost-concept.png"))
    body_g, face_g = trace(body, 1.25, 0.6), trace(face, 1.2, 0.5)
    os.makedirs(ASSETS, exist_ok=True)
    with open(os.path.join(ASSETS, "1-body.svg"), "w") as f:
        f.write(svg(body_g.replace('fill="#000000"', 'fill="#FFFFFF"')))
    with open(os.path.join(ASSETS, "2-face.svg"), "w") as f:
        f.write(svg(face_g.replace('fill="#000000"', 'fill="#0B1B4D"')))
    # Menu bar template: the silhouette in black with the face knocked out.
    ys, xs = np.nonzero(body)
    pad = 30
    x0, y0, x1, y1 = xs.min() - pad, ys.min() - pad, xs.max() + pad, ys.max() + pad
    side = max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    view = f"{cx - side / 2:.0f} {cy - side / 2:.0f} {side} {side}"
    mask = f'<mask id="m"><rect x="-2000" y="-2000" width="6000" height="6000" fill="white"/>{face_g.replace(chr(34) + "#000000" + chr(34), chr(34) + "black" + chr(34))}</mask>'
    template = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="36" height="36">'
                f'<defs>{mask}</defs><g mask="url(#m)">{body_g}</g></svg>')
    with open(os.path.join(HERE, "menubar.svg"), "w") as f:
        f.write(template)


if __name__ == "__main__":
    main()
