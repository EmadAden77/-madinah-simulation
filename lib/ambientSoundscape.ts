export type SoundZone = 'settlement' | 'market' | 'farm' | 'route' | 'terrain' | 'residential' | 'well' | 'mosque-area';

export type SoundscapeState = {
  zone: SoundZone;
  label: string;
  wind: number;
  palms: number;
  crowd: number;
  animals: number;
  night: number;
};

function clamp(v: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, v));
}

export function getSoundscapeState(zone: SoundZone, hour: number): SoundscapeState {
  const h = ((hour % 24) + 24) % 24;
  const day = h >= 5.5 && h < 18.6;
  const busy = h >= 7 && h < 12 ? 1 : h >= 15 && h < 18 ? 0.8 : h >= 12 && h < 15 ? 0.55 : 0.18;
  const night = day ? 0 : 1;

  const base: SoundscapeState = { zone, label: 'الواحة', wind: 0.35, palms: 0.28, crowd: 0.08, animals: 0.12, night };
  if (zone === 'market') return { ...base, label: 'السوق', wind: 0.2, palms: 0.08, crowd: 0.72 * busy, animals: 0.34 * busy };
  if (zone === 'farm') return { ...base, label: 'البساتين', wind: 0.28, palms: 0.72, crowd: 0.12 * busy, animals: 0.46 * busy };
  if (zone === 'route') return { ...base, label: 'المسارات', wind: 0.42, palms: 0.12, crowd: 0.18 * busy, animals: 0.52 * busy };
  if (zone === 'terrain') return { ...base, label: 'الحرة والأطراف', wind: 0.68, palms: 0.04, crowd: 0.02, animals: 0.09 };
  if (zone === 'residential') return { ...base, label: 'العمران السكني', wind: 0.22, palms: 0.18, crowd: 0.18 * busy, animals: 0.08 };
  if (zone === 'well') return { ...base, label: 'حول البئر', wind: 0.24, palms: 0.3, crowd: 0.2 * busy, animals: 0.22 * busy };
  if (zone === 'mosque-area') return { ...base, label: 'المركز', wind: 0.18, palms: 0.12, crowd: 0.14 * busy, animals: 0.03 };
  return { ...base, crowd: 0.16 * busy, animals: 0.12 * busy, night };
}

export class AmbientSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private windGain: GainNode | null = null;
  private palmGain: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private animalGain: GainNode | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private active = false;

  private makeNoise(seconds: number) {
    if (!this.ctx) throw new Error('Audio context unavailable');
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last;
    }
    return buffer;
  }

  async start() {
    if (this.active) return;
    this.ctx = this.ctx ?? new AudioContext();
    await this.ctx.resume();

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.24;
    this.master.connect(this.ctx.destination);

    const makeLayer = (filterType: BiquadFilterType, freq: number) => {
      if (!this.ctx || !this.master) throw new Error('Audio context unavailable');
      const src = this.ctx.createBufferSource();
      src.buffer = this.makeNoise(3.2);
      src.loop = true;
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter).connect(gain).connect(this.master);
      src.start();
      this.sources.push(src);
      return gain;
    };

    this.windGain = makeLayer('lowpass', 720);
    this.palmGain = makeLayer('bandpass', 2400);
    this.crowdGain = makeLayer('bandpass', 430);
    this.animalGain = makeLayer('bandpass', 980);
    this.active = true;
  }

  update(state: SoundscapeState) {
    if (!this.ctx || !this.active) return;
    const t = this.ctx.currentTime;
    const set = (node: GainNode | null, value: number) => node?.gain.setTargetAtTime(clamp(value), t, 0.55);
    set(this.windGain, 0.16 * state.wind + 0.03 * state.night);
    set(this.palmGain, 0.12 * state.palms);
    set(this.crowdGain, 0.1 * state.crowd);
    set(this.animalGain, 0.08 * state.animals);
    this.master?.gain.setTargetAtTime(state.night ? 0.18 : 0.24, t, 0.8);
  }

  stop() {
    this.sources.forEach((src) => { try { src.stop(); } catch {} });
    this.sources = [];
    if (this.ctx) void this.ctx.close();
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.palmGain = null;
    this.crowdGain = null;
    this.animalGain = null;
    this.active = false;
  }
}
