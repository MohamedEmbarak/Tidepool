# Tidepool

A single-canvas underwater expedition. Wheel, swipe, keyboard, and the depth controls move a camera through one persistent Three.js world. The document never scrolls and habitats never remount.

## Explore

- Scroll or swipe upward to descend; reverse to ascend. Arrow keys, Page Up/Down, Home/End, the slider, and location buttons also navigate.
- Touch physical objects to discover them. Open the clam before taking its pearl, part the fronds around the key, and investigate the wreck and ruins.
- Drag jellyfish and watch them drift home.
- Six unique objects have their own models, locations, clues, and stories. The final fragment requires the other five and awakens the starwhale.
- Open the field journal for saved discoveries and clues. Finds persist in localStorage on the current browser/device. Storage failure does not prevent exploration.
- Tab to nearby discoveries for keyboard interaction; Escape closes the journal. Sound is off initially; reduced-motion preferences disable ambient movement and camera easing.

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
- `src/world/models.ts`: procedural relics, habitat geometry, plants, creatures, and shared materials.
- `src/world/catalog.ts`: discovery definitions, collection prerequisites, save validation, bounded camera motion.
- `src/lib/audio.ts`: browser-generated discovery sounds.

No physics engines, external models, textures, fonts, or audio downloads are needed. Geometry is built once. Off-camera objects are culled; canvas DPR is capped at 1.5 and frames at 60 Hz. Opening the journal or hiding the tab suspends the render loop. React receives only changed navigation/discovery state, at most ten times a second. Teardown removes events and disposes GPU resources.

## GitHub Pages

Pushes to `main` run `.github/workflows/deploy.yml` (the workflow name is **Deploy to GitHub Pages**). The build uses `GITHUB_PAGES=true` to export `out/` with the `/Tidepool` base path. To reproduce in PowerShell:

```powershell
$env:GITHUB_PAGES='true'
npm run build
```

The collection tests cover locked containers, the final prerequisite, duplicate prevention, malformed saves, and repeated camera reversals. Browser verification covers physical raycasts, touch swipes, save restoration, journal keyboard handling, and one-canvas/no-document-scroll invariants.
