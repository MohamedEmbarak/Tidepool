/**
 * Variable-ratio reward scheduling.
 *
 * Skinner's core finding is that an *unpredictable* payout ratio sustains
 * responding far longer than a fixed one — and, importantly for a toy rather
 * than a slot machine, it does so without the user having to be deprived of
 * anything. Every interaction here pays out *something* (a ripple, a chime);
 * the variable schedule only governs how ornate that payout is.
 *
 * Three tiers, drawn per-interaction:
 *   common (~82%)   — the baseline squish/ripple. Never absent.
 *   uncommon (~15%) — a brighter burst, a warmer tone, a few more particles.
 *   rare (~3%)      — a named "find": a creature surfaces, the jar increments.
 *
 * A pity counter guarantees a rare inside 60 interactions, so a persistent
 * user is never stonewalled by a bad streak. This is the deliberate
 * departure from a pure gambling schedule: the ceiling on frustration
 * matters more than the purity of the curve.
 */

export type RewardTier = 'common' | 'uncommon' | 'rare';

const UNCOMMON_P = 0.15;
const RARE_P = 0.03;
const PITY_LIMIT = 60;

let sinceRare = 0;

export function rollReward(): RewardTier {
  sinceRare += 1;

  if (sinceRare >= PITY_LIMIT) {
    sinceRare = 0;
    return 'rare';
  }

  const r = Math.random();
  if (r < RARE_P) {
    sinceRare = 0;
    return 'rare';
  }
  if (r < RARE_P + UNCOMMON_P) return 'uncommon';
  return 'common';
}

/** Reset between sessions/tests so the pity counter is not sticky. */
export function resetRewardState(): void {
  sinceRare = 0;
}

/* ---------- small numeric helpers shared by the scenes ---------- */

export const rand = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const randInt = (min: number, max: number): number =>
  Math.floor(rand(min, max + 1));

export const pick = <T,>(xs: readonly T[]): T =>
  xs[Math.floor(Math.random() * xs.length)];

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/**
 * Frame-rate independent exponential smoothing.
 * `smoothing` is the fraction of the gap remaining after one second.
 * Using this instead of a raw `lerp(a, b, 0.1)` per frame keeps the cursor
 * and camera easing identical on a 60Hz and a 144Hz display.
 */
export const damp = (
  a: number,
  b: number,
  smoothing: number,
  dt: number,
): number => lerp(a, b, 1 - Math.pow(smoothing, dt));

/** Names drawn when a `rare` roll lands, so a find feels specific. */
export const CREATURE_NAMES = [
  'Lantern Medusa',
  'Glass Squid',
  'Ghost Pipefish',
  'Bloom Anemone',
  'Comb Jelly',
  'Paper Nautilus',
  'Veil Urchin',
  'Blue Dragon',
  'Sea Butterfly',
  'Hatchetfish',
] as const;
