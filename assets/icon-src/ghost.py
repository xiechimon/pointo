"""Builds every Pointo icon from one drawing: a paper-white ghost with an ink outline on lilac,
its eyes glancing to the side (it looks where you point).

    python3 assets/icon-src/ghost.py        # needs Pillow and Playwright's Chromium

Writes, from the same geometry:
- `Pointo.icon/` (Icon Composer, macOS 26 Liquid Glass): a lilac fill and three flat layers,
  front to back `3-eyes.svg`, `2-body.svg` (glass), `1-outline.svg`. No baked shadow, highlight or
  mask: the system draws the rounded square and the glass.
- `app-icon-macos.png`: the macOS 15 icon on Apple's grid (1024 canvas, 824 pt rounded square at
  100 pt, continuous corners, the template's drop shadow), and `Pointo.icns` from it.
- `app-icon.png`: the full-bleed rounded square, for the Windows tray, `Pointo.ico` and the app's
  own windows.
- `menubar-icon@2x.png`: the menu bar template (black silhouette, eyes cut out, 18 pt).
- The site's icons and the promo's `icon.png`.

`rendered/*.png` are Icon Composer's own renders of `Pointo.icon` (Default, Dark, Tinted), exported
on a Mac. When `rendered/default.png` is there, the macOS PNG/icns, the site and the promo use it
instead of the flat drawing, so they show the real glass.
"""
import os
import subprocess
import tempfile

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
ASSETS = os.path.join(ROOT, "assets")

INK = "#0D0D0F"
PAPER = "#F3F1EA"
LILAC = "#C4B5FF"

# The ghost, in the 1024 full-bleed space Icon Composer uses.
X0, X1, TOP, BOT = 282, 742, 198, 826
TEETH = 4
STROKE = 48  # drawn centred, so 24 shows outside the body
EYE_Y, EYE_RX, EYE_RY = 458, 32, 48
EYES_X = (494, 637)  # centre 512 + 54: they glance to the right


def ghost_path():
    r = (X1 - X0) / 2
    cy = TOP + r
    d = f"M{X0} {cy} A{r} {r} 0 0 1 {X1} {cy} V{BOT}"
    w = (X1 - X0) / TEETH
    for i in range(TEETH):
        a = X1 - i * w
        d += f" L{a - w / 2:.1f} {BOT - 64} L{a - w:.1f} {BOT}"
    return d + " Z"


GHOST = ghost_path()


def eyes(fill):
    return "".join(
        f'<ellipse cx="{x}" cy="{EYE_Y}" rx="{EYE_RX}" ry="{EYE_RY}" fill="{fill}"/>' for x in EYES_X
    )


def outline_layer():
    return (
        f'<path d="{GHOST}" fill="{INK}" stroke="{INK}" stroke-width="{STROKE}" '
        'stroke-linejoin="round"/>'
    )


def body_layer():
    return f'<path d="{GHOST}" fill="{PAPER}"/>'


def art():
    return outline_layer() + body_layer() + eyes(INK)


def svg(body, size=1024, view="0 0 1024 1024", defs=""):
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="{size}" height="{size}">'
        f"{defs}{body}</svg>"
    )


def squircle(x, y, s, n=5.0, steps=720):
    """Apple's continuous-corner rounded square, as a superellipse |x|^n + |y|^n = 1."""
    import math

    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        c, si = math.cos(t), math.sin(t)
        px = math.copysign(abs(c) ** (2 / n), c)
        py = math.copysign(abs(si) ** (2 / n), si)
        pts.append((x + s / 2 + px * s / 2, y + s / 2 + py * s / 2))
    return "M" + " L".join(f"{a:.2f} {b:.2f}" for a, b in pts) + " Z"


FULL = squircle(0, 0, 1024)


def full_bleed():
    clip = f'<defs><clipPath id="sq"><path d="{FULL}"/></clipPath></defs>'
    return svg(f'<g clip-path="url(#sq)"><rect width="1024" height="1024" fill="{LILAC}"/>{art()}</g>', defs=clip)


def apple_grid():
    """macOS app icon template: 824 pt body at (100, 100), shadow y 10 pt, blur 10 pt, 30 % black."""
    s = 824 / 1024
    defs = (
        f'<defs><clipPath id="sq"><path d="{FULL}"/></clipPath>'
        '<filter id="sh" x="-20%" y="-20%" width="140%" height="140%">'
        '<feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#000" flood-opacity="0.3"/>'
        "</filter></defs>"
    )
    body = (
        f'<g transform="translate(100 100) scale({s})"><g filter="url(#sh)">'
        f'<path d="{FULL}" fill="{LILAC}"/></g>'
        f'<g clip-path="url(#sq)">{art()}</g></g>'
    )
    return svg(body, defs=defs)


def on_grid(full):
    """A full-bleed render placed on Apple's grid (824 at 100) with the template's shadow."""
    from PIL import ImageFilter

    body = full.resize((824, 824), Image.LANCZOS)
    out = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    alpha = Image.new("L", (1024, 1024), 0)
    alpha.paste(body.getchannel("A"), (100, 110))
    shadow = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    shadow.putalpha(alpha.filter(ImageFilter.GaussianBlur(10)).point(lambda a: int(a * 0.3)))
    out.alpha_composite(shadow)
    out.alpha_composite(body, (100, 100))
    return out


def touch_icon():
    """Apple touch icon: opaque and square; iOS rounds it."""
    return svg(f'<rect width="1024" height="1024" fill="{LILAC}"/>{art()}')


def menubar():
    """Template image: black, transparent, 18 pt (36 px @2x). The ghost fills the height."""
    pad = STROKE / 2
    x0, x1, y0, y1 = X0 - pad, X1 + pad, TOP - pad, BOT + pad
    side = (y1 - y0) * 36 / 32  # a 16 pt glyph in the 18 pt square
    view = f"{(x0 + x1) / 2 - side / 2:.1f} {(y0 + y1) / 2 - side / 2:.1f} {side:.1f} {side:.1f}"
    defs = (
        '<defs><mask id="m"><rect x="0" y="0" width="1024" height="1024" fill="white"/>'
        f"{eyes('black')}</mask></defs>"
    )
    body = (
        f'<path d="{GHOST}" fill="#000" stroke="#000" stroke-width="{STROKE}" '
        'stroke-linejoin="round" mask="url(#m)"/>'
    )
    return svg(body, size=36, view=view, defs=defs)


def render(svgs):
    """SVG text -> PNG files, rendered by Chromium. svgs: {out_path: (svg, size)}."""
    with tempfile.TemporaryDirectory() as tmp:
        jobs = []
        for i, (out, (text, size)) in enumerate(svgs.items()):
            src = os.path.join(tmp, f"{i}.svg")
            with open(src, "w") as f:
                f.write(text)
            jobs.append({"src": src, "out": out, "size": size})
        script = os.path.join(tmp, "r.cjs")
        with open(script, "w") as f:
            f.write(
                "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();"
                "const p=await b.newPage();for(const j of " + repr(jobs).replace("'", '"') + "){"
                "await p.setViewportSize({width:j.size,height:j.size});"
                "await p.goto('file://'+j.src);"
                "await p.screenshot({path:j.out,omitBackground:true});}await b.close();})();"
            )
        subprocess.run(["node", script], check=True)


def p3(hex_color):
    """sRGB hex -> Display P3 components, for icon.json."""
    r, g, b = (int(hex_color[i : i + 2], 16) / 255 for i in (1, 3, 5))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    enc = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    r, g, b = lin(r), lin(g), lin(b)
    # linear sRGB -> XYZ (D65) -> linear Display P3
    x = 0.4124 * r + 0.3576 * g + 0.1805 * b
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = 0.0193 * r + 0.1192 * g + 0.9505 * b
    pr = 2.4935 * x - 0.9314 * y - 0.4027 * z
    pg = -0.8295 * x + 1.7627 * y + 0.0236 * z
    pb = 0.0358 * x - 0.0762 * y + 0.9569 * z
    return ",".join(f"{max(0, min(1, enc(c))):.5f}" for c in (pr, pg, pb)) + ",1.00000"


ICON_JSON = """{
  "color-space-for-untagged-svg-colors" : "display-p3",
  "fill" : { "solid" : "display-p3:%s" },
  "groups" : [
    {
      "name" : "Eyes",
      "layers" : [ { "image-name" : "3-eyes.svg", "name" : "Eyes", "glass" : false } ],
      "shadow" : { "kind" : "none", "opacity" : 0 },
      "translucency" : { "enabled" : false, "value" : 0 }
    },
    {
      "name" : "Ghost",
      "layers" : [
        { "image-name" : "2-body.svg", "name" : "Body", "glass" : true },
        { "image-name" : "1-outline.svg", "name" : "Outline", "glass" : false }
      ],
      "lighting" : "combined",
      "specular" : true,
      "shadow" : { "kind" : "neutral", "opacity" : 0.35 },
      "translucency" : { "enabled" : true, "value" : 0.1 }
    }
  ],
  "supported-platforms" : { "squares" : "shared" }
}
"""


def main():
    layers = os.path.join(ASSETS, "Pointo.icon", "Assets")
    for name in os.listdir(layers):
        os.remove(os.path.join(layers, name))
    for name, body in (
        ("1-outline.svg", outline_layer()),
        ("2-body.svg", body_layer()),
        ("3-eyes.svg", eyes(INK)),
    ):
        with open(os.path.join(layers, name), "w") as f:
            f.write(svg(body))
    with open(os.path.join(ASSETS, "Pointo.icon", "icon.json"), "w") as f:
        f.write(ICON_JSON % p3(LILAC))
    with open(os.path.join(ASSETS, "icon.svg"), "w") as f:
        f.write(full_bleed())
    with open(os.path.join(HERE, "menubar.svg"), "w") as f:
        f.write(menubar())
    with open(os.path.join(ROOT, "site", "public", "icon.svg"), "w") as f:
        f.write(full_bleed())

    site = os.path.join(ROOT, "site", "public")
    render(
        {
            os.path.join(ASSETS, "app-icon.png"): (full_bleed(), 1024),
            os.path.join(ASSETS, "app-icon-macos.png"): (apple_grid(), 1024),
            os.path.join(ASSETS, "menubar-icon@2x.png"): (menubar(), 36),
            os.path.join(site, "icon-1024.png"): (full_bleed(), 1024),
            os.path.join(site, "apple-touch-icon.png"): (touch_icon(), 180),
        }
    )
    flat = Image.open(os.path.join(ASSETS, "app-icon.png")).convert("RGBA")
    real = os.path.join(HERE, "rendered", "default.png")
    full = Image.open(real).convert("RGBA") if os.path.exists(real) else flat
    if full is not flat:
        full.save(os.path.join(site, "icon-1024.png"))
        on_grid(full).save(os.path.join(ASSETS, "app-icon-macos.png"))
    for size, name in ((512, "icon-512.png"), (192, "icon-192.png"), (32, "favicon-32.png")):
        full.resize((size, size), Image.LANCZOS).save(os.path.join(site, name))
    full.save(os.path.join(ROOT, "promo", "public", "icon.png"))
    flat.save(
        os.path.join(ASSETS, "Pointo.ico"),
        sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
    )
    grid = Image.open(os.path.join(ASSETS, "app-icon-macos.png")).convert("RGBA")
    grid.save(os.path.join(ASSETS, "Pointo.icns"))


if __name__ == "__main__":
    main()
