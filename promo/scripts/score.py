"""Write the film's score (ABC) and sound-effect cues into score/index.html for huashu-motion.

The picture sits on a 120 BPM grid, 18 bars of 4/4 (src/timing.ts), so every bar here is
one bar of the film. `npx om sound score` then performs it (real instruments once
`om samples build` has run, synths otherwise) and writes score/assets/sound.wav.

    python3 scripts/score.py && npx om sound score
"""

import json
import re

BARS = 18
# One chord per bar in D dorian: Dm7 · G9 (rootless) · Fmaj7 · C6
PROG = ['Dm', 'G', 'F', 'C']
CHORD = {'Dm': '[DFAc]', 'G': '[B,DFA]', 'F': '[FAce]', 'C': '[CEGA]'}
LOW = {'Dm': '[D,F,A,]', 'G': '[G,,B,,F,]', 'F': '[F,A,C]', 'C': '[C,E,G,]'}
ROOT = {'Dm': 'D,,', 'G': 'G,,', 'F': 'F,,', 'C': 'C,,'}
OCT = {'Dm': 'D,', 'G': 'G,', 'F': 'F,', 'C': 'C,'}
ARP = {'Dm': 'DFAc AFAc', 'G': 'B,DFA FDFA', 'F': 'FAce cAce', 'C': 'CEGA GEGA'}


def chord(b):
    return PROG[b % 4]


def length(bar):
    """Eighths in an ABC bar (L:1/8), ignoring decorations and chords' inner notes."""
    s = re.sub(r'![^!]*!', '', bar)
    s = re.sub(r'\[[A-Za-z]:[^\]]*\]', '', s)
    s = re.sub(r'\[[^\]]*\]', 'X', s)  # a chord counts as one note
    s = re.sub(r'\(3', '', s)
    total = 0.0
    for m in re.finditer(r"([_^=]*[A-Ga-gzXZ][,']*)(\d*)(/*)(\d*)", s):
        num = int(m.group(2)) if m.group(2) else 1
        slashes = len(m.group(3))
        den = int(m.group(4)) if m.group(4) else (2 ** slashes if slashes else 1)
        total += num / den
    return total


VOICES = {}


def voice(name, header, bars):
    assert len(bars) == BARS, (name, len(bars))
    for i, b in enumerate(bars):
        n = length(b)
        assert abs(n - 8) < 1e-6, f'{name} bar {i}: {n} eighths: {b}'
    VOICES[name] = (header, bars)


# ---------- the arrangement ----------
# Funk/disco in D dorian: live kit, finger bass in octaves, clav off-beat chops, brass stabs
# closing the phrases, marimba pulse, rhodes in the verse, strings for the motif at the drops.
# bars: 0–1 hook · 2–3 title · 4–8 demo verse · 9 build · 10–12 compile/deliver/tools ·
#       13 breakdown · 14 build · 15–16 end drop (the peak) · 17 button

Z = 'z8'
DROPS = (2, 10, 11, 12, 15, 16)
PEAK = (15, 16)

# motif: D F A G  ("指 给 它 看")
voice('MOT', 'inst=bell role=melody gain=0.5', [
    '!mark:hook! !mp! d2 f2 a2 g2', 'd2 f2 z4',
    '!mark:title! z8', '!mp! d2 f2 a2 g2',
    '!mark:demo! z8', Z, Z, Z, Z,
    Z,
    '!mark:compile! z8', Z, Z,
    '!mark:local! !p! d4 f2 a2', Z,
    '!mark:end! z8', Z,
    '!mf! d2 f2 a2 [gd\']2',
])

voice('STR', 'inst=strings role=melody gain=0.7', [
    Z, Z,
    '!mf! [dd\']2 [ff\']2 [aa\']2 [gg\']2', '[ff\']4 [ee\']4',
    Z, Z, Z, Z,
    '!p! !crescendo(! [DA]4 [FA]4', '[Ac]4 [Gd]2 [Ae]2 !crescendo)!',
    Z, Z, Z,
    '!pp! [D,A,]8', Z,
    '!ff! [dd\'d\'\']2 [ff\'f\'\']2 [aa\'a\'\']2 [gg\'g\'\']2', '[ff\']3 [ee\']3 [dd\']2',
    Z,
])

def marimba(b):
    c = chord(b)
    if b == 1:
        return ARP[c].split(' ')[0] + ' z4'
    if b in (3, 17):
        return Z
    dyn = {0: '!mp! ', 4: '!mp! ', 13: '!pp! ', 2: '!mf! ', 15: '!f! '}.get(b, '')
    return dyn + ARP[c]

voice('MAR', 'inst=marimba gain=0.5', [marimba(b) for b in range(BARS)])

def clav(b):
    c = CHORD[chord(b)]
    if b in DROPS or b == 0:
        return f'z/ {c}/ z {c}/ z/ z z/ {c}/ z {c}/ z/ z'
    return Z

voice('CLV', 'inst=clav gain=0.5', [clav(b) for b in range(BARS)])

def brass(b):
    c = CHORD[chord(b)]
    if b in (2, 12, 16):
        return f'z6 {c}/ z/ {c}'
    if b == 15:
        return f'!ff! {c}2 z6'
    if b == 17:
        return f'{CHORD["Dm"]}z z2 z4'
    return Z

voice('BRS', 'inst=brass gain=0.55', [brass(b) for b in range(BARS)])

def rhodes(b):
    c = CHORD[chord(b)]
    if 4 <= b <= 9:
        return f'!mp! {c}3 z {c} z3'
    if b in (13, 14):
        return f'!p! {c}8'
    return Z

voice('RH', 'inst=rhodes gain=0.6', [rhodes(b) for b in range(BARS)])

def pad(b):
    c = LOW[chord(b)]
    if b in (3, 13):
        return f'!p! {c}8'
    if 4 <= b <= 8:
        return f'!pp! {c}8'
    if b in PEAK:
        return f'!mf! {c}8'
    return Z

voice('PAD', 'inst=warmpad gain=0.4', [pad(b) for b in range(BARS)])

def bass(b):
    c = chord(b)
    r, o = ROOT[c], OCT[c]
    if b == 1:
        return f'{r}{r}{r}{r} z4'
    if b in DROPS:
        return ('!f! ' if b != 15 else '!ff! ') + f'{r}/{o}/ z/{r}/ {o}/z/ {r}/{o}/ {r}/{o}/ z/{r}/ {o}/z/ {r}/{o}/'
    if b == 3:
        return f'{r}4 z4'
    if 4 <= b <= 8:
        return f'!mf! {r}3 {r}3 {r}2'
    if b in (9, 14):
        return f'{r}{r}{r}{r} {r}{r}{r}{r}'
    if b == 13:
        return f'!p! {r}8'
    if b == 17:
        return f'{r}z z2 z4'
    return f'!mf! {r}{r}{r}{r} {r}{r}{r}{r}'

voice('BAS', 'inst=bass gain=0.85', [bass(b) for b in range(BARS)])

def kick(b):
    disco = 'C,,2 [C,,D,,]2 C,,2 [C,,D,,]2'
    if b == 0:
        return '!mf! ' + disco
    if b == 1:
        return 'C,,2 [C,,D,,]2 z4'
    if b == 3:
        return 'C,,2 z2 z4'
    if 4 <= b <= 8:
        return '!mp! C,,2 z2 D,,2 z C,,'
    if b == 9:
        return '!filter(! !crescendo(! C,,D,, C,,D,, D,,/D,,/D,,/D,,/ D,,/D,,/D,,/D,,/ !crescendo)! !filter)!'
    if b == 13:
        return '!p! C,,2 z2 z4'
    if b == 14:
        return '!crescendo(! C,,D,, C,,D,, D,,/D,,/D,,/D,,/ !crescendo)! !rise(! z2'
    if b == 15:
        return '!rise)! !hit! !ff! ' + disco
    if b == 17:
        return '[C,,D,,]z z2 z4'
    if b == 2:
        return '!hit! !f! ' + disco
    if b == 12:
        return '!f! C,,2 [C,,D,,]2 !stutter(! C,,2 [C,,D,,]2 !stutter)!'
    return '!f! ' + disco

voice('DK', 'inst=drums kit=acoustic gain=0.9', [kick(b) for b in range(BARS)])

def hats(b):
    off = 'z ^A,, z ^A,, z ^A,, z ^A,,'
    if b == 0:
        return '!mp! ^C,^F,, ^F,,^F,, ^F,,^F,, ^F,,^F,,'
    if b == 1:
        return '^F,,^F,, ^F,,^F,, !rise(! z4'
    if b == 2:
        return '!rise)! ^C,^A,, z ^A,, z ^A,, z ^A,,'
    if b == 15:
        return '^C,^A,, z ^A,, z ^A,, z ^A,,'
    if b in (3, 17):
        return Z
    if 4 <= b <= 8:
        return '!mp! ^F,,^F,, ^F,,^F,, ^F,,^F,, ^F,,^F,,' if b < 8 else '^F,,^F,, ^F,,^F,, ^F,,^F,, A,,A,,'
    if b == 13:
        return '!pp! z4 ^F,2 z2'
    if b == 16:
        return '^F,^A,, z ^A,, ^F,^A,, ^C,2'
    if b in (9, 14):
        return '^F,,/^F,,/^F,,/^F,,/ ^F,,/^F,,/^F,,/^F,,/ ^F,,/^F,,/^F,,/^F,,/ ^F,,/^F,,/^F,,/^F,,/' if b == 9 else '^F,,/^F,,/^F,,/^F,,/ ^F,,/^F,,/^F,,/^F,,/ ^F,,/^F,,/^F,,/^F,,/ z2'
    return off

voice('HT', 'inst=drums kit=acoustic gain=0.6', [hats(b) for b in range(BARS)])

# ---------- sound effects, in seconds on the film's clock ----------
SFX = [
    # hook / title
    ('glitch', 3.5, {'gain': 0.5}),
    ('chime', 6.1, {'gain': 0.5}),
    ('pop', 7.08, {'note': 1, 'gain': 0.6}), ('pop', 7.17, {'note': 3, 'gain': 0.6}), ('pop', 7.25, {'note': 5, 'gain': 0.6}),
    # recording starts: the three keys, the pill
    ('click', 8.0, {'pan': -0.3}), ('click', 8.5, {'pan': 0}), ('click', 9.0, {'pan': 0.3}),
    ('pop', 9.27, {'gain': 0.5, 'note': 3}),
    # click, ink, markers
    ('click', 13.0, {'gain': 0.9}),
    ('tick', 13.07, {}),
    ('draw', 14.4, {'dur': 0.95, 'gain': 0.7}),
    ('tick', 15.37, {}),
    ('whip', 15.6, {'gain': 0.7}),
    ('draw', 15.75, {'dur': 0.45, 'gain': 0.7}),
    ('tick', 16.23, {}),
    # stop: keys, then the keyframes peel off on the beat
    ('click', 16.5, {'pan': -0.3}), ('click', 17.0, {'pan': 0}), ('click', 17.5, {'pan': 0.3}),
    ('ding', 18.0, {'note': 5}),
    ('shutter', 18.0, {}), ('shutter', 18.27, {}), ('shutter', 18.53, {}),
    ('whoosh', 18.4, {'gain': 0.7}),
    ('slide', 19.5, {'gain': 0.6}),
    # the bundle
    ('slide', 20.4, {'gain': 0.6}), ('slide', 20.6, {'gain': 0.5}),
    ('whoosh', 21.8, {'gain': 0.7}),
    # delivered, read, fixed
    ('thud', 22.35, {}),
    ('type', 22.0, {'dur': 0.37}),
    ('tick', 22.4, {}), ('tick', 22.55, {}), ('tick', 22.7, {}), ('tick', 22.85, {}), ('chime', 23.0, {'gain': 0.5}),
    ('ding', 23.15, {'note': 1}),
    ('hit', 24.0, {}), ('hit', 24.25, {'gain': 0.8}), ('hit', 24.5, {'gain': 0.8}), ('hit', 24.75, {'gain': 0.8}), ('hit', 25.0, {'gain': 0.8}),
    ('whoosh', 25.3, {'gain': 0.6}),
    ('stamp', 28.0, {}), ('stamp', 28.5, {}), ('stamp', 29.0, {}),
    # the end card
    ('pop', 30.5, {'note': 1}),
    ('draw', 33.0, {'dur': 0.4, 'gain': 0.8}),
    ('whoosh', 34.1, {'gain': 0.6}), ('pop', 34.55, {'note': 5}),
]

header = """X:1
T:Pointo · 指给它看
M:4/4
L:1/8
Q:1/4=120
K:Ddor
"""
abc = header + ''.join(f'V:{n} {h}\n' + ' | '.join(bars) + ' |\n' for n, (h, bars) in VOICES.items())

labels = [('hook', 0), ('title', 4), ('demo', 8), ('compile', 20), ('local', 26), ('end', 30)]
sfx_js = '\n'.join(f'  OM.sfx({json.dumps(n)}, {t}, {json.dumps(o)});' for n, t, o in SFX)
label_js = '\n'.join(f"  tl.addLabel('scene:{n}', {t});" for n, t in labels)

html = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>Pointo · score</title>
<script src="vendor/gsap.min.js"></script>
<script src="vendor/om.js"></script>
<style>html, body {{ margin: 0; width: 100%; height: 100%; background: #000; }}</style>
</head>
<body>
<!-- Generated by scripts/score.py. The picture is rendered by Remotion; this file only carries
     the score and the sound-effect cues on the film's 36 s timeline. -->
<div id="film" data-composition-id="film" data-width="1920" data-height="1080"></div>
<script type="text/vnd.abc" id="om-score">
{abc}</script>
<script>
  const tl = gsap.timeline({{ paused: true }});
{label_js}
  tl.to({{}}, {{ duration: 36 }}, 0);
{sfx_js}
  window.__timelines['film'] = tl;
</script>
</body>
</html>
"""
open('score/index.html', 'w').write(html)
print(f'score/index.html  {len(VOICES)} voices · {BARS} bars · {len(SFX)} sfx')
