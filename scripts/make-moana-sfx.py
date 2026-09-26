"""Synthesize Moana's tide, wave, and current cues. Run from repository root."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import wave

import numpy as np


RATE = 44100
OUT = Path("public/audio")
RNG = np.random.default_rng(321641)


def time(length):
    return np.arange(int(RATE * length)) / RATE


def add(dst, src, at=0, gain=1):
    index = int(at * RATE)
    count = min(len(src), len(dst) - index)
    dst[index:index + count] += src[:count] * gain


def surf(length, grain=35):
    t = time(length)
    noise = RNG.normal(0, 1, len(t))
    low = np.convolve(noise, np.ones(grain) / grain, mode="same")
    mid = np.convolve(noise, np.ones(9) / 9, mode="same")
    swell = np.minimum(1, t / 0.18) * np.minimum(1, (length - t) / 0.42)
    return (low * 1.4 + mid * 0.24) * swell


def chime(length, frequency):
    t = time(length)
    return (np.sin(2 * np.pi * frequency * t)
            + 0.22 * np.sin(2 * np.pi * frequency * 2.01 * t)) * np.exp(-4.4 * t)


def sweep(length, start, end):
    t = time(length)
    freq = start * (end / start) ** (t / length)
    return np.sin(2 * np.pi * np.cumsum(freq) / RATE)


def export(name, signal):
    fade = min(int(RATE * 0.025), len(signal) // 2)
    signal[:fade] *= np.linspace(0, 1, fade)
    signal[-fade:] *= np.linspace(1, 0, fade)
    signal /= max(1, np.max(np.abs(signal)) / 0.88)
    OUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temp:
        source = Path(temp) / "cue.wav"
        with wave.open(str(source), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes((signal * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source),
                        "-c:a", "libvorbis", "-q:a", "5", str(OUT / name)], check=True)


arrival = np.zeros(int(RATE * 3.1))
t = time(2.8)
envelope = np.minimum(1, t / 0.75) * np.minimum(1, (2.8 - t) / 0.9)
add(arrival, surf(2.8, 71) * envelope, 0, 1.65)
add(arrival, surf(2.8, 13) * envelope, 0, 0.62)
add(arrival, sweep(2.15, 118, 355) * envelope[:int(RATE * 2.15)], 0.25, 0.24)
for at, note in ((0.45, 392), (0.79, 494), (1.12, 587), (1.55, 784), (1.92, 988)):
    add(arrival, chime(0.9, note), at, 0.25)
export("moana-tide-rise.ogg", arrival)

wave_cast = np.zeros(int(RATE * 1.05))
add(wave_cast, surf(0.94, 24), 0, 1.4)
add(wave_cast, sweep(0.63, 210, 520) * np.exp(-time(0.63) * 3.8), 0.06, 0.31)
add(wave_cast, chime(0.42, 740), 0.25, 0.22)
export("moana-wave-cast.ogg", wave_cast)

current = np.zeros(int(RATE * 0.84))
t = time(0.68)
add(current, surf(0.68, 11) * np.exp(-t * 2.8), 0, 1.9)
add(current, sweep(0.43, 520, 195) * np.exp(-time(0.43) * 4.8), 0.03, 0.2)
export("moana-current-splash.ogg", current)
