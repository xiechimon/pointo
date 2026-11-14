"""Generates Pointo's icon layers into assets/Pointo.icon/Assets (see the app-icon skill).

    python3 assets/icon-src/gen.py

Flat artwork only: Icon Composer (`ictool`, `actool`) adds the glass, highlights and shadows.
Layers, front to back: 3-eyes (white, crisp), 2-cursor (ink), 1-outline (translucent glass).
"""
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "Pointo.icon", "Assets")

# The classic arrow, in local units: tip, down the left edge, the notch, the tail, the right wing.
ARROW = [(0, 0), (0, 600), (146, 474), (244, 690), (342, 646), (246, 432), (436, 432)]
RADII = [34, 44, 26, 40, 40, 26, 44]
SCALE, TIP = 0.88, (322, 204)
EYES = [(84, 318), (180, 318)]  # centres, local units
EYE_W, EYE_H = 50, 86


def rounded_path(points, radii, scale, offset):
    ox, oy = offset
    pts = [(ox + x * scale, oy + y * scale) for x, y in points]
    rs = [r * scale for r in radii]
    d = []
    for i in range(len(pts)):
        p0, p1, p2 = pts[i - 1], pts[i], pts[(i + 1) % len(pts)]
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1, u2 = (v1[0] / l1, v1[1] / l1), (v2[0] / l2, v2[1] / l2)
        angle = math.acos(max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1])))
        t = min(rs[i] / math.tan(angle / 2), l1 * 0.45, l2 * 0.45)
        a = (p1[0] + u1[0] * t, p1[1] + u1[1] * t)
        b = (p1[0] + u2[0] * t, p1[1] + u2[1] * t)
        d.append(f"{'M' if i == 0 else 'L'}{a[0]:.2f},{a[1]:.2f} Q{p1[0]:.2f},{p1[1]:.2f} {b[0]:.2f},{b[1]:.2f}")
    return " ".join(d) + " Z"


def svg(body, size=1024):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
            f'width="{size}" height="{size}">{body}</svg>')


def eyes(fill):
    return "".join(
        f'<rect x="{TIP[0] + x * SCALE - EYE_W / 2:.1f}" y="{TIP[1] + y * SCALE - EYE_H / 2:.1f}" '
        f'width="{EYE_W}" height="{EYE_H}" rx="{EYE_W / 2}" fill="{fill}"/>'
        for x, y in EYES)


def main():
    cursor = rounded_path(ARROW, RADII, SCALE, TIP)
    os.makedirs(OUT, exist_ok=True)
    layers = {
        "1-outline.svg": f'<path d="{cursor}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="64" stroke-linejoin="round"/>',
        "2-cursor.svg": f'<path d="{cursor}" fill="#17171C"/>',
        "3-eyes.svg": eyes("#FFFFFF"),
    }
    for name, body in layers.items():
        with open(os.path.join(OUT, name), "w") as f:
            f.write(svg(body))
    # Menu bar template: the cursor in black with the eyes cut out, on a 36 px (18 pt @2x) canvas.
    box = (TIP[0] - 40, TIP[1] - 40, 349 + 80, 607 + 80)
    view = f"{box[0]} {box[1]} {box[3]} {box[3]}"
    mask = (f'<mask id="m"><rect x="0" y="0" width="1024" height="1024" fill="white"/>{eyes("black")}</mask>')
    template = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view}" width="36" height="36">'
                f'<defs>{mask}</defs><path d="{cursor}" fill="#000" mask="url(#m)" '
                f'transform="translate({(box[3] - box[2]) / 2:.1f},0)"/></svg>')
    with open(os.path.join(HERE, "menubar.svg"), "w") as f:
        f.write(template)


if __name__ == "__main__":
    main()
