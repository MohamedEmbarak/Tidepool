'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { audio } from './audio';
import { CREATURE_NAMES, pick, type RewardTier } from './reward';

/**
 * The one piece of genuinely global state: what the user has found, and
 * whether sound is on.
 *
 * "Finds" are the collectible layer. They exist to convert a variable-ratio
 * payout into something that *persists* on screen — an unpredictable reward
 * that leaves no trace is just noise, whereas a jar that fills gives the
 * intermittent schedule a visible accumulator to feed. The jar is
 * deliberately uncapped: there is no completion state to chase, no streak to
 * break, and nothing is ever lost. Loss aversion is the mechanic this
 * project most wants to avoid.
 */

export type Find = {
  id: number;
  name: string;
  /** 0..1 depth at which it was found — the jar shows where, not just how many. */
  depth: number;
};

type PlaygroundState = {
  finds: Find[];
  soundOn: boolean;
  toggleSound: () => void;
  /**
   * Report an interaction. Scenes call this instead of touching audio or
   * find-state directly, so the reward policy lives in exactly one place.
   */
  reward: (tier: RewardTier, intensity: number, depth: number) => void;
};

const Ctx = createContext<PlaygroundState | null>(null);

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const [finds, setFinds] = useState<Find[]>([]);
  const [soundOn, setSoundOn] = useState(false);
  const nextId = useRef(1);

  const toggleSound = useCallback(() => {
    setSoundOn((on) => {
      const next = !on;
      // enable() must run inside the gesture that produced this click.
      if (next) void audio.enable();
      else audio.disable();
      return next;
    });
  }, []);

  const reward = useCallback(
    (tier: RewardTier, intensity: number, depth: number) => {
      audio.pluck(intensity, tier);

      if (tier !== 'rare') return;

      setFinds((prev) => [
        ...prev,
        { id: nextId.current++, name: pick(CREATURE_NAMES), depth },
      ]);
    },
    [],
  );

  const value = useMemo(
    () => ({ finds, soundOn, toggleSound, reward }),
    [finds, soundOn, toggleSound, reward],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlayground(): PlaygroundState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('usePlayground must be used inside <PlaygroundProvider>');
  }
  return ctx;
}
