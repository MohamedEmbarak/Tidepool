export const MAX_DEPTH = 120;
export const SAVE_KEY = 'tidepool.expedition.v1';

export const RELICS = [
  { id: 'pearl', name: 'The waking pearl', type: 'Natural wonder', depth: 2, x: 1.3, color: '#ffe7c6', clue: 'A closed shell holds its own little sunrise.', story: 'Warm to the touch, even this far below the sun. Opening its shell lets the first note of an old song escape.' },
  { id: 'bottle', name: 'A letter to the sea', type: 'Lost message', depth: 18, x: -2.6, color: '#97e9d3', clue: 'Follow the glass glint below the reef.', story: 'The paper inside reads: “If you find this, you went farther than I did. Keep going.” There is no signature.' },
  { id: 'compass', name: 'The wayward compass', type: 'Shipwreck relic', depth: 39, x: 2.1, color: '#eec18c', clue: 'Something still points home among the broken timbers.', story: 'Its needle has forgotten north. It points down instead, toward a place that does not appear on any chart.' },
  { id: 'key', name: 'The overgrown key', type: 'Garden secret', depth: 68, x: -1.8, color: '#d4eea2', clue: 'Touch the curled fronds. The garden can open.', story: 'Kelp has grown through the bow, but the teeth are untouched. Whatever this key once opened has been waiting patiently.' },
  { id: 'lantern', name: 'A borrowed star', type: 'Abyssal light', depth: 98, x: 2.4, color: '#9fd9ff', clue: 'A blue ember hangs beneath the stone arch.', story: 'There is no flame inside. A tiny constellation has made a home in the glass, and every point of light is moving.' },
  { id: 'moon', name: 'The missing moon', type: 'Final fragment', depth: 118, x: 0, color: '#d7bdff', clue: 'Bring five memories to the rings at the bottom.', story: 'The last piece of a song older than the wreck, the forest, and the reef. The ocean remembers who was singing.' },
] as const;

export type RelicId = (typeof RELICS)[number]['id'];
export type Relic = (typeof RELICS)[number];
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
    return RELICS.filter((r) => parsed.includes(r.id)).map((r) => r.id);
  } catch { return []; }
}

export function canCollect(id: RelicId, found: ReadonlySet<RelicId>, opened: ReadonlySet<RelicId>) {
  if (found.has(id)) return false;
  if ((id === 'pearl' || id === 'key') && !opened.has(id)) return false;
  return id !== 'moon' || RELICS.every((r) => r.id === 'moon' || found.has(r.id));
}

export function approach(current: number, target: number, dt: number, reduced = false) {
  const bounded = Math.min(MAX_DEPTH, Math.max(0, target));
  return reduced ? bounded : current + (bounded - current) * (1 - Math.exp(-7 * Math.min(dt, 0.05)));
}
