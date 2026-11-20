"""Synthesize the promo soundtrack: an original 120 BPM electronic bed, 18 bars (36 s).

No samples or third-party audio: every sound is generated here with numpy, so the
track is free to publish anywhere. The arrangement is fixed to the video's bar grid
(see src/timing.ts): impacts land on bar 2 (title) and bar 15 (end card).

    python3 scripts/music.py            # writes public/music.wav
"""

import os
import wave

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 18
TAIL = 0.0
N = int(SR * (BAR * BARS + TAIL))
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def t_of(bar, beat=0.0):
    return (bar * 4 + beat) * BEAT


def add(sig, at, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * np.sqrt((1 - pan) / 2) * np.sqrt(2)
    R[i : i + len(sig)] += sig * gain * np.sqrt((1 + pan) / 2) * np.sqrt(2)


def env(n, a=0.005, d=0.2, s=0.0, r=0.05, hold=None):
    """ADSR envelope of n samples (hold = seconds before release)."""
    t = np.arange(n) / SR
    hold = hold if hold is not None else n / SR - r
    e = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = t > hold
    e[rel] *= np.exp(-(t[rel] - hold) / max(r, 1e-6))
    return e


def midi(m):
    return 440 * 2 ** ((m - 69) / 12)


def saw(f, n, detune=0.0):
    t = np.arange(n) / SR
    out = np.zeros(n)
    for d in (-detune, 0, detune) if detune else (0,):
        ph = (t * f * (1 + d) + rng.random()) % 1
        out += 2 * ph - 1
    return out / (3 if detune else 1)


def lowpass(x, cutoff):
    """One-pole lowpass; cutoff may be an array (sweep)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def lp2(x, cutoff):
    return lowpass(lowpass(x, cutoff), cutoff)


# ---------- sounds ----------

def kick():
    n = int(0.45 * SR)
    t = np.arange(n) / SR
    f = 48 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.22)
    click = rng.standard_normal(n) * np.exp(-t / 0.003) * 0.3
    return np.tanh((body + click) * 1.6)


def clap():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    e = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.022)):
        e += (t >= off) * np.exp(-np.clip(t - off, 0, None) / (0.012 if k < 2 else 0.12))
    x = noise * e
    x = x - lowpass(x, 900)  # highpass
    return lowpass(x, 6000) * 0.7


def hat(open_=False):
    n = int((0.25 if open_ else 0.06) * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - lowpass(x, 7000)
    return x * np.exp(-t / (0.08 if open_ else 0.015)) * 0.5


def pluck(m, length=0.35, bright=4500):
    n = int(length * SR)
    x = saw(midi(m), n, 0.004) + 0.5 * np.sin(2 * np.pi * midi(m + 12) * np.arange(n) / SR)
    t = np.arange(n) / SR
    x = lp2(x, 300 + bright * np.exp(-t / 0.08))
    return x * env(n, 0.002, 0.18, 0.0, 0.05)


def pad(notes, length, cutoff=1400):
    n = int(length * SR)
    x = sum(saw(midi(m), n, 0.006) for m in notes) / len(notes)
    t = np.arange(n) / SR
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / 3.7)
    x = lp2(x, cutoff * (0.7 + 0.3 * lfo))
    a = np.clip(t / 0.4, 0, 1)
    r = np.clip((length - t) / 0.5, 0, 1)
    return x * a * r


def bass(m, length):
    n = int(length * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * midi(m) * t)
    grit = lp2(saw(midi(m), n), 500)
    return np.tanh((sub + 0.35 * grit) * 1.4) * env(n, 0.004, 0.25, 0.65, 0.04)


def riser(length):
    n = int(length * SR)
    t = np.arange(n) / SR
    x = rng.standard_normal(n)
    x = x - lowpass(x, 300 + 5000 * (t / length) ** 2)
    sweep = np.sin(2 * np.pi * np.cumsum(220 + 880 * (t / length) ** 2) / SR) * 0.25
    return (x * 0.35 + sweep) * (t / length) ** 2


def impact():
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-t / 0.08)) / SR) * np.exp(-t / 0.7)
    crash = rng.standard_normal(n)
    crash = (crash - lowpass(crash, 4000)) * np.exp(-t / 0.9) * 0.35
    return np.tanh(boom * 1.4) + crash


def blip(m):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * midi(m) * t) * np.exp(-t / 0.03) * 0.6


# ---------- arrangement ----------
# One chord per bar: Fmaj7 · G6 · Am7 · Em7 (A minor / C major colour).
CHORDS = [
    ([53, 57, 60, 64], 41),  # Fmaj7, bass F
    ([55, 59, 62, 64], 43),  # G6
    ([57, 60, 64, 67], 45),  # Am7
    ([52, 55, 59, 62], 40),  # Em7
]
ARP = [0, 1, 2, 3, 2, 1, 2, 3]

KICK, CLAP, HAT, OHAT = kick(), clap(), hat(), hat(True)

for bar in range(BARS):
    notes, root = CHORDS[bar % 4]
    full = 2 <= bar <= 14 and bar != 13
    outro = bar >= 15

    # pad: always, brighter in the groove, open at the end
    cutoff = 900 if bar < 2 else (2200 if full else 1600)
    add(pad(notes, BAR + 0.5, cutoff), t_of(bar), 0.20)

    # arp (8ths) from bar 0, louder from bar 4
    if bar < 17:
        for k in range(8):
            m = notes[ARP[k]] + 12
            g = 0.10 if bar < 2 else (0.16 if bar >= 4 else 0.12)
            add(pluck(m, bright=2500 if bar < 2 else 5000), t_of(bar, k * 0.5), g, pan=-0.35 if k % 2 else 0.35)

    if full or bar == 13:
        # bass: offbeat-pumping eighths
        for k in range(8):
            if k % 2 == 1 or bar == 13:
                add(bass(root, BEAT * 0.45), t_of(bar, k * 0.5), 0.32)

    if full:
        for b in range(4):
            add(KICK, t_of(bar, b), 0.75)
            if b in (1, 3) and bar >= 4:
                add(CLAP, t_of(bar, b), 0.35)
            for s in range(4):
                if bar >= 4 or s == 2:
                    add(OHAT if s == 2 else HAT, t_of(bar, b + s * 0.25), 0.10 if s == 2 else 0.06, pan=0.2)

    if bar == 13:
        # breakdown: kick on 1 only, snare roll into the end card
        add(KICK, t_of(bar), 0.75)
        for k in range(16):
            beat = 2 + k / 8
            add(CLAP, t_of(bar, beat), 0.06 + 0.25 * (k / 16) ** 2)

    if outro:
        add(bass(root, BAR * 0.9), t_of(bar), 0.25)

# risers + impacts on the two big moments
add(riser(BEAT * 2), t_of(2) - BEAT * 2, 0.5)
add(impact(), t_of(2), 0.55)
add(riser(BEAT * 2), t_of(15) - BEAT * 2, 0.5)
add(impact(), t_of(15), 0.65)

# UI blips the picture hits: key presses (bar 4), click (bar 6.5), keyframe cuts, send
for at, m in [
    (t_of(4, 0), 84), (t_of(4, 1), 86), (t_of(4, 2), 91),
    (t_of(6, 2), 96),
    (t_of(9, 0), 84), (t_of(9, 1), 86), (t_of(9, 2), 91),
    (t_of(11, 0), 98),
]:
    add(blip(m), at, 0.35)

# ---------- master ----------
# stereo ping-pong delay (dotted 8th) for width
d = int(BEAT * 0.75 * SR)
dl, dr = np.zeros(N), np.zeros(N)
dl[d:] = R[:-d] * 0.22
dr[d:] = L[:-d] * 0.22
L += dl
R += dr

mix = np.stack([L, R], axis=1)
# gentle glue + fade at the very end
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
fade = int(1.5 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 1.5
mix /= np.abs(mix).max() / 0.89

os.makedirs("public", exist_ok=True)
with wave.open("public/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print(f"public/music.wav  {N / SR:.1f}s")
