"""Build original Maleficent spell and dragon cues as compact Ogg files.

Run from the repository root. These are synthesized effects, not recordings.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import wave

import numpy as np


RATE = 44100
OUT = Path("public/audio")
RNG = np.random.default_rng(51623)


def time(length: float) -> np.ndarray:
    return np.arange(int(RATE * length)) / RATE


def smoothed_noise(length: float, width: int) -> np.ndarray:
    noise = RNG.normal(0, 1, int(RATE * length))
    kernel = np.ones(width) / width
    return np.convolve(noise, kernel, mode="same")


def chirp(length: float, start: float, end: float) -> np.ndarray:
    t = time(length)
    frequency = start * np.power(end / start, t / length)
    return np.sin(2 * np.pi * np.cumsum(frequency) / RATE)


def add(dst: np.ndarray, src: np.ndarray, at: float, gain: float = 1) -> None:
    index = int(at * RATE)
    count = min(len(src), len(dst) - index)
    dst[index:index + count] += src[:count] * gain


def export(name: str, signal: np.ndarray) -> None:
    fade = min(int(RATE * 0.025), len(signal) // 2)
    signal[:fade] *= np.linspace(0, 1, fade)
    signal[-fade:] *= np.linspace(1, 0, fade)
    peak = max(1, np.max(np.abs(signal)) / 0.9)
    pcm = (signal / peak * 32767).astype("<i2")
    OUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temp:
        source = Path(temp) / "cue.wav"
        with wave.open(str(source), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-c:a", "libvorbis", "-q:a", "5", str(OUT / name)], check=True)


# Arcane bolt: rushing spell, three uneasy bell notes, and a low seal.
curse = np.zeros(int(RATE * 1.12))
t = time(0.65)
add(curse, smoothed_noise(0.65, 23) * np.sin(np.pi * t / 0.65) ** 2, 0, 0.6)
add(curse, chirp(0.58, 320, 84) * np.exp(-t[:int(RATE * 0.58)] * 4), 0.08, 0.29)
for at, note in ((0.12, 659), (0.25, 466), (0.39, 311)):
    t = time(0.58)
    tone = (np.sin(2 * np.pi * note * t) + 0.35 * np.sin(2 * np.pi * note * 2.01 * t)) * np.exp(-t * 8)
    add(curse, tone, at, 0.28)
export("maleficent-curse.ogg", curse)


# The transformation roar: bass harmonics with irregular growl and a long hiss tail.
roar = np.zeros(int(RATE * 2.15))
t = time(1.9)
pitch = 175 * np.power(65 / 175, t / 1.9) + 9 * np.sin(2 * np.pi * 12 * t)
phase = 2 * np.pi * np.cumsum(pitch) / RATE
growl = (np.sin(phase) + 0.35 * np.sin(2 * phase) + 0.2 * np.sin(3 * phase)) * np.sin(np.pi * t / 1.9) ** 0.8
add(roar, growl, 0.1, 0.72)
t = time(1.9)
add(roar, smoothed_noise(1.9, 16) * np.sin(np.pi * t / 1.9) ** 1.5, 0.1, 0.56)
add(roar, chirp(0.82, 500, 71) * np.exp(-time(0.82) * 2.7), 0.17, 0.25)
export("maleficent-roar.ogg", roar)


# Breath: fiery wide hiss riding a low, sliding magical undertone.
breath = np.zeros(int(RATE * 1.17))
t = time(1.08)
envelope = np.minimum(1, t / 0.09) * np.minimum(1, (1.08 - t) / 0.26)
breath[:len(t)] += smoothed_noise(1.08, 5) * envelope * 0.72
breath[:len(t)] += chirp(1.08, 420, 110) * envelope * 0.22
breath[:len(t)] += smoothed_noise(1.08, 56) * envelope * 0.3
export("maleficent-breath.ogg", breath)


# A target catches the green flame with a sharp crack and a fizzy release.
hit = np.zeros(int(RATE * 0.75))
t = time(0.64)
add(hit, smoothed_noise(0.64, 7) * np.exp(-t * 7), 0.01, 0.8)
add(hit, chirp(0.48, 930, 110) * np.exp(-time(0.48) * 9), 0.02, 0.42)
export("maleficent-hit.ogg", hit)


# A curse resolves, either by skillful drift or a failed boost.
break_cue = np.zeros(int(RATE * 0.76))
for at, note in ((0.01, 740), (0.085, 988), (0.18, 1480)):
    t = time(0.45)
    bell = (np.sin(2 * np.pi * note * t) + 0.24 * np.sin(2 * np.pi * note * 2.02 * t)) * np.exp(-t * 10)
    add(break_cue, bell, at, 0.36)
add(break_cue, smoothed_noise(0.38, 11) * np.exp(-time(0.38) * 9), 0.08, 0.19)
export("maleficent-hex-break.ogg", break_cue)
