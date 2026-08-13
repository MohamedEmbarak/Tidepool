'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { usePlayground } from '@/lib/store';

/**
 * The persistent HUD: a depth gauge, a sound toggle, and the find jar.
 *
 * Deliberately minimal. A playground that surrounds itself with chrome stops
 * reading as a playground, so there are exactly three controls and none of
 * them ever blocks the playfield. The depth readout doubles as the only
 * navigation affordance in the piece — there is no menu, because a menu
 * would invite goal-directed jumping and this is meant to be wandered.
 */

const DEPTHS = [
  { label: 'Surface', at: 0 },
  { label: 'Drift', at: 0.33 },
  { label: 'Kelp', at: 0.66 },
  { label: 'Deep', at: 1 },
];

export function Hud({ depth }: { depth: number }) {
  const { finds, soundOn, toggleSound } = usePlayground();
  const [jarOpen, setJarOpen] = useState(false);
  const [flash, setFlash] = useState(false);

  // Pulse the jar whenever a find lands, so a rare payout is legible even if
  // the user was looking at the other side of the screen when it happened.
  useEffect(() => {
    if (finds.length === 0) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), 900);
    return () => clearTimeout(t);
  }, [finds.length]);

  const metres = Math.round(depth * 1200);
  const latest = finds[finds.length - 1];

  return (
    <>
      {/* ---- depth gauge, left edge ---- */}
      <div className="hud hud--depth" aria-hidden="true">
        <div
          style={{
            width: 2,
            height: '38vh',
            background: 'rgba(234,246,255,0.14)',
            position: 'relative',
            borderRadius: 2,
          }}
        >
          <motion.div
            style={{
              position: 'absolute',
              left: -3,
              width: 8,
              height: 8,
              borderRadius: 999,
              background: 'var(--glow)',
              boxShadow: '0 0 10px var(--glow)',
            }}
            animate={{ top: `${depth * 100}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          />
          {DEPTHS.map((d) => (
            <span
              key={d.label}
              style={{
                position: 'absolute',
                top: `${d.at * 100}%`,
                left: 12,
                fontSize: '0.6rem',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                transform: 'translateY(-50%)',
                color:
                  Math.abs(depth - d.at) < 0.16
                    ? 'var(--glow)'
                    : 'var(--ink-faint)',
                transition: 'color 420ms ease',
              }}
            >
              {d.label}
            </span>
          ))}
        </div>
        <span
          style={{
            fontSize: '0.65rem',
            color: 'var(--ink-faint)',
            writingMode: 'vertical-rl',
            letterSpacing: '0.2em',
          }}
        >
          {metres} m
        </span>
      </div>

      {/* ---- tools: top right on desktop, thumb corner on phones ---- */}
      <div className="hud hud--tools">
        <button
          type="button"
          className="hud-btn"
          data-magnetic
          onClick={toggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
          title={soundOn ? 'Mute' : 'Unmute'}
        >
          <SoundIcon on={soundOn} />
        </button>

        <button
          type="button"
          className="hud-btn"
          data-magnetic
          onClick={() => setJarOpen((v) => !v)}
          aria-expanded={jarOpen}
          aria-label={`Your jar — ${finds.length} found`}
          title="Your jar"
          style={{
            borderColor: flash ? 'var(--glow-rare)' : undefined,
            transform: flash ? 'scale(1.15)' : undefined,
            width: 'auto',
            minWidth: '2.75rem',
            padding: '0 0.85rem',
            gap: '0.4rem',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <JarIcon />
          <span style={{ fontSize: '0.8rem' }}>{finds.length}</span>
        </button>
      </div>

      {/* ---- toast when a rare lands ---- */}
      <AnimatePresence>
        {flash && latest && (
          <motion.div
            key={latest.id}
            initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="hud-pop hud-pop--toast"
          >
            <span style={{ color: 'var(--glow-rare)' }}>found</span>{' '}
            {latest.name}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- jar contents ---- */}
      <AnimatePresence>
        {jarOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="hud-pop hud-pop--jar"
          >
            <p className="eyebrow" style={{ margin: '0 0 0.75rem' }}>
              Your jar
            </p>
            {finds.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  fontSize: '0.82rem',
                  color: 'var(--ink-dim)',
                  lineHeight: 1.6,
                }}
              >
                Empty for now. Keep touching things — some of them are alive,
                and they don&rsquo;t surface on a schedule.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {finds
                  .slice()
                  .reverse()
                  .map((f) => (
                    <li
                      key={f.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '1rem',
                        padding: '0.45rem 0',
                        borderBottom: '1px solid rgba(234,246,255,0.07)',
                        fontSize: '0.82rem',
                      }}
                    >
                      <span>{f.name}</span>
                      <span style={{ color: 'var(--ink-faint)' }}>
                        {Math.round(f.depth * 1200)} m
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function SoundIcon({ on }: { on: boolean }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 9v6h4l5 4V5L8 9H4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {on ? (
        <>
          <path
            d="M16.5 8.5a5 5 0 010 7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M19 6a8.5 8.5 0 010 12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M17 10l4 4m0-4l-4 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function JarIcon() {
  return (
    <svg width="15" height="17" viewBox="0 0 24 28" fill="none" aria-hidden>
      <path
        d="M8 2h8v3l2 3v16a2 2 0 01-2 2H8a2 2 0 01-2-2V8l2-3V2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="17" r="2.6" fill="var(--glow)" opacity="0.85" />
    </svg>
  );
}
