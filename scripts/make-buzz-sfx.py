"""Synthesize Buzz's launch, laser lock, and pulse cues."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import wave

import numpy as np


RATE = 44100
OUT = Path('public/audio')
RNG = np.random.default_rng(90217)


def time(length):
    return np.arange(int(RATE * length)) / RATE


def add(dst, src, at=0, gain=1):
    index = int(at * RATE)
    count = min(len(src), len(dst) - index)
    dst[index:index + count] += src[:count] * gain


def sweep(length, start, end):
    t = time(length)
    frequency = start * (end / start) ** (t / length)
    return np.sin(2 * np.pi * np.cumsum(frequency) / RATE)


def filtered_noise(length, width):
    raw = RNG.normal(0, 1, int(length * RATE))
    return np.convolve(raw, np.ones(width) / width, mode='same')


def ping(length, frequency):
    t = time(length)
    return (np.sin(2 * np.pi * frequency * t) + 0.27 * np.sin(2 * np.pi * frequency * 2.02 * t)) * np.exp(-t * 7)


def export(name, signal):
    fade = min(int(RATE * 0.02), len(signal) // 2)
    signal[:fade] *= np.linspace(0, 1, fade)
    signal[-fade:] *= np.linspace(1, 0, fade)
    signal /= max(1, np.max(np.abs(signal)) / 0.88)
    OUT.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory() as temp:
        source = Path(temp) / 'cue.wav'
        with wave.open(str(source), 'wb') as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(RATE)
            audio.writeframes((signal * 32767).astype('<i2').tobytes())
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-c:a', 'libvorbis', '-q:a', '5', str(OUT / name)], check=True)


launch = np.zeros(int(RATE * 3.15))
t = time(2.85)
engine = filtered_noise(2.85, 21)
envelope = np.minimum(1, t / 0.5) * np.minimum(1, (2.85 - t) / 0.75)
add(launch, engine * envelope, 0, 1.25)
add(launch, filtered_noise(2.85, 8) * envelope, 0, 0.28)
add(launch, sweep(2.3, 72, 405) * envelope[:int(RATE * 2.3)], 0.15, 0.35)
for at, note in ((0.29, 440), (0.62, 660), (0.98, 880), (1.41, 1109), (1.88, 1320)):
    add(launch, ping(0.65, note), at, 0.2)
export('buzz-orbital-launch.ogg', launch)

lock = np.zeros(int(RATE * 0.65))
for at, note in ((0.02, 784), (0.17, 1047), (0.33, 1568)):
    add(lock, ping(0.28, note), at, 0.55)
export('buzz-target-lock.ogg', lock)

laser = np.zeros(int(RATE * 0.83))
t = time(0.63)
add(laser, sweep(0.63, 1430, 160) * np.exp(-t * 4.5), 0, 0.55)
add(laser, filtered_noise(0.6, 4) * np.exp(-time(0.6) * 6), 0.025, 0.39)
add(laser, ping(0.36, 988), 0.06, 0.21)
export('buzz-laser-pulse.ogg', laser)
