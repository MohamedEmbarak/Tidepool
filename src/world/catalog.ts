export const MAX_DEPTH = 120;
export const SAVE_KEY = 'tidepool.expedition.v1';
export const LAYOUT_KEY = 'tidepool.layout.v1';

export function randomSequence(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

export function readSeed(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const seed = Number(value);
  return Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff ? seed : null;
}

export const RELICS = [
  { id: 'pearl', name: 'The waking pearl', type: 'Natural wonder', depth: 2, color: '#ffe7c6', clue: 'A closed shell holds its own little sunrise.', story: 'Warm to the touch, even this far below the sun. Opening its shell lets the first note of an old song escape.' },
  { id: 'bottle', name: 'A letter to the sea', type: 'Lost message', depth: 18, color: '#97e9d3', clue: 'Follow the glass glint below the reef.', story: 'The paper inside reads: “If you find this, you went farther than I did. Keep going.” There is no signature.' },
  { id: 'compass', name: 'The wayward compass', type: 'Shipwreck relic', depth: 39, color: '#eec18c', clue: 'Something still points home among the broken timbers.', story: 'Its needle has forgotten north. It points down instead, toward a place that does not appear on any chart.' },
  { id: 'amber', name: 'The swallowed sunrise', type: 'An unlikely gift', depth: 50, color: '#ffc46b', clue: 'The golden fish swallowed something bright. Hold it gently until it spits out its treasure.', story: 'A patient hand and a little hiccup. The fish gives back a bead of amber with a sun-shaped inclusion.' },
  { id: 'key', name: 'The overgrown key', type: 'Garden secret', depth: 68, color: '#d4eea2', clue: 'Touch the curled fronds. The garden can open.', story: 'Kelp has grown through the bow, but the teeth are untouched. Whatever this key once opened has been waiting patiently.' },
  { id: 'medallion', name: 'The navigator’s promise', type: 'Locked-away memory', depth: 80, color: '#efc886', clue: 'An old chest drifts below the garden. Lift its lid and look inside.', story: 'Salt has taken the name from the lid. Inside, a bronze medallion still carries a map of the stars.' },
  { id: 'rune', name: 'The tide sigil', type: 'Sealed archive', depth: 94, color: '#a8e8ed', clue: 'Three touches will fracture the arch’s seal. Its stones hide a luminous tablet.', story: 'The stone breaks along a line drawn centuries ago. A single letter remains, warm and bright in the cold water.' },
  { id: 'lantern', name: 'A borrowed star', type: 'Abyssal light', depth: 98, color: '#9fd9ff', clue: 'A blue ember hangs beneath the stone arch.', story: 'There is no flame inside. A tiny constellation has made a home in the glass, and every point of light is moving.' },
  { id: 'moon', name: 'The missing moon', type: 'Final fragment', depth: 118, color: '#d7bdff', clue: 'Each discovery breaks one rune seal. Find every other memory to free the moon.', story: 'The last piece of a song older than the wreck, the forest, and the reef. The ocean remembers who was singing.' },
] as const;

export type RelicId = (typeof RELICS)[number]['id'];
export type Relic = (typeof RELICS)[number];
export const SEAL_IDS = RELICS.filter(r => r.id !== 'moon').map(r => r.id);
const PLACEMENT_ORDER: RelicId[] = ['pearl', 'bottle', 'compass', 'key', 'lantern', 'moon', 'amber', 'medallion', 'rune'];
export function discoveryLocations(seed: number) {
  const random = randomSequence(seed);
  const positions = new Map(PLACEMENT_ORDER.map(id => [id, { x: (random() - 0.5) * 6.4, z: 0.3 + random() * 2.1 }]));
  return RELICS.map(relic => ({ id: relic.id, depth: relic.depth, ...positions.get(relic.id)! }));
}
export const ZONES = [
  { name: 'The sunlit reef', short: 'Reef', at: 0, title: 'Follow your curiosity.', description: 'A little world beneath the surface. Touch what glimmers. See what answers.' },
  { name: 'The drifting gardens', short: 'Drift', at: 30, title: 'Some things were left behind.', description: 'Jellies drift past the bones of an old boat. Look between the timbers.' },
  { name: 'The kelp cathedral', short: 'Kelp', at: 60, title: 'The forest keeps a secret.', description: 'Brush the fronds. There is more here than meets the eye.' },
  { name: 'The midnight archive', short: 'Abyss', at: 90, title: 'Even the dark remembers.', description: 'Gather the scattered memories. Something below is listening.' },
] as const;

export function readFinds(value: string | null): RelicId[] {
  try {
    const parsed: unknown = JSON.parse(value ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const known = RELICS.filter((r) => parsed.includes(r.id)).map((r) => r.id);
    // Older completed expeditions gain new discoveries without bypassing their seals.
    return known.includes('moon') && SEAL_IDS.some(id => !known.includes(id)) ? known.filter(id => id !== 'moon') : known;
  } catch { return []; }
}

export function canCollect(id: RelicId, found: ReadonlySet<RelicId>, opened: ReadonlySet<RelicId>) {
  if (found.has(id)) return false;
  if (['pearl', 'key', 'amber', 'medallion', 'rune'].includes(id) && !opened.has(id)) return false;
  return id !== 'moon' || RELICS.every((r) => r.id === 'moon' || found.has(r.id));
}

export function approach(current: number, target: number, dt: number, reduced = false) {
  const bounded = Math.min(MAX_DEPTH, Math.max(0, target));
  return reduced ? bounded : current + (bounded - current) * (1 - Math.exp(-7 * Math.min(dt, 0.05)));
}
