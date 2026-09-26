"""Synthesize original Soul Chain and Styx Toll cues for Hades."""
from pathlib import Path
from tempfile import TemporaryDirectory
import subprocess
import wave

import numpy as np


RATE = 44100
OUT = Path('public/audio')
RNG = np.random.default_rng(61327)


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


def smooth_noise(length, width):
    raw = RNG.normal(0, 1, int(length * RATE))
    return np.convolve(raw, np.ones(width) / width, mode='same')


def chime(length, frequency, decay):
    t = time(length)
    return (np.sin(2 * np.pi * frequency * t) + 0.34 * np.sin(2 * np.pi * frequency * 2.01 * t)) * np.exp(-t * decay)


def export(name, signal):
    fade = min(int(RATE * 0.018), len(signal) // 2)
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


chain = np.zeros(int(RATE * 1.1))
t = time(0.85)
add(chain, smooth_noise(0.85, 29) * np.sin(np.pi * t / 0.85) ** 1.4, 0, 1.2)
add(chain, sweep(0.71, 265, 790) * np.exp(-time(0.71) * 2.1), 0.02, 0.31)
for at, note in ((0.11, 660), (0.24, 440), (0.37, 330)):
    add(chain, chime(0.52, note, 6.4), at, 0.24)
export('hades-soul-chain.ogg', chain)

broken = np.zeros(int(RATE * 0.85))
add(broken, smooth_noise(0.36, 5) * np.exp(-time(0.36) * 13), 0.01, 0.75)
add(broken, sweep(0.55, 960, 180) * np.exp(-time(0.55) * 5.5), 0.01, 0.36)
add(broken, chime(0.6, 1330, 8), 0.07, 0.35)
export('hades-chain-break.ogg', broken)

rise = np.zeros(int(RATE * 3.05))
t = time(2.82)
envelope = np.minimum(1, t / 0.42) * np.minimum(1, (2.82 - t) / 0.82)
add(rise, smooth_noise(2.82, 36) * envelope, 0, 1.55)
add(rise, smooth_noise(2.82, 11) * envelope, 0, 0.26)
add(rise, sweep(2.4, 66, 310) * envelope[:int(RATE * 2.4)], 0.13, 0.46)
for at, note in ((0.34, 110), (0.81, 164.8), (1.35, 220), (1.9, 293.7)):
    add(rise, chime(0.86, note, 2.7), at, 0.25)
export('hades-styx-rise.ogg', rise)

toll = np.zeros(int(RATE * 0.86))
add(toll, sweep(0.44, 290, 78) * np.exp(-time(0.44) * 4.6), 0, 0.61)
add(toll, smooth_noise(0.42, 12) * np.exp(-time(0.42) * 8), 0.03, 0.76)
add(toll, chime(0.65, 523.25, 7.2), 0.08, 0.34)
export('hades-styx-toll.ogg', toll)
