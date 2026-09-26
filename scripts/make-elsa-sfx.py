"""Synthesize Elsa's ice wave and frost-trail cues. Run from the repository root."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import wave

import numpy as np


RATE = 44100
OUT = Path("public/audio")
RNG = np.random.default_rng(283915)


def time(length):
    return np.arange(int(RATE * length)) / RATE


def add(dst, src, at, gain=1):
    index = int(at * RATE)
    count = min(len(src), len(dst) - index)
    dst[index:index + count] += src[:count] * gain


def chirp(length, start, end):
    t = time(length)
    frequency = start * np.power(end / start, t / length)
    return np.sin(2 * np.pi * np.cumsum(frequency) / RATE)


def wind(length, width):
    noise = RNG.normal(0, 1, int(RATE * length))
    return np.convolve(noise, np.ones(width) / width, mode="same")


def bell(length, note):
    t = time(length)
    return (np.sin(2 * np.pi * note * t) + 0.37 * np.sin(2 * np.pi * note * 2.01 * t)) * np.exp(-t * 4.7)


def export(name, signal):
    fade = min(int(RATE * 0.035), len(signal) // 2)
    signal[:fade] *= np.linspace(0, 1, fade)
    signal[-fade:] *= np.linspace(1, 0, fade)
    signal /= max(1, np.max(np.abs(signal)) / 0.88)
    pcm = (signal * 32767).astype("<i2")
    OUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temp:
        source = Path(temp) / "cue.wav"
        with wave.open(str(source), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes(pcm.tobytes())
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(source), "-c:a", "libvorbis", "-q:a", "5", str(OUT / name)], check=True)


wave_cue = np.zeros(int(RATE * 3.45))
t = time(3.15)
envelope = np.minimum(1, t / 0.62) * np.minimum(1, (3.15 - t) / 1.3)
add(wave_cue, wind(3.15, 15) * envelope, 0, 0.73)
add(wave_cue, wind(3.15, 63) * envelope, 0, 0.54)
add(wave_cue, chirp(2.8, 105, 425) * envelope[:int(RATE * 2.8)], 0.12, 0.2)
for at, note in ((0.18, 523), (0.53, 784), (0.9, 1047), (1.36, 1568), (1.85, 1175)):
    add(wave_cue, bell(1.2, note), at, 0.25)
for at in (0.49, 1.05, 1.72, 2.29):
    t = time(0.32)
    add(wave_cue, wind(0.32, 5) * np.exp(-t * 13), at, 0.19)
export("elsa-freeze-wave.ogg", wave_cue)


trail = np.zeros(int(RATE * 0.92))
t = time(0.7)
add(trail, wind(0.7, 9) * np.exp(-t * 5), 0, 0.58)
add(trail, chirp(0.54, 1040, 260) * np.exp(-time(0.54) * 6), 0.015, 0.3)
for at, note in ((0.08, 880), (0.16, 1175), (0.29, 1568)):
    add(trail, bell(0.54, note), at, 0.19)
export("elsa-frost-trail.ogg", trail)
