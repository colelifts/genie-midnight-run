"""Original synthesized Pluto cues; run from the repo root, then encode with ffmpeg.

The dog bark is a separately credited CC0 field recording, not made here.
"""
from pathlib import Path
import wave

import numpy as np

RATE = 44100
OUT = Path("public/audio")
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(626)


def write(name: str, signal: np.ndarray) -> None:
    peak = max(1.0, float(np.max(np.abs(signal))) / 0.92)
    data = (signal / peak * 32767).astype("<i2")
    with wave.open(str(OUT / name), "wb") as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(RATE)
        audio.writeframes(data.tobytes())


def sweep(seconds: float, high: float, low: float) -> np.ndarray:
    t = np.arange(int(seconds * RATE)) / RATE
    frequency = high * np.power(low / high, t / seconds)
    phase = 2 * np.pi * np.cumsum(frequency) / RATE
    noise = rng.normal(0, 1, len(t))
    filtered = np.convolve(noise, np.ones(90) / 90, mode="same")
    envelope = np.sin(np.pi * t / seconds) ** 1.3
    return (0.58 * np.sin(phase) + 0.3 * filtered) * envelope


def add_at(mix: np.ndarray, signal: np.ndarray, seconds: float, gain: float) -> None:
    offset = int(seconds * RATE)
    length = min(len(signal), len(mix) - offset)
    mix[offset:offset + length] += signal[:length] * gain


# A quick wet whip with a bright trailing snap.
tongue = np.zeros(int(0.5 * RATE))
add_at(tongue, sweep(0.36, 950, 130), 0, 0.72)
t = np.arange(int(0.07 * RATE)) / RATE
add_at(tongue, (rng.normal(0, 1, len(t)) * np.exp(-t * 50)), 0.27, 0.4)
write("pluto-tongue.wav", tongue)

# Rounded impact, gravel, and a short golden shimmer.
paw = np.zeros(int(1.18 * RATE))
t = np.arange(len(paw)) / RATE
low = np.sin(2 * np.pi * (95 * t - 48 * t * t)) * np.exp(-t * 7)
gravel = rng.normal(0, 1, len(paw))
gravel = np.convolve(gravel, np.ones(60) / 60, mode="same") * np.exp(-t * 5)
paw += 0.65 * low + 0.4 * gravel
add_at(paw, sweep(0.38, 420, 90), 0.04, 0.27)
write("pluto-paw.wav", paw)

# Glittering lift for the glider opening.
glide = np.zeros(int(1.35 * RATE))
add_at(glide, sweep(0.75, 280, 790), 0, 0.32)
for index, frequency in enumerate((523.25, 659.25, 783.99, 1046.5)):
    t = np.arange(int(0.64 * RATE)) / RATE
    bell = (np.sin(2 * np.pi * frequency * t) + 0.3 * np.sin(2 * np.pi * frequency * 2.01 * t)) * np.exp(-t * 6.5)
    add_at(glide, bell, 0.18 + index * 0.11, 0.21)
write("pluto-glider.wav", glide)
