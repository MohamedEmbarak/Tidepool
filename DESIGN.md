# TIDEPOOL — an interactive descent

Deliverables 1–3: the artistic vision, the page architecture, and the mapping
from interface decisions back to the psychology that motivated them.
Deliverable 4 (the working prototype) is the code in `src/`.

---

## 1. Core concept & theme

**Tidepool is a descent through water, from bright surface to black deep, made
entirely of things that respond to being touched.**

Scrolling is falling. The page has one axis and one verb: you go down, and the
water changes around you. Four depths, each with a different tactile grammar —
push, squeeze, brush, and search — arranged so the interaction gets quieter and
more attentive as the light fails.

Three commitments shape every decision:

**Nothing can be broken.** There is no score, no timer, no streak, no fail
state, and nothing that can be lost. This is load-bearing, not decorative — the
physics contains a hard "nothing escapes" invariant precisely because a toy that
can be emptied stops being safe to play with. Loss aversion is the single
mechanic this project most deliberately refuses.

**Every input is answered.** Every tap, drag, and hover produces something. The
variable-reward schedule governs how *ornate* the answer is, never *whether*
there is one. This is the difference between an intermittent reward and a slot
machine: the floor is a guaranteed response, and the variance sits above it.

**The descent is the reward.** Depth is legible at all times — colour, sound,
and a gauge all track it — so there is always a reason to keep going that has
nothing to do with collecting anything.

### Why water

Water gives, for free, four things that would otherwise have to be invented:
buoyancy (motion that is slow and forgiving), drag (input that never feels
twitchy), bioluminescence (a light source that is *caused by the user*, so glow
reads as "you did that"), and darkness that deepens with depth, which supplies a
built-in curiosity gradient. The final section is nearly black not for drama but
because a dark room is the cheapest way to make a person lean in.

### Palette

| Depth | Colour | Role |
|---|---|---|
| Surface | `#7fe3d4` → `#3aa7c9` | Bright, warm, welcoming. Onboarding. |
| Drift | `#6f7fe0` → `#3b3f8f` | Cooler, softer. Attention narrows. |
| Kelp | `#2c7a6b` → `#16323f` | Green-black. Quiet, enclosed. |
| Deep | `#05070f` | Near-black. Only user-made light. |

A single CSS custom property `--depth` (0 → 1) is written by one GSAP
ScrollTrigger and drives the whole document's ambient gradient via `color-mix`,
so the recolouring is continuous rather than a set of four hard cuts.

**Bioluminescent cyan `#8ffff0` is reserved.** It is only ever used for things
the user caused. Nothing in the ambient scenery is allowed to use it, so the eye
learns within seconds that cyan means *agency*.

---

## 2. Page architecture & wireframe

```
┌──────────────────────────────────────────────────────────┐
│  ◐ sound   ⬡ jar(n)                        ← fixed HUD   │
│                                                          │
│  ●  SURFACE          0 m · SURFACE                       │
│  │                   Everything here is touchable.       │
│  │  ← depth gauge    Push the floats…                    │
│  │     (desktop)     ↓ scroll to descend                 │
│  ○  DRIFT                                                │
│  │        ◯    ◯      ◯     ← R3F + Rapier buoyant       │
│  ○  KELP     ◯    ◯           floats, pointer collider   │
│  │                                                       │
│  ○  DEEP                                                 │
└──────────────────────────────────────────────────────────┘
        ↓  115svh per section, overlapping cross-fade
┌──────────────────────────────────────────────────────────┐
│  400 m · DRIFT     Squeeze something soft.               │
│     ✿   ✿             ← Matter.js soft-body jellies,     │
│   ✿   ✿    ✿             10-node ring + hub, multi-touch │
└──────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────┐
│  800 m · KELP      Run your hand through it.             │
│  ║║║╬╬╬  ╬╬╬║║║       ← verlet strands, part on contact, │
│  ║║║║║║║║║║║║║║          gyroscope tilt on mobile        │
└──────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────┐
│  1200 m · DEEP     Something is down here.               │
│   ·   ·  ✳  ·   ·     ← motes + reveal-on-approach       │
│  ·   ·      ·  ·         sleepers + particle bursts      │
└──────────────────────────────────────────────────────────┘
```

Sections are `115svh` (the last is `130svh`) and **nothing is pinned or
snapped**. Scroll is never taken from the user.

### § 0 — Surface (`src/scenes/SurfaceScene.tsx`)

*Stack: React Three Fiber + @react-three/rapier*

| | |
|---|---|
| **Interaction** | The pointer is a kinematic sphere in the physics world. Floats are shoved by real contact, not by an impulse-at-a-point, so a drag feels continuous. |
| **Feedback** | Non-uniform scale on contact (squish), decaying exponentially back to round. Collision speed drives both squish depth and audio velocity. |
| **The trick** | Zero global gravity. Each float is sprung toward its own home position, so the field **always recomposes itself** after being scattered. |
| **Purpose** | The onboarding contract. Within ~2 seconds the user has learned that everything is touchable and nothing breaks. |

Robustness (all three added after a fast drag emptied the tank in testing):
the pointer's per-frame step is speed-capped so it cannot act as a railgun;
float velocity has a hard ceiling; anything that escapes the play box is
teleported back. CCD is on.

### § 1 — Drift (`src/scenes/DriftScene.tsx`)

*Stack: Matter.js → 2D canvas*

| | |
|---|---|
| **Interaction** | Grab, stretch, and fling jellies. Per-`pointerId` drag tracking, so two thumbs work independently — Matter's own `MouseConstraint` is single-pointer and was not used. |
| **Structure** | Each jelly is 10 circles in a ring, spoked to a hidden hub, plus a neighbour hoop. A genuine soft body. |
| **Why not fake it** | A single circle with a scale animation looks identical in a screenshot and feels dead in the hand. The **wobble after release** is the entire point, and only a real constraint network gives it to you. |
| **Feedback** | Ring glow charges on contact and decays; an expanding ripple at the exact touch coordinate, tinted by reward tier. |

### § 2 — Kelp (`src/scenes/KelpScene.tsx`)

*Stack: hand-written Verlet integration → 2D canvas*

| | |
|---|---|
| **Interaction** | Strands part around the pointer and close behind it. Multi-touch. On mobile, device tilt drives the current (`deviceorientation`, with the iOS 13+ permission prompt behind an explicit button). |
| **Why Verlet** | It is stable under absurd input. A user can scrub as fast as the digitiser reports and the strands stretch and recover rather than exploding. Robustness under abuse is what separates a toy from a demo. |
| **The ambient layer** | A travelling sine keeps the forest breathing at **~6 cycles/minute** — the resonant rate used in paced-breathing protocols. Users are never told it is there; it entrains or it doesn't. |

All forces are expressed as a fraction of segment length, so the simulation
behaves identically on a short mobile canvas and a tall desktop one.

### § 3 — Deep (`src/scenes/DeepScene.tsx`)

*Stack: bespoke particle system → 2D canvas*

Three layers, deliberately last:

1. **Motes** — plankton drift that repels from the pointer. Always responsive:
   touching the dark is never inert.
2. **Bursts** — particle explosions at the touch point, sized and coloured by
   reward tier.
3. **Sleepers** — shapes that are *invisible until approached*. You can see
   **that** something is there long before you can see **what**, and the only
   way to resolve it is to move closer. Tapping a woken sleeper is the only
   interaction in the piece that can roll a rare. Woken sleepers then relocate,
   so the field never becomes a solved map.

Measured in-browser: sleeper region luminance goes from **0.17 → 65.1** as the
pointer approaches. The reveal mechanic is verified, not assumed.

### Persistent HUD (`src/components/Hud.tsx`)

Exactly three controls, none of which ever blocks the playfield:

- **Depth gauge** (desktop only — hidden under 900px, where it collided with the
  copy). The only navigation affordance in the piece. There is no menu, because
  a menu invites goal-directed jumping and this is meant to be wandered.
- **Sound toggle** — muted by default.
- **The jar** — a running count of rare finds, with a toast when one lands.

### Cursor (`src/components/Cursor.tsx`)

A hard dot that tracks the pointer *exactly*, plus a ring that lags on a spring.
The split is the whole trick: the dot preserves 1:1 agency (lag reads as broken,
not playful), which frees the ring to be expressive. The ring is magnetically
pulled 55% toward the centre of any `[data-magnetic]` element — a Fitts's-law
cheat that also serves as a curiosity cue, because the ring visibly *notices*
things before the user has decided to click them.

---

## 3. Psychological justification mapping

| Principle | Implementation | Why this specific choice |
|---|---|---|
| **Variable reward** (Skinner) | `src/lib/reward.ts`. Three tiers: common ~82%, uncommon ~15%, rare ~3%. Every interaction rolls. | A variable *ratio* sustains engagement far longer than a fixed one. Crucially the schedule governs only reward **ornateness** — the floor is always a response. That is what makes it a toy rather than a slot machine. |
| ↳ **Frustration ceiling** | A pity counter guarantees a rare within 60 interactions. | A deliberate departure from a pure gambling curve. A persistent user must never be stonewalled by a bad streak; capping frustration matters more than the purity of the distribution. |
| ↳ **Reward persistence** | Rares become named creatures in the jar (`store.tsx`). | An unpredictable payout that leaves no trace is just noise. The jar gives the schedule a visible accumulator. It is uncapped, has no completion state, and nothing can ever be removed from it. |
| **Flow** (Csikszentmihalyi) | No pinning, no scroll-snap, no scroll-jacking, no modals, no cookie banner, no entry gate. | Every scroll-hijack trades the user's sense of control for the author's sense of choreography. In a piece whose whole claim is that it is calming, control is worth more. |
| ↳ **Challenge–skill balance** | Difficulty is flat and near-zero; complexity comes from *depth of response*, not from demand. | Flow needs challenge matched to skill. For an anxiety-regulating object the correct match is "trivially easy, infinitely explorable". |
| **Sensory delight** (Norman, visceral) | Squish on impact, ripples from exact touch coordinates, glow that charges and decays, particle bursts, spring-damped cursor. | Norman's visceral level responds to immediate physical plausibility. Feedback is always at the point of contact and always within one frame. |
| ↳ **Behavioural level** | The same gesture grammar in all four scenes: press, drag, release. Nothing to learn twice. | Consistency at the behavioural level is what lets attention drop to the visceral level, which is where the pleasure is. |
| ↳ **Reflective level** | Named creatures, depth in metres, a jar you can open and read. | The reflective level wants a story to tell afterwards. "I found a Glass Squid at 900 m" is a story; "I clicked 40 times" is not. |
| **Curiosity gap** (Loewenstein) | Sleepers in § 3 are invisible until approached. Magnetic cursor swells near interactive elements. Copy hints at mechanics without describing them ("some of them are alive"). | Loewenstein's information gap requires *awareness* of the missing information. Sleepers make the gap perceptible — you know something is there, you cannot tell what — which is exactly the condition that motivates approach. |
| ↳ **Resolution, then renewal** | Woken sleepers relocate after 1.4 s. | A solved map closes the gap permanently. Relocation reopens it without punishing the user for having solved it. |
| **Stress reduction / tactile grounding** | Soft-body jellies, elastic recovery everywhere, high damping, slow restitution. Fidget-object behaviour. | Repetitive, predictable, self-restoring tactile feedback is the mechanism shared by fidget tools: it occupies sensorimotor attention without demanding executive load. |
| ↳ **Paced breathing** | Kelp breathes at ~6 cycles/min (`Math.sin(t * 0.63)`). | ~0.1 Hz is the resonant frequency used in paced-breathing and HRV-biofeedback protocols. Offered as ambient entrainment, never as an instruction — being *told* to breathe is itself activating. |
| ↳ **Consonance-only audio** | Pentatonic scale, `src/lib/audio.ts`. | Every note in a pentatonic set is consonant with every other. A user mashing the screen **cannot produce a wrong chord**. The instrument is incapable of punishing them. |
| ↳ **Soft envelopes** | 12 ms attack, long release, low gain, 12-voice cap. | Percussive transients are startling. Nothing here has a sharp onset, and the voice cap prevents a pile-up from becoming a wall of noise. |
| **Agency & safety** | Sound muted by default. Gyroscope behind an explicit button. Zoom left enabled. No account, no storage, no network calls. | Unrequested sound and unrequested motion are the two fastest ways to make a playground feel hostile. Consent precedes every sensory escalation. |
| ↳ **No loss aversion** | Nothing decays, expires, resets, or can be dropped. The footer says so plainly. | Loss aversion is the most powerful engagement lever available and the most corrosive to a calming object. It is refused on purpose. |

### Where the psychology changed the code

Three cases where a principle overrode the obvious implementation:

1. **Buoyancy was removed.** Physically correct upward gravity piles every float
   against the ceiling within seconds, leaving an empty tank. "Nothing can be
   broken" demanded a self-restoring field, so each float is sprung to its own
   home instead.
2. **The cursor was split in two.** A single spring-lagged cursor looks better in
   isolation and destroys the sense of agency. Splitting it preserves 1:1
   tracking *and* expressiveness.
3. **The pity counter exists.** It makes the reward distribution less "pure",
   and it is there because a frustrated user is a worse outcome than a
   statistically inelegant one.

---

## 4. Accessibility & performance notes

**Reduced motion** is honoured in JS, not only CSS: every physics loop returns
early and the custom cursor does not mount when `prefers-reduced-motion: reduce`
is set. Scenes render their static state rather than freezing mid-motion.

**Keyboard & screen readers**: all copy is real text in semantic `<section>`
elements with `aria-label`s. Canvases are `aria-hidden` — they are toys, not
content, and nothing is hidden behind them. HUD controls are real `<button>`s
with `aria-pressed` / `aria-expanded` and visible focus rings. Pinch-zoom is not
disabled.

**Contrast**: a radial scrim sits behind every copy block, so a float drifting
behind the text cannot drop it below the legibility floor. Playfield and text
coexist without walling off part of the toy.

**Performance strategy**:

- Only the section under the viewport runs. Off-screen scenes have their physics
  paused and the R3F canvas drops to `frameloop="demand"` — zero GPU cost.
- Scenes are `next/dynamic` with `ssr: false`; three.js and Rapier stay out of
  the first load. **First Load JS is 196 kB** for `/`.
- `transmission` was removed from the float material: real refraction costs one
  extra full-scene pass *per transmissive mesh*, which reset the GPU on
  integrated graphics. Alpha + clearcoat reads as wet glass for a fraction of
  the cost.
- Body counts scale down on small screens; DPR capped at 1.5.
- 2D scenes write only to canvas; the cursor writes only `transform`.

**Measured**: production build passes, `tsc --noEmit` clean, CLS 0.00.

**Not measured — read this before trusting the 60 FPS target.** All four scenes
were verified to render and respond correctly, and the optimisations above are
sound, but **no trustworthy frame-rate measurement has been taken.** Benchmarks
gathered in a background or occluded browser window are worthless: Chrome
throttles `requestAnimationFrame` and `setTimeout` to roughly 1 Hz there, so any
number collected that way understates real performance by two orders of
magnitude. Measure in a normal foreground window with the DevTools FPS meter,
particularly on a mid-range Android device.

---

## 5. Known gaps

- FPS unverified, as above.
- Gyroscope tilt is implemented and permission-gated but has not been run on a
  physical iOS or Android device; only the desktop no-sensor path was exercised.
- `reactStrictMode` is off. React 19 StrictMode double-invokes effects in dev,
  and R3F v9 responds by disposing the renderer and calling `forceContextLoss()`
  on a canvas it then reuses — a permanently lost context that paints the
  section opaque white. Dev-only; production is identical either way. See the
  comment in `next.config.mjs`.
- Pinch-to-zoom and double-tap-morph gestures from the brief are not
  implemented; the multi-touch work went into independent per-finger dragging
  instead, which suited these particular toys better.
