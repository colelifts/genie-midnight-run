import type { CharacterId } from './characters';

type SoundName = 'count' | 'go' | 'drift' | 'boost' | 'pad' | 'wish' | 'shield' | 'shot' | 'hit' | 'stun' | 'lap' | 'final-lap' | 'ultimate' | 'trick' | 'draft' | 'pickup' | 'cart-warning' | 'birds';

const ULTIMATE_STINGS: Record<CharacterId, number[]> = {
  genie: [392, 587, 784, 1175], mickey: [523, 659, 784, 1047], stitch: [220, 659, 330, 988],
  elsa: [659, 880, 988, 1319], moana: [294, 440, 587, 880], buzz: [392, 587, 784, 1568],
  maleficent: [185, 277, 370, 740], hades: [165, 247, 330, 659], jack: [220, 330, 440, 659], mulan: [294, 440, 587, 1175],
};

const MUSIC = {
  market: [196, 246.94, 293.66, 392, 293.66, 246.94, 220, 293.66, 174.61, 220, 261.63, 349.23, 261.63, 220, 196, 261.63],
  roof: [196, 293.66, 392, 493.88, 392, 293.66, 261.63, 392, 220, 329.63, 440, 493.88, 440, 329.63, 293.66, 392],
  garden: [220, 261.63, 329.63, 440, 329.63, 261.63, 293.66, 392, 246.94, 293.66, 369.99, 493.88, 369.99, 293.66, 261.63, 440],
  cave: [174.61, 220, 261.63, 349.23, 261.63, 220, 196, 261.63, 164.81, 196, 246.94, 329.63, 246.94, 196, 174.61, 220],
} as const;

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private fountainGain: GainNode | null = null;
  private fountainFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;
  private hatGain: GainNode | null = null;
  private nextBeat = 0;
  private beat = 0;
  muted = false;

  start() {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const context = new AudioContext();
    const master = context.createGain();
    master.gain.value = 0.33;
    master.connect(context.destination);
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 440;
    engineFilter.connect(master);
    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(engineFilter);
    const engineOscillator = context.createOscillator();
    engineOscillator.type = 'sawtooth';
    engineOscillator.frequency.value = 80;
    engineOscillator.connect(engineGain);
    engineOscillator.start();
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
    noiseSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    const fountainFilter = context.createBiquadFilter();
    fountainFilter.type = 'bandpass';
    fountainFilter.frequency.value = 650;
    fountainFilter.Q.value = 0.55;
    const fountainGain = context.createGain();
    fountainGain.gain.value = 0;
    noiseSource.connect(fountainFilter);
    fountainFilter.connect(fountainGain);
    fountainGain.connect(master);
    const skidFilter = context.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1450;
    skidFilter.Q.value = 0.7;
    const skidGain = context.createGain();
    skidGain.gain.value = 0;
    noiseSource.connect(skidFilter);
    skidFilter.connect(skidGain);
    skidGain.connect(master);
    const hatFilter = context.createBiquadFilter();
    hatFilter.type = 'highpass';
    hatFilter.frequency.value = 5200;
    const hatGain = context.createGain();
    hatGain.gain.value = 0;
    noiseSource.connect(hatFilter);
    hatFilter.connect(hatGain);
    hatGain.connect(master);
    noiseSource.start();
    this.context = context;
    this.master = master;
    this.engineOscillator = engineOscillator;
    this.engineGain = engineGain;
    this.windGain = windGain;
    this.windFilter = windFilter;
    this.fountainGain = fountainGain;
    this.fountainFilter = fountainFilter;
    this.skidGain = skidGain;
    this.hatGain = hatGain;
    this.nextBeat = context.currentTime + 0.1;
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.master && this.context) this.master.gain.setTargetAtTime(value ? 0 : 0.33, this.context.currentTime, 0.05);
  }

  update(speed: number, drifting: boolean, ultimate: boolean, active: boolean, zone: string, finalLap = false, progress = 0) {
    if (!this.context || !this.engineOscillator || !this.engineGain) return;
    const now = this.context.currentTime;
    this.engineOscillator.frequency.setTargetAtTime(75 + speed * (ultimate ? 5.7 : 4.1) + (drifting ? 18 : 0), now, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.045 + Math.min(speed, 42) * 0.0011 : 0, now, 0.08);
    const cave = zone === 'DESERT CAVE';
    const garden = zone === 'PALACE GARDEN';
    this.windGain?.gain.setTargetAtTime(active ? cave ? 0.055 : garden ? 0.019 : 0.031 : 0, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(cave ? 300 : garden ? 710 : 480 + Math.min(speed, 45) * 9, now, 0.4);
    const fountainDistance = Math.abs(progress - 0.44);
    const fountainPresence = garden ? Math.max(0, 1 - fountainDistance / 0.065) : 0;
    this.fountainGain?.gain.setTargetAtTime(active ? fountainPresence * (0.015 + Math.sin(now * 3.4) * 0.003) : 0, now, 0.2);
    this.fountainFilter?.frequency.setTargetAtTime(620 + Math.sin(now * 1.8) * 110, now, 0.25);
    this.skidGain?.gain.setTargetAtTime(active && drifting ? 0.055 + Math.min(speed, 40) * 0.0014 : 0, now, 0.075);
    if (!active || this.muted) return;
    if (this.nextBeat < now - 0.25) this.nextBeat = now + 0.03;
    // Short original motifs share a beat so moving between districts sounds seamless.
    const notes = cave ? MUSIC.cave : garden ? MUSIC.garden : zone === 'ROOFTOP RUN' ? MUSIC.roof : MUSIC.market;
    while (this.nextBeat < now + 0.1) {
      const note = notes[this.beat % notes.length];
      this.tone(note, 0.075, 'triangle', this.nextBeat, 0.13);
      if (this.beat % 4 === 0) {
        this.tone(note / 4, 0.085, 'triangle', this.nextBeat, 0.28);
        this.kick(this.nextBeat);
      }
      if (this.beat % 4 === 2) this.tone(155, 0.028, 'triangle', this.nextBeat, 0.09);
      if (garden && this.beat % 4 === 3) this.tone(note * 2, 0.025, 'sine', this.nextBeat, 0.2);
      if (cave && this.beat % 8 === 7) this.tone(note / 2, 0.033, 'sine', this.nextBeat, 0.7);
      if (zone === 'MIDNIGHT MARKET' && this.beat % 16 === 15) this.tone(1174.66, 0.018, 'sine', this.nextBeat, 0.31);
      if (this.hatGain) {
        this.hatGain.gain.setValueAtTime(0, this.nextBeat);
        this.hatGain.gain.linearRampToValueAtTime(cave ? 0.018 : 0.033, this.nextBeat + 0.003);
        this.hatGain.gain.exponentialRampToValueAtTime(0.0001, this.nextBeat + 0.055);
      }
      this.beat++;
      this.nextBeat += finalLap ? 0.215 : 0.25;
    }
  }

  play(name: SoundName) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    switch (name) {
      case 'count': this.tone(440, 0.13, 'square', now, 0.12); break;
      case 'go': this.chime([523, 659, 784], now, 0.14, 0.22); break;
      case 'drift': this.chime([400, 550], now, 0.1, 0.08); break;
      case 'boost': this.sweep(350, 920, 0.28, now, 0.14); break;
      case 'pad': this.sweep(250, 1150, 0.42, now, 0.16); this.chime([523, 784, 1046], now + 0.04, 0.085, 0.2); break;
      case 'wish': this.chime([600, 800, 1000], now, 0.07, 0.12); break;
      case 'shield': this.chime([390, 587, 783], now, 0.06, 0.2); break;
      case 'shot': this.sweep(960, 330, 0.16, now, 0.12); break;
      case 'hit': this.sweep(200, 65, 0.18, now, 0.15); break;
      case 'stun': this.chime([780, 620, 495], now, 0.07, 0.17); break;
      case 'lap': this.chime([392, 523, 659, 784], now, 0.1, 0.25); break;
      case 'final-lap': this.chime([392, 523, 784, 1047, 1319], now, 0.075, 0.24); this.kick(now + 0.02); break;
      case 'ultimate': this.chime([196, 392, 587, 784], now, 0.11, 0.4); break;
      case 'trick': this.chime([659, 880, 1175], now, 0.055, 0.16); break;
      case 'draft': this.sweep(380, 980, 0.3, now, 0.11); this.chime([587, 784], now + 0.08, 0.08, 0.12); break;
      case 'pickup': this.chime([630, 890], now, 0.08, 0.1); break;
      case 'cart-warning': this.chime([392, 293.66], now, 0.17, 0.24); break;
      case 'birds': this.chime([1046.5, 1318.5, 1174.7], now, 0.085, 0.11); break;
    }
  }

  playDriftBoost(stage: 1 | 2 | 3) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    this.sweep(300 + stage * 60, 740 + stage * 150, 0.19 + stage * 0.055, now, 0.095 + stage * 0.014);
    this.chime(stage === 3 ? [659, 988, 1319] : stage === 2 ? [587, 880] : [523, 784], now + 0.035, 0.055, 0.15 + stage * 0.025);
    if (stage === 3) this.kick(now + 0.035);
  }

  playUltimate(character: CharacterId) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const notes = ULTIMATE_STINGS[character];
    const type: OscillatorType = character === 'stitch' || character === 'buzz' ? 'square' : character === 'maleficent' || character === 'hades' ? 'sawtooth' : 'triangle';
    notes.forEach((frequency, index) => this.tone(frequency, index === notes.length - 1 ? 0.13 : 0.09, type, now + index * 0.075, index === notes.length - 1 ? 0.38 : 0.18));
    this.kick(now + 0.02);
  }

  private chime(notes: number[], time: number, gap: number, length: number) {
    notes.forEach((note, i) => this.tone(note, 0.13, 'sine', time + i * gap, length));
  }

  private kick(start: number) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, start);
    osc.frequency.exponentialRampToValueAtTime(48, start + 0.16);
    gain.gain.setValueAtTime(0.085, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.17);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + 0.18);
  }

  private tone(frequency: number, volume: number, type: OscillatorType, start: number, duration: number) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private sweep(startHz: number, endHz: number, duration: number, start: number, volume: number) {
    if (!this.context || !this.master) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(startHz, start);
    osc.frequency.exponentialRampToValueAtTime(endHz, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }
}
