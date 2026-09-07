import * as T from 'three';
import { approach, canCollect, MAX_DEPTH, RELICS, type RelicId } from './catalog';
import { arch, clearMaterials, coral, frond, jelly, makeRelics, mesh, reef, shellModel } from './models';
import { disposeObject, loadModels, placeModel } from './assets';
import { DiveGestures, type GestureTarget } from './gestures';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type DiveState = { depth: number; zoom: number; nearby: RelicId[]; opened: RelicId[]; hovered: string | null; complete: boolean };
export type DiveEngine = { goTo: (depth: number) => void; resetView: () => void; activate: (id: RelicId) => void; setPaused: (paused: boolean) => void; dispose: () => void };
type Options = { found: RelicId[]; reduced: boolean; onState: (state: DiveState) => void; onCollect: (id: RelicId) => void; onHint: (hint: string) => void; onError: () => void };

export async function createDive(canvas: HTMLCanvasElement, options: Options, signal?: AbortSignal): Promise<DiveEngine> {
  const assets = await loadModels();
  if (signal?.aborted) { Object.values(assets).forEach(a => disposeObject(a.scene)); throw new DOMException('Cancelled', 'AbortError'); }
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const scene = new T.Scene(); scene.fog = new T.FogExp2('#103948', 0.024);
  const environment = new RoomEnvironment(); const pmrem = new T.PMREMGenerator(renderer);
  const environmentMap = pmrem.fromScene(environment, 0.04); scene.environment = environmentMap.texture;
  environment.dispose(); pmrem.dispose();
  const camera = new T.OrthographicCamera(-16, 16, 10, -10, 0.1, 90); camera.position.set(0, 0, 18); scene.add(camera);
  scene.add(new T.HemisphereLight('#c0fff1', '#384359', 1.6));
  const sun = new T.DirectionalLight('#fff1d2', 2.4); sun.position.set(-8, 14, 12); scene.add(sun);
  const fill = new T.PointLight('#b1e0ff', 45, 38, 1.5); fill.position.set(3, 2, 8); camera.add(fill);

  const background = new T.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDepth: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uDepth;
      void main(){
        vec3 surface=mix(vec3(.012,.13,.17),vec3(.12,.48,.48),vUv.y);
        vec3 deep=mix(vec3(.008,.012,.036),vec3(.045,.085,.17),vUv.y);
        vec3 c=mix(surface,deep,smoothstep(0.,.85,uDepth));
        float rays=pow(max(0.,sin(vUv.x*37.+vUv.y*9.+sin(uTime*.17)*.4)),14.);
        rays+=pow(max(0.,sin(vUv.x*21.+vUv.y*6.-uTime*.06)),20.)*.5;
        c+=vec3(.15,.28,.22)*rays*vUv.y*.28*(1.-uDepth);
        float haze=exp(-length((vUv-vec2(.55,.7))*vec2(1.3,1.)) * 4.);
        c+=vec3(.035,.07,.08)*haze;
        c*=.7+.3*pow(max(0.,1.-length(vUv-.5)),.6);
        gl_FragColor=vec4(c,1.);
      }` });
  const backdrop = new T.Mesh(new T.PlaneGeometry(1, 1), background); backdrop.position.z = -55; backdrop.renderOrder = -100; camera.add(backdrop);

  const world = new T.Group(); scene.add(world);
  const movers: { group: T.Object3D; baseY: number; phase: number; kind: 'kelp' | 'jelly' }[] = [];
  const targets: T.Object3D[] = [];
  const add = (object: T.Object3D, x: number, y: number, z = 0) => { object.position.set(x, y, z); world.add(object); return object; };

  // All habitats share these world coordinates and the same camera.
  add(reef(3, '#647977'), 1.5, -3.45, 0);
  add(reef(8, '#375d68'), -8.5, -1.9, -3).scale.set(1.6, 1.1, 1.4);
  add(reef(9, '#234e5a'), 10, -7.5, -4).scale.set(1.8, 1.3, 1.4);
  for (let i = 0; i < 13; i++) {
    const c = coral(['#d89a97', '#bca5cc', '#dfa987', '#79bdad'][i % 4], i);
    add(c, (i % 7 - 3) * 1.4 + 1.3, -3.1 - Math.floor(i / 7) * 1.3, i < 7 ? -0.8 : 1); c.scale.setScalar(0.45 + (i % 3) * 0.2);
  }
  for (let i = 0; i < 9; i++) {
    const f = frond(i % 2 ? '#479a8d' : '#387772', 2 + i % 3, i); add(f, -6 + i * 1.5, -6, -2);
    movers.push({ group: f, baseY: -6, phase: i, kind: 'kelp' });
  }
  const shell = shellModel(); add(shell.group, 1.3, -2.4, 1.25);
  add(reef(4, '#31565c'), -4.4, -20.5, -2); add(coral('#b891b3', 2), -4, -20, -1).scale.setScalar(0.7);

  const ship = placeModel(assets['ship-small'], 7.4, -1.1);
  add(ship.root, 1.1, -40.4, -1.6); ship.root.rotation.set(0.12, 0, -0.14);
  add(reef(18, '#3f526b'), 2.8, -42.2, -1.4).scale.set(1.5, 1, 1);
  for (let i = 0; i < 12; i++) {
    const j = jelly(['#adb2ef', '#83dacc', '#e4b0d1'][i % 3], i); const y = -25 - i * 2.2;
    add(j, Math.sin(i * 2.3) * 5.6, y, i % 3 - 2); j.scale.setScalar(0.6 + (i % 3) * 0.24); j.userData.creature = true;
    j.traverse((o) => { if (o instanceof T.Mesh) { o.userData.creature = j; targets.push(o); } });
    j.userData.homeX = j.position.x; j.userData.restScale = j.scale.y;
    movers.push({ group: j, baseY: y, phase: i, kind: 'jelly' });
  }

  for (let i = 0; i < 24; i++) {
    const y = -65 - Math.floor(i / 8) * 8 + Math.sin(i * 21.1) * 0.35; const f = frond(['#398c77', '#539f80', '#266a67'][i % 3], 4.5 + (Math.sin(i * 11.7)*0.5+0.5)*3, i);
    add(f, (i % 8 - 3.5) * 1.4, y, i % 4 - 2); movers.push({ group: f, baseY: y, phase: i, kind: 'kelp' });
  }
  for(let row=0;row<3;row++) { add(reef(row+7, '#284f53'), -3, -65.7-row*8, -1); add(reef(row+15, '#23494b'), 3, -65.5-row*8, -1.5); }
  add(reef(11, '#284f53'), -2, -72, -1); add(reef(13, '#244550'), 4.7, -82, -2);
  const keyCover = new T.Group(); for (let i = 0; i < 5; i++) { const f = frond('#93b988', 2.4, i); f.position.x = (i - 2) * 0.25; keyCover.add(f); }
  add(keyCover, -1.8, -69, 2);

  add(arch(), 2.3, -97, -0.7); add(reef(22, '#2d405d'), 2.4, -102, -2);
  add(reef(16, '#222e4b'), -6.5, -109, -3).scale.setScalar(1.6);
  const altar = new T.Group();
  for (let i = 0; i < 3; i++) { const r = mesh(new T.TorusGeometry(1.3 + i * 0.5, 0.055, 8, 64), '#617ca0', [0, 0, 0], [1, 1, 1], 0.12); r.rotation.x = i * 0.45; r.rotation.y = i * 0.35; altar.add(r); }
  add(altar, 0, -118, -0.8); add(reef(4, '#303c58'), 0, -121.7, -2).scale.set(1.5, 0.8, 1);

  const relics = makeRelics(); relics.forEach((r) => { world.add(r.group); targets.push(r.hit); });
  const whaleModel = placeModel(assets.whale, 8.4, -Math.PI / 2 + 0.15);
  const starwhale = whaleModel.root; add(starwhale, 0, -114, 0); starwhale.visible = false;
  starwhale.traverse(o => { if (o instanceof T.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
    if (m instanceof T.MeshStandardMaterial) { m.emissive.set('#699ccb'); m.emissiveIntensity = 0.3; m.roughness = 0.48; }
  }); });

  const particles = new Float32Array(850 * 3);
  for (let i = 0; i < 850; i++) { particles[i * 3] = Math.sin(i * 127.1) * 19; particles[i * 3 + 1] = 10 - (i / 850) * 145; particles[i * 3 + 2] = Math.cos(i * 311.7) * 7 - 4; }
  const particleGeometry = new T.BufferGeometry(); particleGeometry.setAttribute('position', new T.BufferAttribute(particles, 3));
  const plankton = new T.Points(particleGeometry, new T.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uRatio: { value: Math.min(devicePixelRatio, 1.5) } },
    vertexShader: 'uniform float uTime; uniform float uRatio; varying float vAlpha; void main(){vec3 p=position;p.x+=sin(uTime*.15+p.y)*.16;vAlpha=.25+.4*(.5+.5*sin(p.y*7.+uTime));gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=(1.8+mod(abs(p.y),2.))*uRatio;}',
    fragmentShader: 'varying float vAlpha; void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.65,.91,1.,vAlpha*(1.-d*2.));}' })); world.add(plankton);

  const swimmers = Array.from({ length: 16 }, (_, i) => {
    const manta = i === 0 || i === 9;
    const name = manta ? 'manta-ray' : (['fish1', 'fish2', 'fish3'] as const)[i % 3];
    const placed = placeModel(assets[name], manta ? 3.4 : 0.9 + i % 3 * 0.32, (i % 2 ? -1 : 1) * Math.PI / 2);
    const baseY = i < 4 ? [2, -0.8, -1.7, 3.3][i] : -Math.floor(i / 4) * 30 - (i % 4) * 2.8;
    const baseX = Math.sin(i * 2.4) * 4.8;
    add(placed.root, baseX, baseY, -2.5 - i % 3); placed.orientation.rotation.x = manta ? 0.3 : 0;
    return { ...placed, baseX, baseY, phase: i, direction: i % 2 ? -1 : 1 };
  });
  const found = new Set(options.found); const opened = new Set<RelicId>();
  let current = 0, target = 0, width = 0, height = 0, viewHeight = 20, time = 0, last = 0, reportAt = -1;
  let raf = 0, paused = false, disposed = false, hovered: string | null = null;
  let creature: T.Object3D | null = null, diveVelocity = 0, zoom = 1, panX = 0;
  const ray = new T.Raycaster(); const pointer = new T.Vector2(); const mouse = new T.Vector2();
  const v = new T.Vector3(); const deepFog = new T.Color('#090f28'); let hoverId: RelicId | null = null;
  let lastReport = '';
  const collectTime = new Map<RelicId, number>();

  function goTo(depth: number) { diveVelocity = 0; target = Math.min(MAX_DEPTH, Math.max(0, depth)); }
  function resetView() { zoom = 1; panX = 0; diveVelocity = 0; resize(); reportAt = -1; }
  function activate(id: RelicId) {
    const relic = RELICS.find((r) => r.id === id)!;
    if (paused || Math.abs(current - relic.depth) > viewHeight * 0.46 || found.has(id)) return;
    if ((id === 'pearl' || id === 'key') && !opened.has(id)) {
      opened.add(id); options.onHint(id === 'pearl' ? 'A little sunrise. Touch the pearl to keep it.' : 'The fronds part. The key is yours to take.'); reportAt = -1; return;
    }
    if (!canCollect(id, found, opened)) { options.onHint('Five memories are missing. The rings are waiting for them.'); return; }
    found.add(id); collectTime.set(id, time); options.onCollect(id); reportAt = -1;
  }
  function hitAt(x: number, y: number) {
    const rect = canvas.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
    return ray.intersectObjects(targets, false).find((hit) => {
      const id = hit.object.userData.relic as RelicId | undefined;
      return !id || !found.has(id);
    });
  }
  const onWheel = (e: WheelEvent) => { if (paused || e.ctrlKey) return; e.preventDefault(); goTo(target + Math.max(-280, Math.min(280, e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1))) * 0.015); };
  const gestureTarget = (x: number, y: number): GestureTarget | null => {
    const hit = hitAt(x, y)?.object;
    if (hit?.userData.relic) return { kind: 'relic', value: hit.userData.relic };
    return hit?.userData.creature ? { kind: 'creature', value: hit.userData.creature } : null;
  };
  const gestures = new DiveGestures({
    hit: p => gestureTarget(p.x, p.y),
    start: () => { diveVelocity = 0; creature = null; hovered = null; hoverId = null; },
    navigate: (dx, dy, twoFinger) => {
      goTo(target - dy * viewHeight / height);
      if (twoFinger) panX = T.MathUtils.clamp(panX - dx * (camera.right - camera.left) / width, -6, 6);
    },
    drag: (hit, dx, dy) => {
      creature = hit.value as T.Object3D;
      creature.position.x = T.MathUtils.clamp(creature.position.x + dx * (camera.right - camera.left) / width, -12, 12);
      creature.position.y -= dy * viewHeight / height;
    },
    tap: (hit, p) => { if (hit?.kind === 'relic' && gestureTarget(p.x, p.y)?.value === hit.value) activate(hit.value as RelicId); },
    hold: hit => {
      const relic = RELICS.find(r => r.id === hit.value);
      if (relic) { options.onHint(`${relic.name} · ${relic.clue}`); navigator.vibrate?.(12); }
    },
    zoom: (ratio, centre) => {
      const oldWidth = camera.right - camera.left, oldHeight = viewHeight;
      zoom = T.MathUtils.clamp(zoom * ratio, 0.8, 1.8); resize();
      const rect = canvas.getBoundingClientRect();
      panX = T.MathUtils.clamp(panX + ((centre.x - rect.left) / width - 0.5) * (oldWidth - camera.right + camera.left), -6, 6);
      goTo(target + ((centre.y - rect.top) / height - 0.5) * (oldHeight - viewHeight));
    },
    release: velocity => { creature = null; diveVelocity = options.reduced ? 0 : T.MathUtils.clamp(-velocity * viewHeight / height, -40, 40); },
    reset: resetView,
  });
  const cancelGestures = () => {
    const ids = [...gestures.pointers.keys()]; gestures.cancel();
    ids.forEach(id => { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); });
  };
  const onDown = (e: PointerEvent) => {
    if (paused || e.button > 0) return;
    gestures.down(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp, e.pointerType === 'touch');
    canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
  };
  const onMove = (e: PointerEvent) => {
    if (paused) return;
    if (gestures.active) { gestures.move(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp); return; }
    if (e.pointerType === 'touch') return;
    mouse.set(e.clientX / width * 2 - 1, -(e.clientY / height * 2 - 1));
    const hit = hitAt(e.clientX, e.clientY); hoverId = hit?.object.userData.relic ?? null;
    hovered = hoverId ? (hoverId === 'pearl' && !opened.has('pearl') ? 'Open the shell' : hoverId === 'key' && !opened.has('key') ? 'Part the fronds' : RELICS.find((r) => r.id === hoverId)!.name) : hit ? 'Drift with me' : null;
    canvas.style.cursor = hit ? 'pointer' : 'grab';
  };
  const onUp = (e: PointerEvent) => {
    gestures.up(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp, e.type !== 'pointerup');
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const onLeave = () => { hovered = null; hoverId = null; mouse.set(0, 0); };
  const onKey = (e: KeyboardEvent) => {
    if (paused || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLDialogElement) return;
    if (e.key === '0' || e.key === 'Escape') { resetView(); return; }
    const destination: Record<string, number> = { ArrowDown: target + 3, ArrowUp: target - 3, PageDown: target + viewHeight * 0.8, PageUp: target - viewHeight * 0.8, Home: 0, End: MAX_DEPTH, ' ': target + viewHeight * 0.8 };
    if (e.key in destination) { e.preventDefault(); goTo(destination[e.key]); }
  };
  const resize = () => {
    const resized = width !== canvas.clientWidth || height !== canvas.clientHeight;
    width = canvas.clientWidth; height = canvas.clientHeight;
    if (!width || !height) return;
    const viewWidth = (width < 700 ? 13 : width < 1000 ? 21 : 30) / zoom;
    viewHeight = viewWidth * height / width;
    camera.left = -viewWidth / 2; camera.right = viewWidth / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2; camera.updateProjectionMatrix();
    backdrop.scale.set(viewWidth, viewHeight, 1);
    if (resized) renderer.setSize(width, height, false);
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  function frame(now: number) {
    if (disposed) return;
    if (last && now - last < 1000 / 60 - 1) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    if (!paused) {
      if (!gestures.active && Math.abs(diveVelocity) > 0.03) {
        target = T.MathUtils.clamp(target + diveVelocity * dt, 0, MAX_DEPTH);
        diveVelocity *= Math.exp(-4.5 * dt);
        if (target === 0 || target === MAX_DEPTH) diveVelocity = 0;
      }
      time += dt; current = approach(current, target, dt, options.reduced || gestures.active);
      camera.position.y = -current;
      camera.position.x += (panX + (options.reduced || gestures.active ? 0 : mouse.x * 0.18) - camera.position.x) * (gestures.active || options.reduced ? 1 : Math.min(1, dt * 8));
      background.uniforms.uTime.value = options.reduced ? 0 : time;
      background.uniforms.uDepth.value = current / MAX_DEPTH;
      (plankton.material as T.ShaderMaterial).uniforms.uTime.value = options.reduced ? 0 : time;
      (scene.fog as T.FogExp2).color.set('#103948').lerp(deepFog, current / MAX_DEPTH);
      for (const m of movers) {
        if (Math.abs(m.baseY + current) > viewHeight + 8 || m.group === creature || options.reduced) continue;
        if (m.kind === 'kelp') m.group.rotation.z = Math.sin(time * 0.5 + m.phase) * 0.08 + mouse.x * 0.025;
        else { m.group.position.x += (m.group.userData.homeX - m.group.position.x) * dt * 0.7; m.group.position.y += (m.baseY + Math.sin(time * 0.5 + m.phase) * 0.6 - m.group.position.y) * dt * 2; m.group.rotation.z = Math.sin(time * 0.6 + m.phase) * 0.08; m.group.scale.y = m.group.userData.restScale * (0.94 + Math.sin(time * 1.8 + m.phase) * 0.09); }
      }
      shell.lid.rotation.x += ((opened.has('pearl') || found.has('pearl') ? -1.3 : -0.08) - shell.lid.rotation.x) * Math.min(1, dt * 4);
      keyCover.children.forEach((leaf, i) => { leaf.rotation.z += ((opened.has('key') || found.has('key') ? (i - 2) * 0.45 : (i - 2) * 0.1) - leaf.rotation.z) * Math.min(1, dt * 4); });
      relics.forEach(({ relic, group, model }) => {
        const at = collectTime.get(relic.id);
        if (at !== undefined) { const elapsed = time - at; group.scale.setScalar(Math.max(0, 1 - elapsed * 1.6)); group.position.y = -relic.depth + elapsed * 1.8; group.rotation.y = elapsed * 5; }
        else group.visible = !found.has(relic.id);
        if (!found.has(relic.id)) {
          model.visible = relic.id !== 'pearl' || opened.has('pearl');
          model.position.y = options.reduced ? 0 : Math.sin(time * 1.2 + relic.depth) * 0.08;
          const desired = hoverId === relic.id ? 1.13 : 1; model.scale.lerp(v.setScalar(desired), Math.min(1, dt * 6));
        }
      });
      for (const fish of swimmers) {
        fish.root.visible = Math.abs(fish.baseY + current) < viewHeight * 0.65 + 3;
        if (!fish.root.visible || options.reduced) continue;
        fish.mixer.update(dt);
        fish.root.position.x = ((fish.baseX + time * 0.45 * fish.direction + 600) % 18) - 9;
        fish.root.position.y = fish.baseY + Math.sin(time * 0.4 + fish.phase) * 0.35;
        fish.root.rotation.z = Math.sin(time * 0.5 + fish.phase) * 0.035;
      }
      starwhale.visible = found.size === RELICS.length && Math.abs(current - 115) < viewHeight;
      if (starwhale.visible) {
        const t = options.reduced ? 0 : time;
        if (!options.reduced) whaleModel.mixer.update(dt);
        starwhale.position.set(Math.sin(t * 0.15) * 2, -115 + Math.sin(t * 0.35) * 0.6, 0); starwhale.rotation.z = Math.sin(t * 0.3) * 0.05;
      }
      altar.rotation.z = options.reduced ? 0 : time * 0.08;
      if (time - reportAt > 0.1) {
        reportAt = time;
        const state = { depth: Math.round(current * 10) / 10, zoom: Math.round(zoom * 100) / 100, nearby: RELICS.filter((r) => !found.has(r.id) && Math.abs(r.depth - current) < viewHeight * 0.37).map((r) => r.id), opened: [...opened], hovered, complete: found.size === RELICS.length };
        const key = JSON.stringify(state);
        if (key !== lastReport) { lastReport = key; options.onState(state); }
      }
    }
    renderer.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function visibility() { cancelGestures(); cancelAnimationFrame(raf); last = 0; if (!document.hidden && !disposed && !paused) raf = requestAnimationFrame(frame); }
  const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); options.onError(); };
  canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('lostpointercapture', onUp); canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('webglcontextlost', contextLost); window.addEventListener('keydown', onKey); window.addEventListener('blur', cancelGestures); document.addEventListener('visibilitychange', visibility);
  raf = requestAnimationFrame(frame);
  return { goTo, resetView, activate, setPaused(value) { paused = value; visibility(); }, dispose() {
    disposed = true; cancelGestures(); cancelAnimationFrame(raf); observer.disconnect();
    canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('lostpointercapture', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('webglcontextlost', contextLost);
    window.removeEventListener('keydown', onKey); window.removeEventListener('blur', cancelGestures); document.removeEventListener('visibilitychange', visibility);
    [...swimmers, whaleModel, ship].forEach(actor => { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.mixer.getRoot()); });
    disposeObject(scene); Object.values(assets).forEach(asset => disposeObject(asset.scene));
    environmentMap.dispose(); clearMaterials(); renderer.dispose();
  } };
}
