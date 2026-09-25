/// <reference types="vite/client" />
import type { CharacterId } from './characters';

type SoundName = 'count' | 'go' | 'drift' | 'boost' | 'pad' | 'wish' | 'shield' | 'shot' | 'fire' | 'hit' | 'stun' | 'lap' | 'final-lap' | 'ultimate' | 'trick' | 'draft' | 'pickup' | 'cart-warning' | 'birds';

// Sources, licenses, and processing notes are documented in AUDIO_CREDITS.md.
const ASSETS = {
  menu: 'desert-menu.mp3', race: 'desert-race.mp3', engine: 'engine.wav', skid: 'skid.wav',
  spark: 'spell-spark.mp3', surge: 'spell-surge.mp3', grand: 'spell-grand.mp3',
  whoosh: 'boost-whoosh.mp3', time: 'time-whoosh.mp3',
  light: 'impact-light.mp3', mid: 'impact-mid.mp3', heavy: 'impact-heavy.mp3', birds: 'birds.mp3',
} as const;
type AssetName = keyof typeof ASSETS;
type Loop = { source: AudioBufferSourceNode; gain: GainNode };
const level = (key: string, fallback: number) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const stored = Number(raw);
    return Number.isFinite(stored) && stored >= 0 && stored <= 1 ? stored : fallback;
  } catch { return fallback; }
};

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private motorBus: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private fountainGain: GainNode | null = null;
  private fountainFilter: BiquadFilterNode | null = null;
  private readonly downloads = new Map<AssetName, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<AssetName, AudioBuffer>();
  private readonly loops = new Map<AssetName, Loop>();
  private paused = false;
  private duckUntil = 0;
  private musicLevel = level('genie-midnight-music', 0.8);
  private effectsLevel = level('genie-midnight-effects', 0.9);
  private listenerX = 0;
  private listenerZ = 0;
  private listenerYaw = 0;
  private eventScale = 1;
  private eventPan = 0;
  muted = false;

  constructor() {
    // Fetch during the menu so the first countdown and engine have time to arrive.
    for (const [name, file] of Object.entries(ASSETS) as [AssetName, string][]) {
      this.downloads.set(name, fetch(`${import.meta.env.BASE_URL}audio/${file}`)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio ${file}: HTTP ${response.status}`);
          return response.arrayBuffer();
        })
        .catch((error) => { console.warn(error); return null; }));
    }
  }

  start() {
    if (this.context) {
      void this.context.resume();
      this.paused = false;
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = this.muted ? 0 : 0.85;
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -13;
    limiter.knee.value = 12;
    limiter.ratio.value = 3;
    limiter.attack.value = 0.006;
    limiter.release.value = 0.18;
    master.connect(limiter).connect(context.destination);
    const musicBus = context.createGain();
    const effectsBus = context.createGain();
    const motorBus = context.createGain();
    musicBus.gain.value = this.musicLevel;
    effectsBus.gain.value = this.effectsLevel;
    motorBus.gain.value = this.effectsLevel;
    musicBus.connect(master);
    effectsBus.connect(master);
    motorBus.connect(master);
    this.context = context;
    this.master = master;
    this.musicBus = musicBus;
    this.effectsBus = effectsBus;
    this.motorBus = motorBus;
    this.paused = false;

    const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = Math.random() * 2 - 1;
    const noiseSource = context.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    const windFilter = context.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 450;
    const windGain = context.createGain();
    windGain.gain.value = 0;
    noiseSource.connect(windFilter).connect(windGain).connect(motorBus);
    const fountainFilter = context.createBiquadFilter();
    fountainFilter.type = 'bandpass';
    fountainFilter.frequency.value = 650;
    fountainFilter.Q.value = 0.55;
    const fountainGain = context.createGain();
    fountainGain.gain.value = 0;
    noiseSource.connect(fountainFilter).connect(fountainGain).connect(effectsBus);
    noiseSource.start();
    this.windGain = windGain;
    this.windFilter = windFilter;
    this.fountainGain = fountainGain;
    this.fountainFilter = fountainFilter;
    void context.resume();
    void this.loadAssets();
  }

  private async loadAssets() {
    const context = this.context;
    if (!context) return;
    await Promise.all((Object.keys(ASSETS) as AssetName[]).map(async (name) => {
      const raw = await this.downloads.get(name);
      if (!raw) return;
      try {
        const buffer = await context.decodeAudioData(raw);
        this.buffers.set(name, buffer);
        if (name === 'menu' || name === 'race' || name === 'engine' || name === 'skid') this.startLoop(name);
      } catch (error) { console.warn(`Could not decode ${ASSETS[name]}`, error); }
    }));
  }

  private startLoop(name: 'menu' | 'race' | 'engine' | 'skid') {
    const context = this.context;
    const buffer = this.buffers.get(name);
    const bus = name === 'menu' || name === 'race' ? this.musicBus : this.motorBus;
    if (!context || !buffer || !bus || this.loops.has(name)) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain).connect(bus);
    gain.gain.value = 0;
    if (name === 'engine') source.playbackRate.value = 0.76;
    source.start();
    this.loops.set(name, { source, gain });
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.master && this.context) this.master.gain.setTargetAtTime(value ? 0 : 0.85, this.context.currentTime, 0.04);
  }

  getMix() { return { music: this.musicLevel, effects: this.effectsLevel }; }

  setMix(music: number, effects: number) {
    this.musicLevel = Math.max(0, Math.min(1, music));
    this.effectsLevel = Math.max(0, Math.min(1, effects));
    if (this.context) {
      this.musicBus?.gain.setTargetAtTime(this.musicLevel, this.context.currentTime, 0.05);
      this.effectsBus?.gain.setTargetAtTime(this.effectsLevel, this.context.currentTime, 0.05);
      this.motorBus?.gain.setTargetAtTime(this.effectsLevel, this.context.currentTime, 0.05);
    }
    try {
      localStorage.setItem('genie-midnight-music', String(this.musicLevel));
      localStorage.setItem('genie-midnight-effects', String(this.effectsLevel));
    } catch { /* Optional preference. */ }
  }

  setPaused(value: boolean) {
    this.paused = value;
    if (!this.context) return;
    const now = this.context.currentTime;
    this.loops.get('race')?.gain.gain.setTargetAtTime(value ? 0.08 : 0.65, now, 0.22);
    this.loops.get('engine')?.gain.gain.setTargetAtTime(value ? 0 : 0.2, now, 0.08);
    this.loops.get('skid')?.gain.gain.setTargetAtTime(0, now, 0.06);
  }

  getStatus() {
    return {
      context: this.context?.state ?? 'not-started',
      samplesLoaded: this.buffers.size,
      samplesExpected: Object.keys(ASSETS).length,
      loops: [...this.loops.keys()],
      muted: this.muted,
      musicLevel: this.musicLevel,
      effectsLevel: this.effectsLevel,
    };
  }

  setListener(x: number, z: number, yaw: number) {
    this.listenerX = x;
    this.listenerZ = z;
    this.listenerYaw = yaw;
  }

  playAt(name: SoundName, position: { x: number; z: number }) {
    const dx = position.x - this.listenerX;
    const dz = position.z - this.listenerZ;
    const distance = Math.hypot(dx, dz);
    if (distance > 100) return;
    this.eventScale = 1 / (1 + (distance / 21) ** 2);
    this.eventPan = Math.max(-0.85, Math.min(0.85, (dx * Math.cos(this.listenerYaw) - dz * Math.sin(this.listenerYaw)) / 22));
    this.play(name);
    this.eventScale = 1;
    this.eventPan = 0;
  }

  update(speed: number, drifting: boolean, ultimate: boolean, active: boolean, zone: string, finalLap = false, progress = 0) {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    const running = active && !this.paused;
    const engine = this.loops.get('engine');
    if (engine) {
      engine.source.playbackRate.setTargetAtTime(0.7 + Math.min(speed, 53) * (ultimate ? 0.023 : 0.018), now, 0.1);
      engine.gain.gain.setTargetAtTime(running ? 0.24 + Math.min(speed, 45) * 0.006 : 0, now, 0.1);
    }
    const skid = this.loops.get('skid');
    if (skid) {
      skid.source.playbackRate.setTargetAtTime(0.84 + Math.min(speed, 45) * 0.008, now, 0.14);
      skid.gain.gain.setTargetAtTime(running && drifting ? 0.15 + Math.min(speed, 40) * 0.005 : 0, now, 0.085);
    }
    const duck = now < this.duckUntil ? 0.5 : 1;
    this.loops.get('menu')?.gain.gain.setTargetAtTime(!active && !this.paused ? 0.52 : 0, now, 0.32);
    this.loops.get('race')?.gain.gain.setTargetAtTime(running ? (finalLap ? 0.8 : 0.66) * duck : this.paused ? 0.08 : 0, now, 0.32);
    const cave = zone === 'DESERT CAVE';
    const garden = zone === 'PALACE GARDEN';
    this.windGain?.gain.setTargetAtTime(running ? cave ? 0.036 : garden ? 0.018 : 0.025 + Math.min(speed, 50) * 0.0005 : 0, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(cave ? 340 : garden ? 730 : 490 + Math.min(speed, 50) * 8, now, 0.4);
    const fountainPresence = garden ? Math.max(0, 1 - Math.abs(progress - 0.44) / 0.065) : 0;
    this.fountainGain?.gain.setTargetAtTime(running ? fountainPresence * 0.022 : 0, now, 0.2);
    this.fountainFilter?.frequency.setTargetAtTime(620 + Math.sin(now * 1.8) * 110, now, 0.25);
  }

  private sample(name: AssetName, volume: number, rate = 1, delay = 0, duration?: number, pan = 0) {
    const context = this.context;
    const buffer = this.buffers.get(name);
    if (!context || !buffer || !this.effectsBus || this.muted) return;
    const time = context.currentTime + delay;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    panner.pan.value = Math.max(-1, Math.min(1, pan + this.eventPan));
    source.connect(gain).connect(panner).connect(this.effectsBus);
    const length = Math.min(duration ?? buffer.duration / rate, buffer.duration / rate);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume * this.eventScale, time + 0.008);
    gain.gain.setValueAtTime(volume * this.eventScale, time + Math.max(0.009, length - 0.055));
    gain.gain.linearRampToValueAtTime(0, time + length);
    source.start(time);
    source.stop(time + length + 0.01);
  }

  play(name: SoundName) {
    if (!this.context || this.muted) return;
    switch (name) {
      case 'count': this.sample('spark', 0.2, 0.7, 0, 0.35); break;
      case 'go': this.sample('grand', 0.42, 1.1); this.sample('whoosh', 0.23, 1.2); break;
      case 'drift': this.sample('light', 0.14, 1.2); break;
      case 'boost': this.sample('whoosh', 0.48, 1.13); break;
      case 'pad': this.sample('whoosh', 0.58, 1.24); this.sample('spark', 0.17, 1.15, 0.05); break;
      case 'wish': this.sample('spark', 0.25, 1.04); break;
      case 'shield': this.sample('surge', 0.35, 1.13); this.sample('light', 0.15, 1.08); break;
      case 'shot': this.sample('time', 0.32, 1.24); this.sample('spark', 0.13, 1.7, 0.06); break;
      case 'fire': this.sample('surge', 0.33, 0.78); this.sample('whoosh', 0.29, 0.72); break;
      case 'hit': this.sample(Math.random() < 0.4 ? 'heavy' : 'mid', 0.6, 0.93 + Math.random() * 0.15); if (this.eventScale > 0.45) this.duckUntil = this.context.currentTime + 0.36; break;
      case 'stun': this.sample('heavy', 0.41, 0.75); this.sample('spark', 0.16, 1.48, 0.1); break;
      case 'lap': this.sample('grand', 0.38, 1.15); break;
      case 'final-lap': this.sample('grand', 0.52, 1.35); this.sample('whoosh', 0.32, 1.1); break;
      case 'ultimate': this.sample('grand', 0.52, 0.91); this.sample('whoosh', 0.38, 0.83); break;
      case 'trick': this.sample('spark', 0.3, 1.37); this.sample('whoosh', 0.18, 1.4); break;
      case 'draft': this.sample('whoosh', 0.33, 1.34); break;
      case 'pickup': this.sample('spark', 0.27, 1.3); break;
      case 'cart-warning': this.sample('surge', 0.2, 0.65, 0, 0.7); break;
      case 'birds': this.sample('birds', 0.24, 1, 0, undefined, 0.3); break;
    }
  }

  playDriftBoost(stage: 1 | 2 | 3) {
    this.sample('whoosh', 0.34 + stage * 0.11, 0.95 + stage * 0.13);
    this.sample(stage === 3 ? 'grand' : 'spark', 0.12 + stage * 0.08, 0.85 + stage * 0.17, 0.06);
  }

  playSignature(character: CharacterId) {
    const palette: Record<CharacterId, [AssetName, number, number]> = {
      genie: ['grand', 0.38, 1.08], mickey: ['spark', 0.36, 1.28], stitch: ['time', 0.43, 1.48],
      elsa: ['surge', 0.39, 1.5], moana: ['whoosh', 0.4, 0.88], buzz: ['time', 0.42, 1.7],
      maleficent: ['grand', 0.42, 0.68], hades: ['surge', 0.44, 0.74], jack: ['spark', 0.36, 0.9], mulan: ['whoosh', 0.41, 1.23],
    };
    const [name, volume, rate] = palette[character];
    this.sample(name, volume, rate);
    if (character === 'stitch' || character === 'buzz' || character === 'maleficent') this.sample('whoosh', 0.19, rate * 0.82, 0.055);
  }

  playUltimate(character: CharacterId) {
    const dark = character === 'maleficent' || character === 'hades';
    const quick = character === 'buzz' || character === 'stitch' || character === 'mulan';
    this.sample('whoosh', 0.48, quick ? 1.24 : dark ? 0.68 : 0.92);
    this.sample('grand', 0.53, dark ? 0.71 : quick ? 1.28 : 1, 0.06);
    this.sample('heavy', 0.32, 0.82, 0.12);
    if (this.context) this.duckUntil = this.context.currentTime + 0.65;
  }
}
