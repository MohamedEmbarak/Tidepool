import { canCollect, type RelicId } from './catalog';

export type DiscoveryAction = 'tap' | 'hold' | 'accessible';
export type DiscoveryResult = 'collect' | 'opened' | 'cracked' | 'hold-needed' | 'sealed' | 'none';

export class DiscoveryLocks {
  readonly opened = new Set<RelicId>();
  archHits = 0;
  constructor(readonly found: Set<RelicId>) {}
  interact(id: RelicId, action: DiscoveryAction): DiscoveryResult {
    if (this.found.has(id)) return 'none';
    if (!this.opened.has(id)) {
      if (id === 'amber' && action === 'tap') return 'hold-needed';
      if (id === 'rune' && ++this.archHits < 3) return 'cracked';
      if (['pearl', 'key', 'amber', 'medallion', 'rune'].includes(id)) { this.opened.add(id); return 'opened'; }
    }
    return canCollect(id, this.found, this.opened) ? 'collect' : 'sealed';
  }
  reset() { this.opened.clear(); this.archHits = 0; }
}

export function discoveryActionLabel(id: RelicId, opened: readonly RelicId[]) {
  if (opened.includes(id)) return null;
  const labels: Partial<Record<RelicId, string>> = { pearl: 'Open the shell', key: 'Part the fronds', amber: 'Help the fish release its treasure', medallion: 'Open the old chest', rune: 'Break the arch seal' };
  return labels[id] ?? null;
}
