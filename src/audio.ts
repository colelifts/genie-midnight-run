/// <reference types="vite/client" />
import type { CharacterId } from './characters';
import { STITCH_UFO_INBOUND_DURATION } from './stitchUfo';

type SoundName = 'go' | 'drift' | 'boost' | 'pad' | 'wish' | 'shield' | 'shot' | 'laser' | 'water' | 'cannon' | 'fire' | 'ice' | 'hit' | 'stun' | 'lap' | 'final-lap' | 'ultimate' | 'trick' | 'draft' | 'pickup' | 'cart-warning' | 'birds' | 'crate-hit' | 'market-hit' | 'boulder-hit' | 'urn-hit' | 'cart-hit' | 'field-soul' | 'field-clock' | 'field-anchor' | 'field-star' | 'field-fire' | 'plasma-shot' | 'plasma-hit' | 'ufo-arrival' | 'ufo-siren' | 'ufo-barrage' | 'ufo-lock' | 'ufo-warning' | 'ufo-beam' | 'ufo-impact';

// Sources, licenses, and processing notes are documented in AUDIO_CREDITS.md.
const ASSETS = {
  menu: 'desert-menu.mp3', raceIntro: 'desert-race-intro.mp3', race: 'desert-race.mp3', engine: 'engine.wav', skid: 'skid.wav',
  countDrum: 'countdown-drum.wav',
  boostStart: 'boost-start.wav', boostLoop: 'boost-loop.wav', boostEnd: 'boost-end.wav',
  spark: 'spell-spark.mp3', surge: 'spell-surge.mp3', grand: 'spell-grand.mp3',
  whoosh: 'boost-whoosh.mp3', time: 'time-whoosh.mp3',
  light: 'impact-light.mp3', mid: 'impact-mid.mp3', heavy: 'impact-heavy.mp3', birds: 'birds.mp3',
  water: 'water-splash.mp3', laser: 'laser-shot.mp3', fire: 'fire-blast.mp3', cannon: 'cannon-blast.mp3',
  ice: 'ice-crackle.mp3',
  crateCrack: 'crate-crack.mp3', woodHit: 'wood-hit.mp3', stoneImpact: 'stone-impact.mp3',
  urnShatter: 'urn-shatter.mp3', cartClank: 'cart-clank.mp3',
  wind: 'wind-ambience.mp3', fountain: 'fountain-ambience.mp3',
  ufoArrival: 'rampage-arrival.ogg', ufoInbound: 'rampage-inbound.ogg', ufoLock: 'rampage-lock.ogg', ufoSiren: 'ufo-siren.ogg', stitchTheme: 'stitch-ultimate-theme.ogg',
  plasmaCast: 'plasma-cast.ogg', plasmaImpact: 'plasma-impact.ogg',
} as const;
const AUDIO_REVISION = '16';
type AssetName = keyof typeof ASSETS;
type Loop = { source: AudioBufferSourceNode; gain: GainNode };
type RivalEngine = { id: number; position: { x: number; y: number; z: number }; speed: number };
type RivalVoice = { id: number; source: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode; pan: StereoPannerNode };
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
  private raceMusicGain: GainNode | null = null;
  private raceIntroSource: AudioBufferSourceNode | null = null;
  private raceIntroGain: GainNode | null = null;
  private raceIntroEnd = 0;
  private raceRequested = false;
  private effectsBus: GainNode | null = null;
  private motorBus: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private fountainGain: GainNode | null = null;
  private fountainFilter: BiquadFilterNode | null = null;
  private fountainPan: StereoPannerNode | null = null;
  private readonly downloads = new Map<AssetName, Promise<ArrayBuffer | null>>();
  private readonly buffers = new Map<AssetName, AudioBuffer>();
  private readonly loops = new Map<AssetName, Loop>();
  private ufoDrone: Loop | null = null;
  private ufoTheme: Loop | null = null;
  private ufoThemeFilter: BiquadFilterNode | null = null;
  private assetsReady = false;
  private readonly rivalVoices: RivalVoice[] = [];
  private rivalsAudible = 0;
  private paused = false;
  private duckUntil = 0;
  private musicLevel = level('genie-midnight-music', 0.8);
  private effectsLevel = level('genie-midnight-effects', 0.9);
  private listenerX = 0;
  private listenerY = 0;
  private listenerZ = 0;
  private listenerYaw = 0;
  private eventScale = 1;
  private eventPan = 0;
  private boostAudible = false;
  private driftCueCount = 0;
  private lastDriftCue = 0;
  muted = false;

  constructor() {
    // Fetch during the menu so the first countdown and engine have time to arrive.
    for (const [name, file] of Object.entries(ASSETS) as [AssetName, string][]) {
      this.downloads.set(name, fetch(`${import.meta.env.BASE_URL}audio/${file}?v=${AUDIO_REVISION}`)
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
    const raceMusicGain = context.createGain();
    raceMusicGain.gain.value = 0;
    raceMusicGain.connect(musicBus);
    this.context = context;
    this.master = master;
    this.musicBus = musicBus;
    this.raceMusicGain = raceMusicGain;
    this.effectsBus = effectsBus;
    this.motorBus = motorBus;
    this.paused = false;

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
        if (name === 'menu' || name === 'engine' || name === 'skid' || name === 'boostLoop' || name === 'wind' || name === 'fountain') this.startLoop(name);
        if (name === 'engine') this.startRivalVoices(buffer);
        if (name === 'raceIntro' || name === 'race') this.tryStartRaceMusic();
      } catch (error) { console.warn(`Could not decode ${ASSETS[name]}`, error); }
    }));
    this.assetsReady = true;
    this.tryStartRaceMusic();
  }

  private startLoop(name: 'menu' | 'engine' | 'skid' | 'boostLoop' | 'wind' | 'fountain') {
    const context = this.context;
    const buffer = this.buffers.get(name);
    const bus = name === 'menu' ? this.musicBus : name === 'boostLoop' || name === 'fountain' ? this.effectsBus : this.motorBus;
    if (!context || !buffer || !bus || this.loops.has(name)) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    if (name === 'wind') {
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 550;
      source.connect(filter).connect(gain).connect(bus);
      this.windFilter = filter;
      this.windGain = gain;
    } else if (name === 'fountain') {
      const filter = context.createBiquadFilter();
      const pan = context.createStereoPanner();
      filter.type = 'lowpass';
      filter.frequency.value = 4200;
      source.connect(filter).connect(gain).connect(pan).connect(bus);
      this.fountainFilter = filter;
      this.fountainPan = pan;
      this.fountainGain = gain;
    } else source.connect(gain).connect(bus);
    gain.gain.value = 0;
    if (name === 'engine') source.playbackRate.value = 0.48;
    source.start();
    this.loops.set(name, { source, gain });
  }

  resetRaceMusic() {
    this.setUfoTheme(false, 0);
    this.setUfoDrone(false);
    const now = this.context?.currentTime ?? 0;
    this.raceMusicGain?.gain.setValueAtTime(0, now);
    this.raceRequested = false;
    this.raceIntroEnd = 0;
    if (this.raceIntroSource) {
      try { this.raceIntroSource.stop(); } catch { /* The intro may have already ended. */ }
      this.raceIntroSource.disconnect();
      this.raceIntroSource = null;
    }
    this.raceIntroGain?.disconnect();
    this.raceIntroGain = null;
    const race = this.loops.get('race');
    if (race) {
      try { race.source.stop(); } catch { /* A scheduled source may have already ended. */ }
      race.source.disconnect();
      race.gain.disconnect();
      this.loops.delete('race');
    }
  }

  beginRaceMusic() {
    this.resetRaceMusic();
    this.raceRequested = true;
    this.tryStartRaceMusic();
  }

  private tryStartRaceMusic() {
    const context = this.context;
    const intro = this.buffers.get('raceIntro');
    const loop = this.buffers.get('race');
    if (!this.raceRequested || !context || !loop || !this.raceMusicGain || this.loops.has('race') || (!intro && !this.assetsReady)) return;
    const now = context.currentTime;
    const handoff = intro ? now + intro.duration - 0.16 : now;
    if (intro) {
      const introSource = context.createBufferSource();
      const introGain = context.createGain();
      introSource.buffer = intro;
      introSource.connect(introGain).connect(this.raceMusicGain);
      introGain.gain.setValueAtTime(1, now);
      introGain.gain.setValueAtTime(1, handoff);
      introGain.gain.linearRampToValueAtTime(0, now + intro.duration);
      introSource.start(now);
      this.raceIntroSource = introSource;
      this.raceIntroGain = introGain;
    }
    this.raceIntroEnd = intro ? now + intro.duration : now;
    const loopSource = context.createBufferSource();
    const loopGain = context.createGain();
    loopSource.buffer = loop;
    loopSource.loop = true;
    loopSource.connect(loopGain).connect(this.raceMusicGain);
    loopGain.gain.setValueAtTime(intro ? 0 : 1, handoff);
    if (intro) loopGain.gain.linearRampToValueAtTime(1, now + intro.duration);
    loopSource.start(handoff);
    this.loops.set('race', { source: loopSource, gain: loopGain });
  }

  private startRivalVoices(buffer: AudioBuffer) {
    const context = this.context;
    if (!context || !this.motorBus || this.rivalVoices.length) return;
    for (let i = 0; i < 3; i++) {
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      const pan = context.createStereoPanner();
      source.buffer = buffer;
      source.loop = true;
      source.playbackRate.value = 0.7;
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(pan).connect(this.motorBus);
      source.start(context.currentTime, (i * 0.91) % buffer.duration);
      this.rivalVoices.push({ id: -1, source, gain, filter, pan });
    }
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
    if (value) { this.setUfoDrone(false); this.setUfoTheme(false, 0); }
    const now = this.context.currentTime;
    this.raceMusicGain?.gain.setTargetAtTime(value ? 0.08 : 0.65, now, 0.22);
    this.loops.get('engine')?.gain.gain.setTargetAtTime(value ? 0 : 0.2, now, 0.08);
    this.loops.get('skid')?.gain.gain.setTargetAtTime(0, now, 0.06);
    this.loops.get('boostLoop')?.gain.gain.setTargetAtTime(0, now, 0.06);
    this.windGain?.gain.setTargetAtTime(0, now, 0.12);
    this.fountainGain?.gain.setTargetAtTime(0, now, 0.12);
    for (const voice of this.rivalVoices) voice.gain.gain.setTargetAtTime(0, now, 0.06);
    if (value) this.rivalsAudible = 0;
    if (value) this.boostAudible = false;
  }

  getStatus() {
    return {
      context: this.context?.state ?? 'not-started',
      samplesLoaded: this.buffers.size,
      samplesExpected: Object.keys(ASSETS).length,
      loops: [...this.loops.keys()],
      boostActive: this.boostAudible,
      driftCueCount: this.driftCueCount,
      lastDriftCue: this.lastDriftCue,
      rivalVoices: this.rivalVoices.length,
      rivalsAudible: this.rivalsAudible,
      musicPhase: !this.raceRequested ? 'idle' : !this.raceIntroEnd ? 'loading' : (this.context?.currentTime ?? 0) < this.raceIntroEnd ? 'intro' : 'loop',
      muted: this.muted,
      musicLevel: this.musicLevel,
      effectsLevel: this.effectsLevel,
      ufoDrone: Boolean(this.ufoDrone),
      ufoTheme: Boolean(this.ufoTheme),
    };
  }

  setListener(x: number, y: number, z: number, yaw: number) {
    this.listenerX = x;
    this.listenerY = y;
    this.listenerZ = z;
    this.listenerYaw = yaw;
  }

  updateRivals(racers: readonly RivalEngine[], active: boolean) {
    const context = this.context;
    if (!context || !this.rivalVoices.length) return;
    const now = context.currentTime;
    const nearby = active && !this.paused ? racers.filter((racer) => {
      if (racer.id === 0 || Math.abs(racer.position.y - this.listenerY) > 5) return false;
      return Math.hypot(racer.position.x - this.listenerX, racer.position.z - this.listenerZ) < 48;
    }).sort((a, b) => {
      const adx = a.position.x - this.listenerX;
      const adz = a.position.z - this.listenerZ;
      const bdx = b.position.x - this.listenerX;
      const bdz = b.position.z - this.listenerZ;
      return adx * adx + adz * adz - bdx * bdx - bdz * bdz;
    }).slice(0, this.rivalVoices.length) : [];
    const chosen = new Set(nearby.map((racer) => racer.id));
    for (const voice of this.rivalVoices) {
      if (!chosen.has(voice.id)) voice.id = -1;
    }
    for (const racer of nearby) {
      if (this.rivalVoices.some((voice) => voice.id === racer.id)) continue;
      const free = this.rivalVoices.find((voice) => voice.id === -1);
      if (free) free.id = racer.id;
    }
    for (const voice of this.rivalVoices) {
      const racer = nearby.find((entry) => entry.id === voice.id);
      if (!racer) {
        voice.gain.gain.setTargetAtTime(0, now, 0.1);
        continue;
      }
      const dx = racer.position.x - this.listenerX;
      const dz = racer.position.z - this.listenerZ;
      const distance = Math.hypot(dx, dz);
      const proximity = Math.max(0, 1 - distance / 48);
      const side = dx * Math.cos(this.listenerYaw) - dz * Math.sin(this.listenerYaw);
      voice.source.playbackRate.setTargetAtTime(0.52 + Math.min(racer.speed, 70) * 0.0095, now, 0.2);
      voice.filter.frequency.setTargetAtTime(850 + proximity * 2450, now, 0.2);
      voice.pan.pan.setTargetAtTime(Math.max(-0.9, Math.min(0.9, side / Math.max(9, distance * 0.75))), now, 0.13);
      voice.gain.gain.setTargetAtTime(0.115 * proximity * proximity * Math.min(1, racer.speed / 20), now, 0.13);
    }
    this.rivalsAudible = nearby.length;
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

  update(speed: number, drifting: boolean, ultimate: boolean, boosting: boolean, active: boolean, zone: string, finalLap = false, fountain?: { x: number; z: number }, atmosphere: 'none' | 'ultimate' | 'ufo' = 'none', ufoAge = 0) {
    const context = this.context;
    if (!context) return;
    const now = context.currentTime;
    const running = active && !this.paused;
    this.setUfoDrone(running && atmosphere === 'ufo' && ufoAge < STITCH_UFO_INBOUND_DURATION);
    this.setUfoTheme(running && atmosphere === 'ufo', ufoAge);
    if (this.ufoThemeFilter && this.ufoTheme) {
      const reveal = Math.min(1, ufoAge / STITCH_UFO_INBOUND_DURATION);
      this.ufoThemeFilter.frequency.setTargetAtTime(280 + 17500 * reveal ** 3, now, 0.11);
      this.ufoTheme.gain.gain.setTargetAtTime(0.34 + 0.62 * reveal, now, 0.11);
    }
    const engine = this.loops.get('engine');
    if (engine) {
      engine.source.playbackRate.setTargetAtTime(0.48 + Math.min(speed, 70) * (ultimate ? 0.0128 : 0.011), now, 0.16);
      engine.gain.gain.setTargetAtTime(running ? 0.28 + Math.min(speed, 65) * 0.0048 : 0, now, 0.1);
    }
    const skid = this.loops.get('skid');
    if (skid) {
      skid.source.playbackRate.setTargetAtTime(0.84 + Math.min(speed, 70) * 0.0065, now, 0.14);
      skid.gain.gain.setTargetAtTime(running && drifting ? 0.15 + Math.min(speed, 65) * 0.004 : 0, now, 0.085);
    }
    const boostNow = running && boosting;
    if (boostNow !== this.boostAudible) {
      if (boostNow) this.sample('boostStart', 0.25);
      else if (running) this.sample('boostEnd', 0.19);
      this.boostAudible = boostNow;
    }
    const boostLoop = this.loops.get('boostLoop');
    if (boostLoop) {
      boostLoop.source.playbackRate.setTargetAtTime(0.9 + Math.min(speed, 70) * 0.003, now, 0.14);
      boostLoop.gain.gain.setTargetAtTime(boostNow ? (ultimate ? 0.16 : 0.19) : 0, now, boostNow ? 0.18 : 0.07);
    }
    const duck = now < this.duckUntil ? 0.5 : 1;
    this.loops.get('menu')?.gain.gain.setTargetAtTime(!active && !this.paused ? 0.52 : 0, now, 0.32);
    const ultimateMix = atmosphere === 'ufo' ? 0.1 : atmosphere === 'ultimate' ? 0.84 : 1;
    this.raceMusicGain?.gain.setTargetAtTime(running ? (finalLap ? 0.8 : 0.66) * duck * ultimateMix : this.paused ? 0.08 : 0, now, 0.32);
    const cave = zone === 'DESERT CAVE';
    const garden = zone === 'PALACE GARDEN';
    this.windGain?.gain.setTargetAtTime(running ? cave ? 0.036 : garden ? 0.018 : 0.025 + Math.min(speed, 70) * 0.0004 : 0, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(cave ? 340 : garden ? 730 : 490 + Math.min(speed, 70) * 6.5, now, 0.4);
    const dx = (fountain?.x ?? this.listenerX) - this.listenerX;
    const dz = (fountain?.z ?? this.listenerZ) - this.listenerZ;
    const distance = fountain ? Math.hypot(dx, dz) : Infinity;
    const fountainPresence = Math.max(0, 1 - distance / 105) ** 2;
    this.fountainGain?.gain.setTargetAtTime(running ? fountainPresence * 0.6 : 0, now, 0.28);
    this.fountainFilter?.frequency.setTargetAtTime(1800 + fountainPresence * 4800, now, 0.32);
    const side = dx * Math.cos(this.listenerYaw) - dz * Math.sin(this.listenerYaw);
    this.fountainPan?.pan.setTargetAtTime(Math.max(-0.75, Math.min(0.75, side / Math.max(18, distance * 0.8))), now, 0.2);
  }

  private setUfoDrone(active: boolean) {
    const context = this.context;
    if (!context || !this.effectsBus) return;
    if (!active && this.ufoDrone) {
      this.ufoDrone.gain.gain.setTargetAtTime(0, context.currentTime, 0.16);
      this.ufoDrone.source.stop(context.currentTime + 0.55);
      this.ufoDrone = null;
    }
    if (!active || this.ufoDrone) return;
    const buffer = this.buffers.get('ufoArrival');
    if (!buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = 0.86;
    gain.gain.value = 0;
    source.connect(gain).connect(this.effectsBus);
    source.start();
    gain.gain.setTargetAtTime(0.16, context.currentTime, 0.7);
    this.ufoDrone = { source, gain };
  }

  private setUfoTheme(active: boolean, age: number) {
    const context = this.context;
    if (!context || !this.musicBus) return;
    if (!active && this.ufoTheme) {
      this.ufoTheme.gain.gain.setTargetAtTime(0, context.currentTime, 0.2);
      this.ufoTheme.source.stop(context.currentTime + 0.75);
      this.ufoTheme = null;
      this.ufoThemeFilter = null;
    }
    if (!active || this.ufoTheme) return;
    const buffer = this.buffers.get('stitchTheme');
    if (!buffer) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    source.buffer = buffer;
    source.loop = false;
    filter.type = 'lowpass';
    filter.frequency.value = 280 + 17500 * Math.min(1, age / STITCH_UFO_INBOUND_DURATION) ** 3;
    filter.Q.value = 0.5;
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(this.musicBus);
    source.start(context.currentTime, Math.min(age, Math.max(0, buffer.duration - 0.05)));
    gain.gain.setTargetAtTime(0.34 + 0.62 * Math.min(1, age / STITCH_UFO_INBOUND_DURATION), context.currentTime, 0.32);
    this.ufoTheme = { source, gain };
    this.ufoThemeFilter = filter;
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

  playCountdown(remaining: number) {
    if (!this.context || this.muted) return;
    const step = 4 - Math.max(1, Math.min(3, remaining));
    this.sample('countDrum', 0.19 + step * 0.045, 0.93 + step * 0.055);
  }

  play(name: SoundName) {
    if (!this.context || this.muted) return;
    switch (name) {
      case 'go': this.sample('countDrum', 0.37, 1.18); this.sample('grand', 0.42, 1.1); this.sample('whoosh', 0.23, 1.2); break;
      case 'drift': this.sample('light', 0.13, 1.2, 0, 0.27); this.sample('skid', 0.1, 1.15, 0.02, 0.26); break;
      case 'boost': this.sample('whoosh', 0.48, 1.13); break;
      case 'pad': this.sample('whoosh', 0.58, 1.24); this.sample('spark', 0.17, 1.15, 0.05); break;
      case 'wish': this.sample('spark', 0.25, 1.04); break;
      case 'shield': this.sample('surge', 0.35, 1.13); this.sample('light', 0.15, 1.08); break;
      case 'shot': this.sample('time', 0.32, 1.24); this.sample('spark', 0.13, 1.7, 0.06); break;
      case 'laser': this.sample('laser', 0.38, 1); this.sample('whoosh', 0.13, 1.3); break;
      case 'plasma-shot': this.sample('plasmaCast', 0.27, 1.12 + Math.random() * 0.12, 0, 0.26); break;
      case 'plasma-hit': this.sample('plasmaImpact', 0.46, 1.02, 0, 0.55); this.sample('spark', 0.15, 1.38); break;
      case 'water': this.sample('water', 0.39, 1); this.sample('whoosh', 0.15, 0.9); break;
      case 'cannon': this.sample('cannon', 0.44, 1, 0, 1.5); this.sample('heavy', 0.13, 0.8); break;
      case 'fire': this.sample('fire', 0.4, 1, 0, 1.3); this.sample('whoosh', 0.16, 0.8); break;
      case 'ice': this.sample('ice', 0.28, 1.06, 0, 0.8); break;
      case 'hit': this.sample(Math.random() < 0.4 ? 'heavy' : 'mid', 0.6, 0.93 + Math.random() * 0.15); if (this.eventScale > 0.45) this.duckUntil = this.context.currentTime + 0.36; break;
      case 'crate-hit': this.sample('crateCrack', 0.43, 0.95 + Math.random() * 0.12); this.sample('mid', 0.17, 1.04); break;
      case 'market-hit': this.sample('woodHit', 0.42, 0.92 + Math.random() * 0.14); this.sample('mid', 0.23, 0.91); break;
      case 'boulder-hit': this.sample('stoneImpact', 0.34, 0.92 + Math.random() * 0.1); break;
      case 'urn-hit': this.sample('urnShatter', 0.42, 0.78 + Math.random() * 0.08); this.sample('mid', 0.14, 1); break;
      case 'cart-hit': this.sample('cartClank', 0.42, 0.95 + Math.random() * 0.1); this.sample('woodHit', 0.22, 0.88, 0.025); break;
      case 'field-soul': this.sample('surge', 0.29, 0.72, 0, 0.9); this.sample('time', 0.12, 0.83, 0.045, 0.65); break;
      case 'field-clock': this.sample('time', 0.36, 0.68, 0, 0.8); this.sample('spark', 0.12, 0.8, 0.06, 0.5); break;
      case 'field-anchor': this.sample('cartClank', 0.3, 0.74); break;
      case 'field-star': this.sample('spark', 0.24, 1.3, 0, 0.55); break;
      case 'field-fire': this.sample('fire', 0.32, 0.89, 0, 0.75); break;
      case 'stun': this.sample('heavy', 0.41, 0.75); this.sample('spark', 0.16, 1.48, 0.1); break;
      case 'lap': this.sample('grand', 0.38, 1.15); break;
      case 'final-lap': this.sample('grand', 0.52, 1.35); this.sample('whoosh', 0.32, 1.1); break;
      case 'ultimate': this.sample('grand', 0.52, 0.91); this.sample('whoosh', 0.38, 0.83); break;
      case 'ufo-arrival': this.sample('ufoInbound', 0.45, 0.79); this.sample('ufoArrival', 0.3, 0.73, 1.15); this.sample('ufoInbound', 0.32, 0.92, 2.8); break;
      case 'ufo-siren': this.sample('ufoSiren', 0.56, 1, 0.15); break;
      case 'ufo-barrage': this.sample('plasmaCast', 0.42, 0.57, 0, 0.7); this.sample('cannon', 0.42, 0.82, 0.05, 1.2); this.sample('whoosh', 0.3, 0.8); break;
      case 'ufo-lock': this.sample('ufoLock', 0.38, 0.93 + Math.random() * 0.12); break;
      case 'ufo-warning': this.sample('ufoLock', 0.57, 0.76); this.sample('time', 0.27, 0.77); break;
      case 'ufo-beam': this.sample('plasmaCast', 0.52, 0.58, 0, 1.1); this.sample('surge', 0.42, 0.69, 0.12, 1.45); this.sample('whoosh', 0.24, 0.7, 0.07); break;
      case 'ufo-impact': this.sample('plasmaImpact', 0.48, 0.78 + Math.random() * 0.18, 0, 0.52); this.sample('heavy', 0.28, 0.65 + Math.random() * 0.18); this.sample('cannon', 0.14, 0.75, 0.035, 0.38); break;
      case 'trick': this.sample('spark', 0.3, 1.37); this.sample('whoosh', 0.18, 1.4); break;
      case 'draft': this.sample('whoosh', 0.33, 1.34); break;
      case 'pickup': this.sample('spark', 0.27, 1.3); break;
      case 'cart-warning': this.sample('surge', 0.2, 0.65, 0, 0.7); break;
      case 'birds': this.sample('birds', 0.24, 1, 0, undefined, 0.3); break;
    }
    if ((name.endsWith('-hit') || name.startsWith('field-')) && this.eventScale > 0.45) this.duckUntil = Math.max(this.duckUntil, this.context.currentTime + 0.28);
  }

  playDriftBoost(stage: 1 | 2 | 3) {
    this.sample('whoosh', 0.34 + stage * 0.11, 0.95 + stage * 0.13);
    this.sample(stage === 3 ? 'grand' : 'spark', 0.12 + stage * 0.08, 0.85 + stage * 0.17, 0.06);
  }

  playDriftCharge(stage: 1 | 2 | 3) {
    if (!this.context || !this.buffers.has('spark')) return;
    this.driftCueCount++;
    this.lastDriftCue = stage;
    // Short layered magic accents mark the blue, gold, and cosmic sparks.
    this.sample('spark', 0.24 + stage * 0.06, 1.08 + stage * 0.18, 0, 0.5);
    if (stage === 2) this.sample('surge', 0.16, 1.25, 0.04, 0.55);
    if (stage === 3) {
      this.sample('grand', 0.3, 1.2, 0.035, 0.8);
      this.duckUntil = Math.max(this.duckUntil, this.context.currentTime + 0.24);
    }
  }

  playSignature(character: CharacterId) {
    if (character === 'stitch') {
      this.sample('plasmaCast', 0.52, 1.02);
      this.sample('whoosh', 0.16, 1.16);
      return;
    }
    const palette: Record<CharacterId, [AssetName, number, number]> = {
      genie: ['grand', 0.38, 1.08], mickey: ['spark', 0.36, 1.28], stitch: ['plasmaCast', 0.52, 1.02],
      elsa: ['ice', 0.4, 1], moana: ['whoosh', 0.4, 0.88], buzz: ['time', 0.42, 1.7],
      maleficent: ['grand', 0.42, 0.68], hades: ['surge', 0.44, 0.74], jack: ['spark', 0.36, 0.9], mulan: ['whoosh', 0.41, 1.23],
    };
    const [name, volume, rate] = palette[character];
    this.sample(name, volume, rate);
    if (character === 'buzz' || character === 'maleficent') this.sample('whoosh', 0.19, rate * 0.82, 0.055);
  }

  playUltimate(character: CharacterId) {
    if (character === 'stitch') {
      this.play('ufo-arrival');
      this.play('ufo-siren');
      if (this.context) this.duckUntil = this.context.currentTime + STITCH_UFO_INBOUND_DURATION;
      return;
    }
    const dark = character === 'maleficent' || character === 'hades';
    const quick = character === 'buzz' || character === 'mulan';
    this.sample('whoosh', 0.48, quick ? 1.24 : dark ? 0.68 : 0.92);
    this.sample('grand', 0.53, dark ? 0.71 : quick ? 1.28 : 1, 0.06);
    this.sample('heavy', 0.32, 0.82, 0.12);
    if (character === 'moana') this.sample('water', 0.28, 0.85, 0.08);
    if (character === 'elsa') this.sample('ice', 0.32, 0.84, 0.08);
    if (character === 'buzz') this.sample('laser', 0.32, 0.8, 0.12);
    if (character === 'hades' || character === 'maleficent') this.sample('fire', 0.26, dark ? 0.83 : 1, 0.12, 1.3);
    if (character === 'jack') this.sample('cannon', 0.32, 0.9, 0.12, 1.5);
    if (this.context) this.duckUntil = this.context.currentTime + 0.65;
  }
}
