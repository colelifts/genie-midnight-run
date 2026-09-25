import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// Original synthesized warning cue. Run from the repository root with Node and FFmpeg.
const sampleRate = 48000;
const duration = 5;
const samples = Math.round(sampleRate * duration);
const wav = Buffer.alloc(44 + samples * 4);
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
wav.writeUInt32LE(samples * 4, 40);

const delayLeft = new Float64Array(Math.round(sampleRate * 0.083));
const delayRight = new Float64Array(Math.round(sampleRate * 0.131));
let phase = 0;
for (let i = 0; i < samples; i++) {
  const t = i / sampleRate;
  const sweep = Math.sin(2 * Math.PI * (0.68 * t + 0.045 * t * t) - Math.PI / 2);
  const frequency = 350 + 170 * sweep + 75 * Math.min(1, t / 4.5);
  phase += 2 * Math.PI * frequency / sampleRate;
  const pulse = 0.63 + 0.37 * Math.max(0, Math.sin(2 * Math.PI * (1.3 + t * 0.12) * t));
  const envelope = Math.min(1, t / 0.5) * Math.min(1, (duration - t) / 0.4);
  const lead = (0.64 * Math.sin(phase) + 0.2 * Math.sin(2 * phase + 0.3) + 0.07 * Math.sin(3 * phase)) * pulse * envelope;
  const hum = 0.09 * Math.sin(2 * Math.PI * 82 * t) * envelope;
  const leftIndex = i % delayLeft.length;
  const rightIndex = i % delayRight.length;
  const left = (lead + 0.28 * delayLeft[leftIndex] + hum) * 0.67;
  const right = (lead + 0.33 * delayRight[rightIndex] + hum) * 0.67;
  delayLeft[leftIndex] = lead;
  delayRight[rightIndex] = lead;
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left)) * 32767), 44 + i * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right)) * 32767), 46 + i * 4);
}

const source = join('work', 'ufo-siren.wav');
const output = join('public', 'audio', 'ufo-siren.ogg');
mkdirSync('work', { recursive: true });
writeFileSync(source, wav);
const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', source, '-c:a', 'libvorbis', '-q:a', '5', output], { stdio: 'inherit' });
if (result.status !== 0) throw new Error('FFmpeg could not encode the UFO siren');
console.log(`Wrote ${output}`);
