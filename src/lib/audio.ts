/**
 * A tiny synth built directly on the Web Audio API — no samples, no network.
 *
 * Design rules, all of them psychoacoustic rather than technical:
 *
 * 1. Muted by default. Unrequested sound is the fastest way to make a
 *    playground feel hostile, and autoplay policy would block it anyway.
 * 2. Pentatonic only. Every note in a pentatonic set is consonant with every
 *    other, so a user mashing the screen cannot produce a wrong chord. The
 *    instrument is incapable of punishing them — which is the whole point of
 *    a fidget object.
 * 3. Pitch rises with interaction *density*, then decays back. Rewarding a
 *    flurry with a rising line makes the flurry feel like it went somewhere.
 * 4. Soft attack, long release, low gain. Nothing percussive or startling.
 */

const PENTATONIC = [0, 2, 4, 7, 9]; // scale degrees in semitones
const BASE_MIDI = 62; // D4
const VOICE_LIMIT = 12; // hard cap on simultaneous oscillators

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class TidepoolAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private voices = 0;
  private heat = 0; // interaction density, 0..1
  private lastHit = 0;

  enabled = false;

  /** Must be called from inside a user gesture to satisfy autoplay policy. */
  async enable(): Promise<void> {
    if (this.ctx) {
      await this.ctx.resume();
      if (this.master) {
        const now = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
        this.master.gain.exponentialRampToValueAtTime(0.5, now + 0.25);
      }
      this.enabled = true;
      return;
    }

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    // Cheap synthetic plate reverb: exponentially decaying noise. Costs one
    // short buffer instead of an impulse-response download.
    const reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    reverb.buffer = buf;

    const wet = ctx.createGain();
    wet.gain.value = 0.34;
    reverb.connect(wet);
    wet.connect(master);

    this.ctx = ctx;
    this.master = master;
    this.reverb = reverb;

    await ctx.resume();
    master.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.6);
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(
      Math.max(this.master.gain.value, 0.0001),
      now,
    );
    this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  }

  /**
   * One note.
   * @param intensity 0..1 — maps to velocity and brightness.
   * @param tier      reward tier; 'rare' transposes up an octave and adds a
   *                  detuned fifth, so a find is audibly distinct.
   */
  pluck(
    intensity = 0.5,
    tier: 'common' | 'uncommon' | 'rare' = 'common',
  ): void {
    if (!this.enabled || !this.ctx || !this.master || !this.reverb) return;
    if (this.voices >= VOICE_LIMIT) return;

    const ctx = this.ctx;
    const master = this.master;
    const reverb = this.reverb;
    const now = ctx.currentTime;

    // Interaction density: each hit adds heat, time bleeds it away.
    this.heat = Math.max(
      0,
      Math.min(1, this.heat + 0.12 - (now - this.lastHit) * 0.35),
    );
    this.lastHit = now;

    const degree = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)];
    const octave = 12 * Math.floor(this.heat * 2.99);
    const bonus = tier === 'rare' ? 12 : tier === 'uncommon' ? 7 : 0;
    const freq = midiToHz(BASE_MIDI + degree + octave + bonus);

    const dur = tier === 'rare' ? 2.6 : 1.5;
    const peak = 0.16 * (0.45 + intensity * 0.55) * (tier === 'rare' ? 1.3 : 1);

    const make = (f: number, detune: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filt = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = f;
      osc.detune.value = detune;

      filt.type = 'lowpass';
      filt.frequency.value = 900 + intensity * 3200;
      filt.Q.value = 0.7;

      // 12ms attack — perceptible as "soft" rather than clicky.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

      osc.connect(filt);
      filt.connect(gain);
      gain.connect(master);
      gain.connect(reverb);

      this.voices += 1;
      osc.onended = () => {
        this.voices -= 1;
        osc.disconnect();
        filt.disconnect();
        gain.disconnect();
      };

      osc.start(now);
      osc.stop(now + dur + 0.05);
    };

    make(freq, 0);
    if (tier === 'rare') make(freq * 1.5, 7); // a fifth above, lightly detuned
  }

  /** Low, slow swell used when a section comes into view. */
  swell(depth: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const master = this.master;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = midiToHz(BASE_MIDI - 24 - depth * 5);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 1.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

    osc.connect(gain);
    gain.connect(master);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + 4.6);
  }
}

export const audio = new TidepoolAudio();
