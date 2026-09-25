import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Original 100 BPM, four-bar alien-racing cue. Its 9.6-second length matches
// Stitch's ultimate, so the warning, barrage, and final beam have musical beats.
const sampleRate = 48000;
const duration = 9.6;
const frames = Math.round(sampleRate * duration);
const beat = 0.6;
const dry = new Float64Array(frames);
const noise = (n) => {
  const value = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

function add(start, length, makeSample) {
  const first = Math.max(0, Math.round(start * sampleRate));
  const count = Math.min(frames - first, Math.round(length * sampleRate));
  for (let i = 0; i < count; i++) dry[first + i] += makeSample(i / sampleRate, i);
}

const roots = [73.42, 58.27, 65.41, 55]; // D minor, B-flat, C, A.
const chords = [
  [146.83, 174.61, 220],
  [116.54, 146.83, 174.61],
  [130.81, 164.81, 196],
  [110, 138.59, 164.81],
];

for (let bar = 0; bar < 4; bar++) {
  const start = bar * beat * 4;
  for (const [voice, frequency] of chords[bar].entries()) {
    add(start, beat * 4, (t) => {
      const swell = Math.min(1, t / 0.38) * Math.min(1, (beat * 4 - t) / 0.4);
      const warble = 1 + 0.002 * Math.sin(2 * Math.PI * (0.45 + voice * 0.17) * t);
      return (Math.sin(2 * Math.PI * frequency * warble * t) + 0.18 * Math.sin(2 * Math.PI * frequency * 2 * t)) * swell * 0.018;
    });
  }
  const arp = [0, 2, 1, 2, 0, 1, 2, 1];
  for (let step = 0; step < 8; step++) {
    const frequency = chords[bar][arp[step]] * 2;
    add(start + step * beat / 2, 0.28, (t) => {
      const envelope = Math.min(1, t / 0.006) * Math.exp(-t * 12);
      return (Math.sin(2 * Math.PI * frequency * t) + 0.31 * Math.sin(2 * Math.PI * frequency * 2.01 * t)) * envelope * 0.1;
    });
  }
}

for (let step = 0; step < 16; step++) {
  const time = step * beat;
  const root = roots[Math.floor(step / 4)];
  add(time, 0.42, (t) => {
    const envelope = Math.min(1, t / 0.012) * Math.exp(-t * 5.2);
    return (Math.sin(2 * Math.PI * root * t) + 0.24 * Math.sin(2 * Math.PI * root * 2 * t)) * envelope * 0.2;
  });
  add(time, 0.24, (t) => {
    const phase = 2 * Math.PI * (48 * t + 140 * (1 - Math.exp(-26 * t)) / 26);
    return Math.sin(phase) * Math.exp(-t * 19) * 0.36;
  });
  if (step % 4 === 1 || step % 4 === 3) {
    add(time, 0.16, (t, i) => {
      const crack = (noise(i + step * 137) - noise(i - 1 + step * 137)) * Math.exp(-t * 24);
      return (crack * 0.1 + Math.sin(2 * Math.PI * 180 * t) * 0.055) * Math.min(1, t / 0.003);
    });
  }
  for (let half = 0; half < 2; half++) {
    add(time + half * beat / 2, 0.055, (t, i) => (noise(i * 3 + step * 173 + half * 37) - noise(i * 3 + step * 173 + half * 37 - 1)) * Math.exp(-t * 57) * 0.035);
  }
}

// A rising metallic line announces the targeted beam on the last phrase.
add(5.35, 0.7, (t) => {
  const frequency = 430 + 930 * t;
  return (Math.sin(2 * Math.PI * frequency * t) + 0.25 * Math.sin(2 * Math.PI * frequency * 2 * t)) * (t / 0.7) ** 1.6 * 0.065;
});
add(6.05, 0.55, (t) => (Math.sin(2 * Math.PI * 110 * t) + 0.22 * Math.sin(2 * Math.PI * 440 * t)) * Math.exp(-t * 6) * 0.19);

const wav = Buffer.alloc(44 + frames * 4);
wav.write('RIFF', 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write('data', 36);
wav.writeUInt32LE(frames * 4, 40);

const delayA = Math.round(sampleRate * 0.105);
const delayB = Math.round(sampleRate * 0.17);
let peak = 0;
for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(dry[i]));
const gain = 0.86 / Math.max(0.86, peak);
for (let i = 0; i < frames; i++) {
  const t = i / sampleRate;
  const edge = Math.min(1, t / 0.045, (duration - t) / 0.15);
  const left = Math.tanh((dry[i] + (i >= delayA ? dry[i - delayA] * 0.14 : 0)) * gain) * edge;
  const right = Math.tanh((dry[i] + (i >= delayB ? dry[i - delayB] * 0.19 : 0)) * gain) * edge;
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left)) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right)) * 32767), 46 + i * 4);
}

mkdirSync('work', { recursive: true });
const source = join('work', 'stitch-ultimate-theme.wav');
const output = join('public', 'audio', 'stitch-ultimate-theme.ogg');
writeFileSync(source, wav);
const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-c:a', 'libvorbis', '-q:a', '5', output], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('FFmpeg could not encode the Stitch ultimate theme');
console.log(`Wrote ${output}`);
