# Tidepool

An interactive descent through water — a playground built to be scrolled,
poked, dragged, and fidgeted with, on a phone or a desktop.

Four depths, four tactile grammars: **push** buoyant floats, **squeeze**
soft-body jellies, **brush** a kelp forest apart, and **search** the dark for
things that only show themselves when you get close.

> Design rationale, the section-by-section wireframe, and the mapping from each
> interface decision to the psychology behind it live in **[DESIGN.md](./DESIGN.md)**.

## Run it

Requires **Node 20+** (Next.js 15).

```bash
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
npm run typecheck            # tsc --noEmit
```

If you run more than one Node version manager, confirm `node -v` reports 20 or
newer before reporting a build problem — Next.js 15 rejects anything older.

### Static export

The app has no server surface, so it exports to plain static files:

```bash
GITHUB_PAGES=true npm run build   # emits ./out
```

This is what the Pages workflow runs. The env var also applies the
`/Tidepool` base path required by a GitHub project site.

## What's where

```
src/
  app/
    layout.tsx        root layout, metadata, viewport
    page.tsx          the descent — GSAP ScrollTrigger, section shell
    globals.css       design system; --depth drives the ambient gradient
  components/
    Cursor.tsx        split cursor: exact dot + spring ring, magnetic snap
    Hud.tsx           depth gauge, sound toggle, find jar
  lib/
    reward.ts         variable-ratio schedule + pity counter, math helpers
    audio.ts          Web Audio pentatonic synth, muted by default
    store.tsx         playground context: finds + sound
    hooks.ts          reduced-motion, fine-pointer, in-view, gyroscope
  scenes/
    SurfaceScene.tsx  R3F + Rapier — buoyant floats, self-restoring field
    DriftScene.tsx    Matter.js — soft-body jellies, multi-touch fling
    KelpScene.tsx     Verlet strands — part on contact, gyroscope tilt
    DeepScene.tsx     particles — motes, bursts, reveal-on-approach sleepers
```

## Stack

Next.js 15 · React 19 · TypeScript · React Three Fiber v9 + @react-three/rapier
· Matter.js · GSAP ScrollTrigger · Framer Motion · Web Audio API.

No network calls, no storage, no accounts, no analytics.

## Notes

- **Sound is muted by default** — toggle it top-right. Pentatonic only, so no
  combination of taps can sound wrong.
- **`prefers-reduced-motion` is fully honoured**: physics loops idle and the
  custom cursor does not mount.
- **`reactStrictMode` is deliberately off** — R3F v9 loses its WebGL context
  under React 19's dev-only double-mount. Reasoning is in `next.config.mjs`.
- **Frame rate has not been benchmarked on real hardware.** The rendering and
  scheduling work described in `DESIGN.md` is done, but no trustworthy FPS
  measurement has been taken yet. Worth a pass on a mid-range Android device.

## Licence

[MIT](./LICENSE)
