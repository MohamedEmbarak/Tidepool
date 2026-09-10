export const MOON_REWARD_KEY = 'tidepool.moon-reward.v1';
export type MoonReward = { unlocked: boolean; night: boolean };

export function readMoonReward(value: string | null, finds: readonly string[]): MoonReward {
  try {
    const saved: unknown = JSON.parse(value ?? 'null');
    if (saved && typeof saved === 'object' && 'unlocked' in saved && saved.unlocked === true) {
      return { unlocked: true, night: !('night' in saved) || saved.night !== false };
    }
  } catch { /* A completed journal can recover the reward from a damaged save. */ }
  const unlocked = finds.includes('moon');
  return { unlocked, night: unlocked };
}
