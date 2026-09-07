export const BPM = 76;
export const STEP_SECONDS = 60 / BPM / 2;
// An eight-bar progression, voiced around D with suspended ninths and sixths.
const CHORDS = [[50, 57, 61, 64], [47, 54, 57, 62], [43, 50, 57, 59], [45, 52, 57, 62]];
const MOTIF = [0, 2, 1, 3, 2, 1, 3, 2];
export type ScoreNote = { midi: number; duration: number; gain: number; voice: 'pad' | 'bell' | 'bass'; pan: number };
export function scoreStep(step: number, depth: number, complete: boolean): ScoreNote[] {
  const chord = CHORDS[Math.floor(step / 16) % CHORDS.length];
  const notes: ScoreNote[] = [];
  const darkness = Math.min(1, Math.max(0, depth));
  if (step % 16 === 0) {
    chord.forEach((midi, i) => notes.push({ midi, duration: STEP_SECONDS * 18, gain: 0.023, voice: 'pad', pan: (i - 1.5) * 0.3 }));
    notes.push({ midi: chord[0] - 12, duration: STEP_SECONDS * 14, gain: 0.052, voice: 'bass', pan: 0 });
  }
  if (step % 2 === 0 || complete) {
    notes.push({ midi: chord[MOTIF[Math.floor(step / 2) % 8]] + 12, duration: 1.7 + darkness, gain: 0.052 - darkness * 0.016, voice: 'bell', pan: Math.sin(step * 0.7) * 0.45 });
  }
  if (step % 16 === 10 || (complete && step % 8 === 7)) {
    notes.push({ midi: chord[3] + (complete ? 24 : 12), duration: 3, gain: 0.025, voice: 'bell', pan: -0.25 });
  }
  return notes;
}
