'use client';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { audio } from '@/lib/audio';
import { LAYOUT_KEY, MAX_DEPTH, readFinds, readSeed, RELICS, SAVE_KEY, ZONES, type RelicId } from '@/world/catalog';
import type { DiveEngine, DiveState } from '@/world/engine';
import { RelicIcon } from './RelicIcon';
const INITIAL: DiveState = { depth: 0, zoom: 1, angle: 0, fishCount: 219, nearby: [], opened: [], hovered: null, complete: false };

function freshSeed(previous: number | null) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return seed === previous ? (seed ^ 0x9e3779b9) >>> 0 : seed;
}

export default function Expedition() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<DiveEngine | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const collectionRef = useRef<HTMLButtonElement>(null);
  const foundRef = useRef<RelicId[]>([]);
  const seedRef = useRef(0);
  const [celebrating, setCelebrating] = useState(false);
  const [found, setFound] = useState<RelicId[]>([]);
  const [dive, setDive] = useState(INITIAL);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sound, setSound] = useState(false);
  const [soundPending, setSoundPending] = useState(false);
  const [volume, setVolume] = useState(55);
  const [journal, setJournal] = useState(false);
  const [selected, setSelected] = useState<RelicId | null>(null);
  const [message, setMessage] = useState('');
  const [latest, setLatest] = useState<RelicId | null>(null);
  const [saved, setSaved] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => { setMessage(''); setLatest(null); }, 6000);
  }, []);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    try {
      foundRef.current = readFinds(localStorage.getItem(SAVE_KEY));
      seedRef.current = readSeed(localStorage.getItem(LAYOUT_KEY)) ?? freshSeed(null);
      localStorage.setItem(LAYOUT_KEY, String(seedRef.current));
    } catch { seedRef.current = freshSeed(null); setSaved(false); }
    setCelebrating(foundRef.current.length === RELICS.length);
    setFound(foundRef.current);
    const start = async () => {
      setReady(false); setFailed(false);
      try {
        const { createDive } = await import('@/world/engine');
        if (!alive || !canvasRef.current) return;
        const engine = await createDive(canvasRef.current, {
          found: foundRef.current, seed: seedRef.current, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
          onState: setDive, onHint: announce, onError: () => setFailed(true),
          onCollect: (id) => {
            if (foundRef.current.includes(id)) return;
            const next = [...foundRef.current, id]; foundRef.current = next; setFound(next); setLatest(id);
            try { localStorage.setItem(SAVE_KEY, JSON.stringify(next)); } catch { setSaved(false); }
            audio.pluck(0.65, 'rare');
            if (id === 'moon') setCelebrating(true);
            announce(id === 'moon' ? 'The song is whole. Look up—the starwhale has returned.' : `${RELICS.find((r) => r.id === id)!.name} · added to your field journal`);
          },
        }, controller.signal);
        if (!alive) { engine.dispose(); return; }
        engineRef.current = engine;
        engine.setPaused(Boolean(dialogRef.current?.open));
        setReady(true);
      } catch { if (alive) setFailed(true); }
    };
    void start();
    return () => { alive = false; controller.abort(); engineRef.current?.dispose(); engineRef.current = null; if (messageTimer.current) clearTimeout(messageTimer.current); };
  }, [announce, attempt]);
  useEffect(() => {
    engineRef.current?.setPaused(journal);
    if (journal) dialogRef.current?.showModal();
    else if (dialogRef.current?.open) { dialogRef.current.close(); collectionRef.current?.focus(); }
  }, [journal]);
  useEffect(() => { audio.setDepth(dive.depth / MAX_DEPTH, dive.complete); }, [dive.depth, dive.complete]);
  useEffect(() => {
    const visibility = () => audio.setSuspended(document.hidden);
    document.addEventListener('visibilitychange', visibility); visibility();
    return () => { document.removeEventListener('visibilitychange', visibility); audio.dispose(); };
  }, []);
  const toggleSound = async () => {
    if (soundPending) return;
    setSoundPending(true);
    if (sound) { audio.disable(); setSound(false); }
    else {
      try { await audio.enable(); setSound(audio.enabled); if (audio.enabled) audio.pluck(0.25); }
      catch { announce('Sound could not start. Tap the sound button to try again.'); }
    }
    setSoundPending(false);
  };
  const resetExpedition = () => {
    if (!engineRef.current) return;
    const seed = freshSeed(seedRef.current); seedRef.current = seed;
    foundRef.current = []; setFound([]); setSelected(null); setLatest(null); setCelebrating(false); setJournal(false);
    try { localStorage.setItem(SAVE_KEY, '[]'); localStorage.setItem(LAYOUT_KEY, String(seed)); setSaved(true); } catch { setSaved(false); }
    engineRef.current.reset(seed); setDive(INITIAL); audio.setDepth(0, false);
    announce('A new expedition. Six discoveries, six new hiding places.');
  };
  const zoneIndex = Math.min(3, Math.floor(dive.depth / 30)); const zone = ZONES[zoneIndex];
  const entry = RELICS.find((r) => r.id === selected);
  const jump = (depth: number) => engineRef.current?.goTo(depth);
  const complete = found.length === RELICS.length;
  return <main className="expedition" data-ready={ready} data-depth={dive.depth} data-zoom={dive.zoom} data-angle={dive.angle} data-fish-count={dive.fishCount}>
    <canvas ref={canvasRef} className="ocean-canvas" tabIndex={0} aria-label="Tidepool underwater world. Scroll or swipe vertically to dive. Drag horizontally to orbit the 3D scene. Pinch to zoom, two fingers to pan, hold an object to inspect, tap to collect. Up and down keys change depth; left and right orbit; 0 centres the view. Tab to explore nearby objects." />
    {!ready && !failed && <div className="loading-world"><span className="loading-orbit"/><p>Finding the current…</p></div>}
    {failed && <div className="world-error"><p className="eyebrow">The current was interrupted</p><h1>Let’s find our way back.</h1><p>The underwater view could not start. Your collected objects are kept on this device.</p><button onClick={() => setAttempt((n) => n + 1)}>Try again</button></div>}
    <header className="expedition-header">
      <a className="wordmark" href="#" onClick={(e) => { e.preventDefault(); jump(0); }} aria-label="Tidepool, return to surface"><svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><circle cx="20" cy="20" r="17"/><path d="M4 20q8-8 16 0t16 0M8 27q6-6 12 0t12 0M20 5v7"/></svg><span>tidepool<span className="brand-subtitle">A small expedition</span></span></a>
      <div className="expedition-tools">
        <button disabled={soundPending} className="sound-button" onClick={() => void toggleSound()} aria-label={sound ? 'Mute sound' : 'Enable sound'} aria-pressed={sound} title={sound ? 'Mute the ocean score' : 'Play the ocean score'}><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z"/>{sound ? <path d="M16 8a6 6 0 010 8m3-11a10 10 0 010 14"/> : <path d="m17 9 5 6m0-6-5 6"/>}</svg></button>
        <button ref={collectionRef} className="journal-button" onClick={() => setJournal(true)} aria-haspopup="dialog"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 3h10v4l2 3v9q0 2-2 2H7q-2 0-2-2v-9l2-3V3zM7 7h10"/><path d="m12 11 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z"/></svg><span className="journal-label">Field journal</span><span className="journal-count">{String(found.length).padStart(2, '0')}<span> / 06</span></span></button>
        {sound && <label className="music-volume"><span>Ocean score</span><input type="range" min="0" max="100" value={volume} aria-label="Music volume" onChange={e => { const value = Number(e.target.value); setVolume(value); audio.setVolume(value / 100); }}/></label>}
      </div>
    </header>
    <div className="habitat-caption" key={zoneIndex}><p className="eyebrow"><span className="status-dot"/>{String(zoneIndex + 1).padStart(2, '0')} / {zone.name}</p><h1>{complete && zoneIndex === 3 ? 'The ocean remembers.' : zone.title}</h1><p className="habitat-description">{complete && zoneIndex === 3 ? 'Six small discoveries. One very old friend. Stay a while.' : zone.description}</p></div>
    <nav className="depth-nav" aria-label="Dive locations">{ZONES.map((z, i) => <button key={z.name} className={zoneIndex === i ? 'active' : ''} onClick={() => jump(z.at)} aria-label={`Dive to ${z.short}, ${z.at * 10} metres`} aria-current={zoneIndex === i ? 'location' : undefined}><span>{z.short}</span><i/></button>)}<div className="nav-line" aria-hidden="true"><span style={{ height: `${dive.depth / MAX_DEPTH * 100}%` }}/></div></nav>
    <div className="focus-discoveries" aria-label="Nearby discoveries">{dive.nearby.map((id) => <button key={id} onClick={() => engineRef.current?.activate(id)}>{id === 'pearl' && !dive.opened.includes(id) ? 'Open the shell' : id === 'key' && !dive.opened.includes(id) ? 'Part the fronds' : `Collect ${RELICS.find((r) => r.id === id)!.name}`}</button>)}</div>
    {dive.hovered && !journal && <div className="object-label" aria-hidden="true"><span>◇</span> {dive.hovered}</div>}
    <div className={`find-notice ${message && !celebrating ? 'visible' : ''}`} role="status" aria-live="polite">{latest && <RelicIcon id={latest}/>}<span>{message}</span>{latest && <button onClick={() => { setSelected(latest); setJournal(true); }}>View find <span aria-hidden="true">↗</span></button>}</div>
    {celebrating && !journal && <section className="completion-card" aria-labelledby="completion-title" aria-live="polite"><div className="completion-seal" aria-hidden="true">{RELICS.map(r => <RelicIcon key={r.id} id={r.id}/>)}</div><p className="eyebrow">06 / 06 · Expedition complete</p><h2 id="completion-title">The ocean sings again.</h2><p>You found every memory. The fish gather, the water glows, and an old friend returns.</p><div className="completion-actions"><button onClick={() => setCelebrating(false)}>Keep exploring</button><button onClick={resetExpedition}>Start a new expedition</button></div><small>A new expedition clears your journal and reshuffles the objects.</small></section>}
    <footer className="dive-console">
      <div className="depth-readout"><span className="eyebrow">Below the surface</span><div><span>{String(Math.round(dive.depth * 10)).padStart(4, '0')}</span><small>m</small></div></div>
      <div className="dive-input"><label htmlFor="depth-range" className="sr-only">Dive depth in metres</label><input id="depth-range" aria-valuetext={`${Math.round(dive.depth * 10)} metres, ${zone.short}`} type="range" min="0" max="1200" step="1" value={Math.round(dive.depth * 10)} onChange={(e) => jump(Number(e.target.value) / 10)}/><p><span className="desktop-instruction">Scroll to dive · drag to orbit</span><span className="touch-instruction">Swipe to dive · sideways to orbit</span></p></div>
      <div className="depth-buttons"><button onClick={() => engineRef.current?.resetView()} aria-label="Reset zoom and centre view" title="Centre view">&#8982;</button><button onClick={() => jump(dive.depth - 9)} aria-label="Ascend" disabled={dive.depth < 0.1}>↑</button><button onClick={() => jump(dive.depth + 9)} aria-label="Descend" disabled={dive.depth > 119.9}>↓</button></div>
      <details className="explore-help"><summary>How to explore <span aria-hidden="true">?</span></summary><div><p className="eyebrow">Follow your curiosity</p><dl><dt>Swipe up / down</dt><dd>Dive through the water</dd><dt>Drag sideways</dt><dd>Orbit the full 3D habitat</dd><dt>Tap an object</dt><dd>Open it or add it to your journal</dd><dt>Hold an object</dt><dd>Read its clue</dd><dt>Touch fish / plants / rocks</dt><dd>Scatter, sway, and stir the sand</dd><dt>Drag a creature</dt><dd>Play with the current</dd><dt>Pinch / two fingers</dt><dd>Zoom in / pan around</dd><dt>Double-tap open water</dt><dd>Centre the view</dd></dl><p>Keyboard: up/down to dive, left/right to orbit, Tab to discover, 0 to centre.</p></div></details>
    </footer>
    <dialog ref={dialogRef} className="field-journal" aria-labelledby="journal-title" onCancel={() => setJournal(false)} onClose={() => setJournal(false)}>
      <div className="journal-heading"><div><p className="eyebrow">The things we carry</p><h2 id="journal-title">Field journal</h2></div><button className="close-journal" onClick={() => setJournal(false)} aria-label="Close field journal">×</button></div>
      <p className="journal-intro">Every object has a place in the ocean.<br/>Every place has a story.</p>
      <div className="journal-progress"><span>{found.length} of 6 discoveries</span><span>{complete ? 'A song, remembered' : 'An unfinished song'}</span></div>
      <div className="relic-grid">{RELICS.map((r, i) => <button key={r.id} className={`relic-slot ${found.includes(r.id) ? 'collected' : ''} ${selected === r.id ? 'selected' : ''}`} style={{ '--relic-color': r.color } as CSSProperties} onClick={() => setSelected(r.id)} aria-pressed={selected === r.id}><span className="slot-number">0{i + 1}</span><RelicIcon id={r.id}/><span>{found.includes(r.id) ? r.name : 'Uncharted'}</span><small>{found.includes(r.id) ? `${r.depth * 10} m · Collected` : `${ZONES[Math.min(3, Math.floor(r.depth / 30))].short} · A trace remains`}</small></button>)}</div>
      {entry ? <div className="journal-detail" style={{ '--relic-color': entry.color } as CSSProperties}><p className="eyebrow">{found.includes(entry.id) ? entry.type : 'A field note'}</p><h3>{found.includes(entry.id) ? entry.name : 'Look a little closer.'}</h3><p>{found.includes(entry.id) ? entry.story : entry.clue}</p><button onClick={() => { setJournal(false); jump(entry.depth); }}>Return to this place <span aria-hidden="true">↗</span></button></div> : <div className="journal-detail"><p className="eyebrow">Notes from below</p><p>Select a trace for a clue, or a collected object for its story.</p></div>}
      {complete && <div className="journal-complete">✧ The starwhale is awake. Visit the midnight archive to see what your discoveries called home.</div>}
      <div className="restart-expedition"><h3>A different current.</h3><p>Start over with an empty journal. Each object keeps its depth and finds a new hiding place.</p><button disabled={!ready} onClick={resetExpedition}>Start a new expedition</button></div>
      <p className="save-note">{saved ? 'Your discoveries are saved on this device.' : 'Discoveries will stay with you for this visit. Device storage is unavailable.'}</p>
    </dialog>
  </main>;
}
