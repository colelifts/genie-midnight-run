type SoundName = 'count' | 'go' | 'drift' | 'boost' | 'wish' | 'shield' | 'shot' | 'hit' | 'stun' | 'lap' | 'ultimate' | 'pickup' | 'cart-warning' | 'birds';

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;
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
    const skidFilter = context.createBiquadFilter();
    skidFilter.type = 'bandpass';
    skidFilter.frequency.value = 1450;
    skidFilter.Q.value = 0.7;
    const skidGain = context.createGain();
    skidGain.gain.value = 0;
    noiseSource.connect(skidFilter);
    skidFilter.connect(skidGain);
    skidGain.connect(master);
    noiseSource.start();
    this.context = context;
    this.master = master;
    this.engineOscillator = engineOscillator;
    this.engineGain = engineGain;
    this.windGain = windGain;
    this.windFilter = windFilter;
    this.skidGain = skidGain;
    this.nextBeat = context.currentTime + 0.1;
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.master && this.context) this.master.gain.setTargetAtTime(value ? 0 : 0.33, this.context.currentTime, 0.05);
  }

  update(speed: number, drifting: boolean, ultimate: boolean, active: boolean, zone: string) {
    if (!this.context || !this.engineOscillator || !this.engineGain) return;
    const now = this.context.currentTime;
    this.engineOscillator.frequency.setTargetAtTime(75 + speed * (ultimate ? 5.7 : 4.1) + (drifting ? 18 : 0), now, 0.08);
    this.engineGain.gain.setTargetAtTime(active ? 0.045 + Math.min(speed, 42) * 0.0011 : 0, now, 0.08);
    const cave = zone === 'DESERT CAVE';
    const garden = zone === 'PALACE GARDEN';
    this.windGain?.gain.setTargetAtTime(active ? cave ? 0.055 : garden ? 0.019 : 0.031 : 0, now, 0.35);
    this.windFilter?.frequency.setTargetAtTime(cave ? 300 : garden ? 710 : 480 + Math.min(speed, 45) * 9, now, 0.4);
    this.skidGain?.gain.setTargetAtTime(active && drifting ? 0.055 + Math.min(speed, 40) * 0.0014 : 0, now, 0.075);
    if (!active || this.muted) return;
    // Small original four-bar arpeggio; scheduled ahead so frames do not affect timing.
    const notes = [196, 246.94, 293.66, 392, 293.66, 246.94, 220, 293.66,
      174.61, 220, 261.63, 349.23, 261.63, 220, 196, 261.63];
    while (this.nextBeat < now + 0.1) {
      const note = notes[this.beat % notes.length];
      this.tone(note, 0.075, 'triangle', this.nextBeat, 0.13);
      if (this.beat % 4 === 0) this.tone(note / 2, 0.045, 'sine', this.nextBeat, 0.28);
      this.beat++;
      this.nextBeat += 0.25;
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
      case 'wish': this.chime([600, 800, 1000], now, 0.07, 0.12); break;
      case 'shield': this.chime([390, 587, 783], now, 0.06, 0.2); break;
      case 'shot': this.sweep(960, 330, 0.16, now, 0.12); break;
      case 'hit': this.sweep(200, 65, 0.18, now, 0.15); break;
      case 'stun': this.chime([780, 620, 495], now, 0.07, 0.17); break;
      case 'lap': this.chime([392, 523, 659, 784], now, 0.1, 0.25); break;
      case 'ultimate': this.chime([196, 392, 587, 784], now, 0.11, 0.4); break;
      case 'pickup': this.chime([630, 890], now, 0.08, 0.1); break;
      case 'cart-warning': this.chime([392, 293.66], now, 0.17, 0.24); break;
      case 'birds': this.chime([1046.5, 1318.5, 1174.7], now, 0.085, 0.11); break;
    }
  }

  private chime(notes: number[], time: number, gap: number, length: number) {
    notes.forEach((note, i) => this.tone(note, 0.13, 'sine', time + i * gap, length));
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
