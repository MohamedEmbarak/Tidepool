import { scoreStep, STEP_SECONDS, type ScoreNote } from './score';

const frequency = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Shared voice renderer, also used by the offline audio checks. */
export function synthesizeNote(ctx: BaseAudioContext, output: AudioNode, note: ScoreNote, when: number, depth: number) {
  const envelope = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = ctx.createStereoPanner();
  const pad = note.voice === 'pad';
  filter.type = 'lowpass'; filter.frequency.value = (pad ? 900 : 4200) * (1 - depth * 0.58); filter.Q.value = 0.5;
  panner.pan.value = note.pan;
  const attack = pad ? 1.5 : note.voice === 'bass' ? 0.08 : 0.012;
  envelope.gain.setValueAtTime(0.0001, when);
  envelope.gain.exponentialRampToValueAtTime(note.gain, when + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, when + note.duration);
  envelope.connect(filter); filter.connect(panner); panner.connect(output);
  const sources: OscillatorNode[] = [];
  const partials = pad ? [[1, -5], [1.003, 5]] : note.voice === 'bell' ? [[1, 0], [2, 0]] : [[1, 0]];
  const gains: GainNode[] = [];
  for (const [i, [harmonic, detune]] of partials.entries()) {
    const oscillator = ctx.createOscillator(); const mix = ctx.createGain();
    oscillator.type = pad ? 'triangle' : 'sine';
    oscillator.frequency.value = frequency(note.midi) * harmonic; oscillator.detune.value = detune;
    mix.gain.value = i === 0 ? 0.75 : pad ? 0.28 : 0.11;
    oscillator.connect(mix); mix.connect(envelope); oscillator.start(when); oscillator.stop(when + note.duration + 0.03);
    sources.push(oscillator); gains.push(mix);
  }
  let remaining = sources.length;
  sources.forEach((source) => { source.onended = () => { if (--remaining === 0) { sources.forEach(s => s.disconnect()); gains.forEach(g => g.disconnect()); envelope.disconnect(); filter.disconnect(); panner.disconnect(); } }; });
  return sources;
}

class TidepoolAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private bus: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private nextBeat = 0;
  private step = 0;
  private generation = 0;
  private depth = 0;
  private complete = false;
  private suspended = false;
  private volume = 0.55;
  private noise: AudioBuffer | null = null;
  enabled = false;

  async enable() {
    const generation = ++this.generation;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio is unavailable');
      this.ctx = new Ctor();
      const ctx = this.ctx;
      const master = ctx.createGain(); master.gain.value = 0.0001;
      const compressor = ctx.createDynamicsCompressor(); compressor.threshold.value = -16; compressor.ratio.value = 4; compressor.knee.value = 12; compressor.release.value = 0.3;
      master.connect(compressor); compressor.connect(ctx.destination);
      const bus = ctx.createGain(); bus.connect(master);
      const reverb = ctx.createConvolver();
      const length = Math.floor(ctx.sampleRate * 2.8); const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      let seed = 12345;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      for (let channel = 0; channel < 2; channel++) { const data = impulse.getChannelData(channel); for (let i = 0; i < length; i++) data[i] = (random() * 2 - 1) * (1 - i / length) ** 3; }
      reverb.buffer = impulse; const wet = ctx.createGain(); wet.gain.value = 0.24; bus.connect(reverb); reverb.connect(wet); wet.connect(master);
      const delay = ctx.createDelay(1); delay.delayTime.value = STEP_SECONDS * 1.5; const echo = ctx.createGain(); echo.gain.value = 0.14;
      bus.connect(delay); delay.connect(echo); echo.connect(master);
      this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.14), ctx.sampleRate);
      const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = random() * 2 - 1;
      this.master = master; this.bus = bus;
    }
    await this.ctx.resume();
    if (generation !== this.generation) return;
    this.enabled = true;
    this.rampVolume();
    if (!this.suspended) this.startScheduler();
  }
  private rampVolume() {
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime; const gain = this.master.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(Math.max(0.0001, gain.value), now);
    gain.exponentialRampToValueAtTime(this.enabled && !this.suspended ? Math.max(0.0001, this.volume * 0.75) : 0.0001, now + 0.15);
  }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(1, volume)); this.rampVolume(); }
  setDepth(depth: number, complete = false) { this.depth = Math.max(0, Math.min(1, depth)); this.complete = complete; }
  private track(sources: AudioScheduledSourceNode[]) {
    for (const source of sources) { this.sources.add(source); source.addEventListener('ended', () => this.sources.delete(source), { once: true }); }
  }
  private tone(note: ScoreNote, when: number) {
    if (!this.ctx || !this.bus || this.sources.size > 64) return;
    this.track(synthesizeNote(this.ctx, this.bus, note, when, this.depth));
  }
  private pulse(when: number) {
    if (!this.ctx || !this.bus || !this.noise) return;
    const ctx = this.ctx, source = ctx.createBufferSource(), envelope = ctx.createGain(), filter = ctx.createBiquadFilter();
    source.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.value = 1800 - this.depth * 900; filter.Q.value = 0.7;
    envelope.gain.setValueAtTime(0.0001, when); envelope.gain.linearRampToValueAtTime(0.009, when + 0.01); envelope.gain.exponentialRampToValueAtTime(0.0001, when + 0.12);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.bus); source.start(when); source.stop(when + 0.14);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); }; this.track([source]);
  }
  private startScheduler() {
    if (!this.ctx || this.timer) return;
    this.nextBeat = this.ctx.currentTime + 0.06;
    const tick = () => {
      if (!this.ctx || !this.enabled || this.suspended) return;
      if (this.nextBeat < this.ctx.currentTime - 0.2) this.nextBeat = this.ctx.currentTime + 0.05;
      while (this.nextBeat < this.ctx.currentTime + 0.15) {
        for (const note of scoreStep(this.step, this.depth, this.complete)) this.tone(note, this.nextBeat);
        if (this.step % 4 === 2) this.pulse(this.nextBeat);
        this.step++; this.nextBeat += STEP_SECONDS;
      }
    };
    tick(); this.timer = setInterval(tick, 35);
  }
  private stopScheduler() {
    if (this.timer) clearInterval(this.timer); this.timer = null;
    const when = (this.ctx?.currentTime ?? 0) + 0.17;
    this.sources.forEach(source => { try { source.stop(when); } catch { /* Voice already ended. */ } });
    this.sources.clear(); this.step = Math.floor(this.step / 16) * 16;
  }
  disable() { ++this.generation; this.enabled = false; this.stopScheduler(); this.rampVolume(); }
  setSuspended(suspended: boolean) {
    this.suspended = suspended;
    if (suspended) this.stopScheduler();
    else if (this.enabled) void this.ctx?.resume().then(() => { if (!this.suspended && this.enabled) this.startScheduler(); }).catch(() => {});
    this.rampVolume();
  }
  pluck(intensity = 0.5, tier: 'common' | 'uncommon' | 'rare' = 'common') {
    if (!this.enabled || !this.ctx || this.suspended) return;
    const chord = tier === 'rare' ? [74, 78, 81, 85] : [74, 81];
    chord.forEach((midi, i) => this.tone({ midi, duration: 2.6, gain: 0.045 * intensity, voice: 'bell', pan: (i - 1.5) * 0.18 }, this.ctx!.currentTime + i * 0.11));
  }
  dispose() { this.disable(); void this.ctx?.close(); this.ctx = null; this.master = null; this.bus = null; this.noise = null; }
}
export const audio = new TidepoolAudio();
