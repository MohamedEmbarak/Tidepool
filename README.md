# Tidepool

A full 3D underwater expedition in one canvas. Wheel, swipe, keyboard, and the depth controls move a camera through one persistent Three.js world. The document never scrolls and habitats never remount.

## Explore

- Scroll or swipe upward to descend; reverse to ascend. Up/down keys, Page Up/Down, Home/End, the slider, and location buttons also navigate. Drag horizontally to orbit the habitat through 360 degrees; left/right keys or Shift+wheel also orbit.
- Touch physical objects to discover them. Open the hinged scallop, part the fronds around the key, hold the golden fish until it spits out amber, open the chest, and fracture the arch with three touches to reveal a sigil. Release and then touch a revealed object to collect it.
- Brush plants, hover over fish, or tap rocks to bend leaves, scatter schools, and lift sediment. Drag fish and jellyfish and watch them drift home. Pinch to zoom, use two fingers to pan, and hold an object for its clue. Quick swipes carry momentum; double-tapping open water or the centre-view control resets the framing.
- Nine unique objects have their own models, locations, clues, and stories. Each keeps its depth, with horizontal positions randomized in both world axes and saved for the expedition. The final fragment requires the other eight and awakens the starwhale, gathers fish, and releases a burst of light.
- Eight animated bands of generated calligraphy surround the moon at one shared centre. Each prerequisite discovery breaks its matching seal; all seals must dissolve before the moon can be collected.
- The completion card and field journal offer **Start a new expedition**: this clears the saved finds, reshuffles the hiding places, closes the containers, and returns to the surface without rebuilding the canvas.
- Open the field journal for saved discoveries and clues. Finds persist in localStorage on the current browser/device. Storage failure does not prevent exploration.
- Tab to nearby discoveries for keyboard interaction; Escape closes the journal. Sound is off initially. Enable the original ocean score and adjust its volume with the sound control. Reduced-motion preferences disable ambient movement, momentum, and camera easing.

## Develop

Requires Node 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
npm start
```

Stop the development server before building; both use `.next`.

## Architecture

- `src/components/Expedition.tsx`: accessible overlay, field journal, persistence, sound, engine lifecycle.
- `src/world/engine.ts`: one renderer, scene, camera, animation loop, raycasting and input.
- `src/world/models.ts`: relics, shells, ruins, jellyfish, and shared materials.
- `src/world/camera.ts`: perspective projection, full orbit, responsive framing, and pan/zoom.
- `src/world/habitat.ts`: one continuous ocean floor beneath the deepest camera stop, eroded limestone, instanced gravel, ribbon kelp, seagrass, sea fans, and reactive materials. All rocks and rooted vegetation sit on this deepest seabed; the upper water contains creatures and discoveries.
- `src/world/schools.ts`: 216 fish in instanced schools, swimming deformation, local avoidance, and reset.
- `src/world/seals.ts`: one instanced rune display, a shared 128 KB inscription atlas, and reusable shatter state.
- `src/world/containers.ts` and `src/world/discoveries.ts`: chest, arch, and container interaction rules.
- `src/world/resources.ts`: drawing-buffer limits for high-density and lower-memory devices.
- `src/world/effects.ts`: spatial light shafts, bubbles, sediment, and pooled celebration particles.
- `src/world/assets.ts`: GLB loading, animated creature placement, and resource disposal.
- `src/world/gestures.ts`: pointer ownership, multi-touch transitions, tap/hold/drag recognition and velocity.
- `src/world/catalog.ts`: discovery definitions, collection prerequisites, save validation, bounded camera motion.
- `src/lib/audio.ts` and `src/lib/score.ts`: musical arrangement, synthesized instruments, scheduling, effects, and discovery cues.

Six CC0 models from Quaternius and Kenney are bundled locally (under 1 MB combined); see [ASSETS.md](ASSETS.md) for sources, licenses, and conversion instructions. There are no runtime marketplace, font, or music downloads. Geometry is built once. The dense schools share three geometries across 18 batches; only nearby bands render, and reset reuses their buffers. Off-camera creatures stop animating; canvas DPR is capped at 1.5, with at most two million drawing-buffer pixels (one million and DPR 1 on devices reporting 4 GB of memory or less) and frames at 60 Hz. Opening the journal or hiding the tab suspends the render loop. React receives only changed navigation/discovery state, at most ten times a second. Teardown removes events and disposes GPU resources. Music uses a bounded look-ahead scheduler, pauses in hidden tabs, and reuses one audio context across sound toggles.

## GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml` (the workflow name is **Deploy to GitHub Pages**). The build uses `GITHUB_PAGES=true` to export `out/` with the `/Tidepool` base path. To reproduce in PowerShell:

```powershell
$env:GITHUB_PAGES='true'
npm run build
```

Tests cover deterministic layouts and safe placement bounds, dense school reactions and buffer reuse, 360-degree perspective framing, collection prerequisites and persistence, camera bounds, gesture cancellation and finger transitions, the musical arrangement, animated-model scale and motion, and the model size budget. Browser verification covers physical collection of all nine randomized finds, celebration and reset, persistence across reloads, repeated round trips and resets, pinch/pan/swipe/hold/drag/orbit gestures, sound and volume controls, hidden-tab suspension, saved discoveries, journal keyboard handling, and one-canvas/no-document-scroll invariants. A 32-second offline audio render checks the actual voice synthesis for finite, non-clipping output.

Existing expedition seeds keep the original hiding places. The five earlier prerequisite finds remain saved when upgrading a completed six-item expedition; the final moon is sealed again until the three new treasures have been discovered.

Browser memory checks instrument GPU allocations and collect heap measurements after warmup, repeated reveal/reset cycles, and full retry. A retry replaces the canvas and releases its old WebGL context; ordinary expedition resets preserve the existing canvas and buffers.
