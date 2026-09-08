import * as T from 'three';
import { approach, canCollect, discoveryLocations, MAX_DEPTH, randomSequence, RELICS, type RelicId } from './catalog';
import { arch, clearMaterials, jelly, makeRelics, mesh, shellModel } from './models';
import { disposeObject, loadModels, placeModel } from './assets';
import { DiveGestures, type GestureTarget } from './gestures';
import { DiveCamera } from './camera';
import { buildHabitats, seaPlant, type Scenery, type Water } from './habitat';
import { createSchools, SCHOOL_FISH_COUNT, type SchoolFish } from './schools';
import { waterEffects } from './effects';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export type DiveState = { depth: number; zoom: number; angle: number; fishCount: number; nearby: RelicId[]; opened: RelicId[]; hovered: string | null; complete: boolean };
export type DiveEngine = { goTo: (depth: number) => void; resetView: () => void; reset: (seed: number) => void; activate: (id: RelicId) => void; setPaused: (paused: boolean) => void; dispose: () => void };
type Options = { found: RelicId[]; seed: number; reduced: boolean; onState: (state: DiveState) => void; onCollect: (id: RelicId) => void; onHint: (hint: string) => void; onError: () => void };
type Pick = { kind: 'relic' | 'fish' | 'creature' | 'scenery'; point: T.Vector3; id?: RelicId; fish?: SchoolFish; object?: T.Object3D; scenery?: Scenery };
type Creature = { root: T.Object3D; home: T.Vector3; phase: number; scale: number; pulse: number; mixer?: T.AnimationMixer; manta?: boolean };

export async function createDive(canvas: HTMLCanvasElement, options: Options, signal?: AbortSignal): Promise<DiveEngine> {
  const assets = await loadModels();
  if (signal?.aborted) { Object.values(assets).forEach(a => disposeObject(a.scene)); throw new DOMException('Cancelled', 'AbortError'); }
  let renderer: T.WebGLRenderer;
  try { renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (error) { Object.values(assets).forEach(a => disposeObject(a.scene)); throw error; }
  const ratio = Math.min(devicePixelRatio, 1.5); renderer.setPixelRatio(ratio);
  renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
  const scene = new T.Scene(); scene.fog = new T.FogExp2('#12454d', 0.018);
  const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture; room.dispose(); pmrem.dispose();
  const rig = new DiveCamera(), camera = rig.camera; scene.add(camera);
  scene.add(new T.HemisphereLight('#bce6d5', '#203244', 1.7));
  const sun = new T.DirectionalLight('#ffeed0', 2.8); sun.position.set(-7, 18, 9); scene.add(sun);
  const fill = new T.PointLight('#96dadd', 45, 65, 1.5); fill.position.set(3, 4, 8); camera.add(fill);
  const water: Water = { time: { value: 0 }, point: { value: new T.Vector3(100, 100, 100) }, strength: { value: 0 } };
  const background = new T.ShaderMaterial({ depthTest: false, depthWrite: false,
    uniforms: { uTime: water.time, uDepth: { value: 0 }, uTouch: water.strength },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float uTime;uniform float uDepth;uniform float uTouch;
      void main(){vec3 surface=mix(vec3(.007,.085,.12),vec3(.12,.43,.41),vUv.y);vec3 deep=mix(vec3(.006,.012,.03),vec3(.035,.09,.15),vUv.y);
      vec3 color=mix(surface,deep,smoothstep(0.,1.,uDepth));float shafts=pow(max(0.,sin(vUv.x*24.+vUv.y*4.+sin(uTime*.2)*.25)),20.);
      color+=vec3(.17,.26,.19)*shafts*pow(vUv.y,2.)*(.28+uTouch*.02)*(1.-uDepth);color*=.84+.16*(1.-length(vUv-.5));gl_FragColor=vec4(color,1.);}` });
  const backdrop = new T.Mesh(new T.PlaneGeometry(1, 1), background); backdrop.position.z = -100; backdrop.renderOrder = -100; camera.add(backdrop);
  const world = new T.Group(); scene.add(world);
  const habitats = buildHabitats(water); world.add(habitats.root);
  const schools = createSchools(assets, water); world.add(schools.root);
  const effects = waterEffects(water, ratio); world.add(effects.root);
  const targets: T.Object3D[] = [...schools.targets], creatures: Creature[] = [];
  const found = new Set(options.found), opened = new Set<RelicId>(), collectTime = new Map<RelicId, number>();
  let locations = discoveryLocations(options.seed);
  let current = 0, target = 0, width = 1, height = 1, time = 0, last = 0, reportAt = -1, lastHover = -100;
  let raf = 0, paused = false, disposed = false, hovered: string | null = null, hoverId: RelicId | null = null, diveVelocity = 0;
  let dragged: T.Object3D | null = null, celebratedAt = -100, celebrationWave = 0;
  const ray = new T.Raycaster(), pointer = new T.Vector2(), plane = new T.Plane(), direction = new T.Vector3(), delta = new T.Vector3(), point = new T.Vector3();
  const temp = new T.Vector3(), deepFog = new T.Color('#091427');
  let lastReport = '';

  const shell = shellModel(); const shellProp = habitats.register(shell.group, 'structure', 'An open shell');
  const ship = placeModel(assets['ship-small'], 7.6, -1.1); ship.root.rotation.set(0.07, 0, -0.14);
  const shipProp = habitats.register(ship.root, 'structure', 'Lost ship · stir the current');
  const keyCover = new T.Group();
  for (let i = 0; i < 3; i++) { const leaf = seaPlant(93 + i, 2.25, habitats.plantMaterial); leaf.position.set((i - 1) * 0.38, 0, i % 2 * 0.18); keyCover.add(leaf); }
  const keyProp = habitats.register(keyCover, 'plant', 'Drifting kelp · part the fronds');
  const ruin = habitats.register(arch(), 'structure', 'An ancient arch');
  const altar = new T.Group();
  for (let i = 0; i < 3; i++) { const ring = mesh(new T.TorusGeometry(1.3 + i * 0.4, 0.035, 8, 64), '#7d9cb9', [0, 0, 0], [1, 1, 1], 0.25); ring.rotation.set(i * 0.45, i * 0.55, 0); altar.add(ring); }
  const altarProp = habitats.register(altar, 'structure', 'The memory rings');
  const relics = makeRelics(); relics.forEach(r => { world.add(r.group); r.hit.userData.owner = r.group; targets.push(r.hit); r.model.traverse(o => { if (o instanceof T.Mesh) { o.userData.relic = r.relic.id; o.userData.owner = r.group; targets.push(o); } }); });
  shell.group.traverse(o => { if (o instanceof T.Mesh) o.userData.relic = 'pearl'; });
  keyCover.traverse(o => { if (o instanceof T.Mesh) o.userData.relic = 'key'; });
  for (const prop of habitats.scenery) prop.root.traverse(o => { if (o instanceof T.Mesh) targets.push(o); });
  const moveProp = (prop: Scenery, x: number, y: number, z: number) => { prop.home.set(x, y, z); prop.root.position.copy(prop.home); };
  function placeDiscoveries() {
    for (const [i, r] of relics.entries()) { const at = locations[i]; r.group.position.set(at.x, -at.depth, at.z); r.group.scale.setScalar(1); r.group.rotation.set(0, 0, 0); r.group.visible = !found.has(at.id); }
    const [pearl, , compass, key, lantern, moon] = locations;
    moveProp(shellProp, pearl.x, -pearl.depth - 0.4, pearl.z);
    moveProp(shipProp, compass.x - 1, -compass.depth - 2.3, compass.z - 2.8);
    moveProp(keyProp, key.x, -key.depth - 1.25, key.z + 0.15);
    moveProp(ruin, lantern.x, -lantern.depth + 0.3, lantern.z - 1.8);
    moveProp(altarProp, moon.x, -moon.depth, moon.z - 1.3);
  }
  placeDiscoveries();

  function addCreature(root: T.Object3D, x: number, y: number, z: number, phase: number, mixer?: T.AnimationMixer, manta = false) {
    root.position.set(x, y, z); world.add(root);
    const creature: Creature = { root, home: root.position.clone(), phase, scale: root.scale.y, pulse: 0, mixer, manta };
    const proxy = new T.Mesh(new T.SphereGeometry(manta ? 1.25 : 0.72, 10, 8), new T.MeshBasicMaterial({ visible: false }));
    proxy.userData.creature = creature; proxy.userData.owner = root; root.add(proxy); targets.push(proxy); creatures.push(creature); return creature;
  }
  for (let i = 0; i < 14; i++) { const object = jelly(['#aebce3', '#7ac9c6', '#d4a0c3'][i % 3], i); object.scale.setScalar(0.5 + i % 3 * 0.18); addCreature(object, Math.sin(i * 2.3) * 6, -25 - i * 1.8, Math.cos(i * 2.3) * 5, i); }
  for (let i = 0; i < 3; i++) { const manta = placeModel(assets['manta-ray'], 3.3, Math.PI / 2); manta.orientation.rotation.x = 0.25; addCreature(manta.root, -1 + i, -[0, 55, 91][i], -1.5, i * 2, manta.mixer, true); }
  const whaleModel = placeModel(assets.whale, 8.4, -Math.PI / 2 + 0.15), starwhale = whaleModel.root;
  const whale = addCreature(starwhale, 0, -114, -0.8, 1, whaleModel.mixer, true); starwhale.visible = false;
  starwhale.traverse(o => { if (o instanceof T.Mesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m instanceof T.MeshStandardMaterial) { m.emissive.set('#407aaa'); m.emissiveIntensity = 0.3; } }); });

  const snow = new Float32Array(1500 * 3), random = randomSequence(6001);
  for (let i = 0; i < 1500; i++) { snow[i * 3] = (random() - 0.5) * 35; snow[i * 3 + 1] = 12 - random() * 150; snow[i * 3 + 2] = (random() - 0.5) * 32; }
  const snowGeometry = new T.BufferGeometry(); snowGeometry.setAttribute('position', new T.BufferAttribute(snow, 3));
  const plankton = new T.Points(snowGeometry, new T.ShaderMaterial({ transparent: true, depthWrite: false,
    uniforms: { uTime: water.time, uTouch: water.point, uStrength: water.strength, uRatio: { value: ratio } },
    vertexShader: `uniform float uTime;uniform vec3 uTouch;uniform float uStrength;uniform float uRatio;varying float vAlpha;
      void main(){vec3 p=position;p.x+=sin(uTime*.2+p.y)*.18;vec3 d=p-uTouch;float dist=length(d);p+=d/max(.1,dist)*exp(-dist*.5)*uStrength*.7;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(55./max(8.,-mv.z),1.,3.)*uRatio;vAlpha=.15+.35*(.5+.5*sin(p.y*7.+uTime*.7));}`,
    fragmentShader: 'varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.63,.89,.88,vAlpha*(1.-d*2.));}' })); world.add(plankton);

  function goTo(depth: number) { diveVelocity = 0; target = T.MathUtils.clamp(depth, 0, MAX_DEPTH); }
  function resetView() { rig.reset(); diveVelocity = 0; resize(); reportAt = -1; }
  function activate(id: RelicId) {
    const relic = RELICS.find(r => r.id === id)!;
    if (paused || Math.abs(current - relic.depth) > rig.height * 0.46 || found.has(id)) return;
    const model = relics.find(r => r.relic.id === id)!;
    water.point.value.copy(model.group.position); water.strength.value = 2;
    if ((id === 'pearl' || id === 'key') && !opened.has(id)) { opened.add(id); options.onHint(id === 'pearl' ? 'A little sunrise. Touch the pearl to keep it.' : 'The garden opens. Touch the key to take it.'); effects.burst(model.group.position, false, false, options.reduced); reportAt = -1; return; }
    if (!canCollect(id, found, opened)) { options.onHint('Five memories are missing. The rings are waiting for them.'); return; }
    found.add(id); collectTime.set(id, time); effects.burst(model.group.position, id === 'moon', false, options.reduced); schools.scatter(model.group.position, id === 'moon' ? 8 : 4);
    if (id === 'moon') { celebratedAt = time; celebrationWave = 1; }
    options.onCollect(id); reportAt = -1;
  }
  function setRay(x: number, y: number) {
    const rect = canvas.getBoundingClientRect(); pointer.set((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1); ray.setFromCamera(pointer, camera);
  }
  function visible(object: T.Object3D) { for (let parent: T.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return false; return true; }
  function hitAt(x: number, y: number): Pick | null {
    setRay(x, y);
    const candidates = targets.filter(object => visible(object.userData.owner ?? object));
    for (const hit of ray.intersectObjects(candidates, false)) {
      if (!visible(hit.object)) continue;
      const data = hit.object.userData, id = data.relic as RelicId | undefined;
      if (data.maxPickDistance && hit.distance > data.maxPickDistance) continue;
      if (id && !found.has(id)) return { kind: 'relic', id, point: hit.point };
      if (data.fish && hit.instanceId !== undefined) return { kind: 'fish', fish: data.fish[hit.instanceId], point: hit.point };
      if (data.creature) return { kind: 'creature', object: data.creature.root, point: hit.point };
      if (data.scenery) return { kind: 'scenery', scenery: data.scenery, point: hit.point };
    }
    return null;
  }
  function waterPoint(x: number, y: number, strength: number, picked?: Pick | null) {
    if (picked) point.copy(picked.point);
    else { setRay(x, y); camera.getWorldDirection(direction); plane.setFromNormalAndCoplanarPoint(direction, rig.focus); if (!ray.ray.intersectPlane(plane, point)) return; }
    water.point.value.copy(point); water.strength.value = Math.max(water.strength.value, strength);
  }
  function react(picked: Pick | null, click = false) {
    if (picked?.scenery) picked.scenery.pulse = Math.max(picked.scenery.pulse, click ? 1 : 0.35);
    if (picked?.object) { const c = creatures.find(c => c.root === picked.object); if (c) c.pulse = click ? 1 : 0.4; }
    if (click) { schools.scatter(water.point.value, 7); effects.burst(water.point.value, false, picked?.scenery?.kind === 'rock', options.reduced); }
  }
  const asGesture = (picked: Pick | null): GestureTarget | null => picked ? { kind: picked.kind === 'relic' ? 'relic' : picked.kind === 'fish' || picked.kind === 'creature' ? 'creature' : 'scenery', value: picked } : null;
  const gestures = new DiveGestures({
    hit: p => { const picked = hitAt(p.x, p.y); waterPoint(p.x, p.y, 1.2, picked); react(picked); return asGesture(picked); },
    start: () => { diveVelocity = 0; dragged = null; hovered = null; hoverId = null; },
    navigate: (dx, dy, twoFinger) => { goTo(target - dy * rig.height / height); if (twoFinger) rig.pan = T.MathUtils.clamp(rig.pan - dx * rig.width / width, -4, 4); else rig.orbit(dx, width); },
    drag: (target, dx, dy) => {
      const picked = target.value as Pick; delta.copy(rig.right).multiplyScalar(dx * rig.width / width).addScaledVector(rig.up, -dy * rig.height / height);
      if (picked.fish) picked.fish.offset.add(delta).clampLength(0, 6);
      if (picked.object) { dragged = picked.object; dragged.position.add(delta); }
    },
    tap: (target, p) => { const picked = target?.value as Pick | undefined; const end = hitAt(p.x, p.y); waterPoint(p.x, p.y, 3, end); if (picked?.id && end?.id === picked.id) activate(picked.id); else react(end, true); },
    hold: target => { const picked = target.value as Pick, relic = RELICS.find(r => r.id === picked.id); if (relic) { options.onHint(`${relic.name} · ${relic.clue}`); navigator.vibrate?.(12); } },
    zoom: ratio => { rig.zoom = T.MathUtils.clamp(rig.zoom * ratio, 0.8, 1.8); resize(); reportAt = -1; },
    release: velocity => { dragged = null; diveVelocity = options.reduced ? 0 : T.MathUtils.clamp(-velocity * rig.height / height, -40, 40); },
    reset: resetView,
  });
  const cancelGestures = () => { const ids = [...gestures.pointers.keys()]; gestures.cancel(); ids.forEach(id => { if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); }); };
  const onDown = (e: PointerEvent) => { if (paused || e.button > 0) return; gestures.down(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp, e.pointerType === 'touch'); canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true }); };
  const onMove = (e: PointerEvent) => {
    if (paused) return;
    if (gestures.active) { gestures.move(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp); waterPoint(e.clientX, e.clientY, 1.4); return; }
    if (e.pointerType === 'touch' || e.timeStamp - lastHover < 45) return; lastHover = e.timeStamp;
    const picked = hitAt(e.clientX, e.clientY); waterPoint(e.clientX, e.clientY, 0.85, picked); react(picked); hoverId = picked?.id ?? null;
    hovered = hoverId ? (hoverId === 'pearl' && !opened.has('pearl') ? 'Open the shell' : hoverId === 'key' && !opened.has('key') ? 'Part the fronds' : RELICS.find(r => r.id === hoverId)!.name) : picked?.scenery?.name ?? (picked ? 'Make a little current' : null);
    canvas.style.cursor = picked ? 'pointer' : 'grab';
  };
  const onUp = (e: PointerEvent) => { gestures.up(e.pointerId, { x: e.clientX, y: e.clientY }, e.timeStamp, e.type !== 'pointerup'); if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); };
  const onLeave = () => { hovered = null; hoverId = null; };
  const onWheel = (e: WheelEvent) => { if (paused || e.ctrlKey) return; e.preventDefault(); const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? height : 1; if (e.shiftKey) rig.orbit(e.deltaY * unit, width); else { goTo(target + T.MathUtils.clamp(e.deltaY * unit, -280, 280) * 0.015); rig.orbit(e.deltaX * unit, width); } };
  const onKey = (e: KeyboardEvent) => {
    if (paused || e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement || e.target instanceof HTMLDialogElement || e.target instanceof HTMLAnchorElement || (e.target as HTMLElement)?.tagName === 'SUMMARY') return;
    if (e.key === '0' || e.key === 'Escape') { resetView(); return; }
    if (['ArrowLeft', 'ArrowRight', 'q', 'e'].includes(e.key)) { e.preventDefault(); rig.targetYaw += ['ArrowLeft', 'q'].includes(e.key) ? 0.18 : -0.18; return; }
    const destinations: Record<string, number> = { ArrowDown: target + 3, ArrowUp: target - 3, PageDown: target + rig.height * 0.8, PageUp: target - rig.height * 0.8, Home: 0, End: MAX_DEPTH, ' ': target + rig.height * 0.8 };
    if (e.key in destinations) { e.preventDefault(); goTo(destinations[e.key]); }
  };
  function resize() {
    const changed = width !== canvas.clientWidth || height !== canvas.clientHeight;
    width = canvas.clientWidth; height = canvas.clientHeight; if (!width || !height) return;
    rig.resize(width, height); const backHeight = 2 * Math.tan(camera.fov * Math.PI / 360) * 100; backdrop.scale.set(backHeight * camera.aspect, backHeight, 1);
    if (changed) renderer.setSize(width, height, false);
  }
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); rig.update(0, 0, true); schools.update(0, 0, 0, rig.height, options.reduced, found.size === RELICS.length);

  function frame(now: number) {
    if (disposed) return;
    if (last && now - last < 1000 / 60 - 1) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
    if (!paused) {
      if (!gestures.active && Math.abs(diveVelocity) > 0.03) { target = T.MathUtils.clamp(target + diveVelocity * dt, 0, MAX_DEPTH); diveVelocity *= Math.exp(-4.5 * dt); if (target === 0 || target === MAX_DEPTH) diveVelocity = 0; }
      time += dt; current = approach(current, target, dt, options.reduced || gestures.active); rig.update(current, dt, options.reduced || gestures.active);
      water.time.value = options.reduced ? 0 : time; water.strength.value *= Math.exp(-dt * 2.4); background.uniforms.uDepth.value = current / MAX_DEPTH;
      (scene.fog as T.FogExp2).color.set('#12454d').lerp(deepFog, current / MAX_DEPTH);
      (scene.fog as T.FogExp2).density = 0.018 + current / MAX_DEPTH * 0.012;
      const complete = found.size === RELICS.length;
      for (const prop of habitats.scenery) {
        prop.root.visible = prop.root === habitats.floor || Math.abs(prop.home.y + current) < rig.height * 0.75 + 13;
        if (!prop.root.visible) continue;
        prop.pulse *= Math.exp(-dt * 3); prop.root.position.copy(prop.home); prop.root.rotation.copy(prop.rotation);
        const motion = prop.pulse * (options.reduced ? 0.2 : Math.sin(time * (prop.kind === 'rock' ? 16 : 5)));
        if (!prop.anchored) {
          prop.root.rotation.z += motion * (prop.kind === 'rock' ? 0.015 : 0.1);
          if (prop.kind === 'rock') prop.root.position.y += Math.abs(motion) * 0.025;
        }
      }
      for (const c of creatures) {
        c.root.visible = (c !== whale || complete) && Math.abs(c.home.y + current) < rig.height * 0.7 + 6;
        if (!c.root.visible) continue; c.pulse *= Math.exp(-dt * 2.5);
        if (!options.reduced) c.mixer?.update(dt * (1 + c.pulse));
        if (c.root !== dragged) { temp.copy(c.home); if (!options.reduced) { temp.x += Math.sin(time * 0.23 + c.phase) * (c.manta ? 2.5 : 0.4); temp.y += Math.sin(time * 0.55 + c.phase) * 0.45; temp.z += Math.cos(time * 0.23 + c.phase) * (c.manta ? 2 : 0.3); } c.root.position.lerp(temp, Math.min(1, dt * 2.5)); }
        c.root.scale.y = c.scale * (1 + (options.reduced ? 0 : Math.sin(time * 1.8 + c.phase) * (c.manta ? 0 : 0.055)) + c.pulse * 0.07);
      }
      shell.lid.rotation.x += ((opened.has('pearl') || found.has('pearl') ? -1.35 : -0.08) - shell.lid.rotation.x) * Math.min(1, dt * 5);
      keyCover.children.forEach((leaf, i) => { leaf.rotation.z += ((opened.has('key') || found.has('key') ? (i - 1) * 0.75 : (i - 1) * 0.08) - leaf.rotation.z) * Math.min(1, dt * 5); });
      relics.forEach(({ relic, group, model }, i) => {
        const at = collectTime.get(relic.id);
        if (at !== undefined) { const elapsed = time - at; group.visible = elapsed < 0.8; group.scale.setScalar(Math.max(0, 1 - elapsed * 1.6)); group.position.y = -locations[i].depth + elapsed * 1.8; group.rotation.y = elapsed * 5; }
        else group.visible = !found.has(relic.id);
        if (!found.has(relic.id)) { model.visible = relic.id !== 'pearl' || opened.has('pearl'); model.position.y = options.reduced ? 0 : Math.sin(time * 1.2 + relic.depth) * 0.08; model.scale.lerp(temp.setScalar(hoverId === relic.id ? 1.14 : 1), Math.min(1, dt * 6)); }
      });
      schools.update(time, dt, current, rig.height, options.reduced, complete); effects.update(dt, current);
      altar.rotation.y += options.reduced ? 0 : Math.sin(time * 0.18) * 0.25;
      if (complete && celebrationWave < 3 && time - celebratedAt > celebrationWave * 1.6 && time - celebratedAt < 6) { effects.burst(starwhale.position, true, false, options.reduced); celebrationWave++; }
      if (time - reportAt > 0.1) {
        reportAt = time;
        const state: DiveState = { depth: Math.round(current * 10) / 10, zoom: Math.round(rig.zoom * 100) / 100, angle: Math.round(rig.yaw * 180 / Math.PI), fishCount: SCHOOL_FISH_COUNT + 3, nearby: RELICS.filter(r => !found.has(r.id) && Math.abs(r.depth - current) < rig.height * 0.37).map(r => r.id), opened: [...opened], hovered, complete };
        const key = JSON.stringify(state); if (key !== lastReport) { lastReport = key; options.onState(state); }
      }
    }
    renderer.render(scene, camera); raf = requestAnimationFrame(frame);
  }
  function visibility() { cancelGestures(); cancelAnimationFrame(raf); last = 0; if (!document.hidden && !disposed && !paused) raf = requestAnimationFrame(frame); }
  const contextLost = (event: Event) => { event.preventDefault(); cancelAnimationFrame(raf); options.onError(); };
  canvas.addEventListener('wheel', onWheel, { passive: false }); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointercancel', onUp); canvas.addEventListener('lostpointercapture', onUp); canvas.addEventListener('pointerleave', onLeave); canvas.addEventListener('webglcontextlost', contextLost);
  window.addEventListener('keydown', onKey); window.addEventListener('blur', cancelGestures); document.addEventListener('visibilitychange', visibility); raf = requestAnimationFrame(frame);
  return { goTo, resetView, activate, setPaused(value) { paused = value; visibility(); }, reset(seed) {
    cancelGestures(); found.clear(); opened.clear(); collectTime.clear(); locations = discoveryLocations(seed); celebratedAt = -100; celebrationWave = 0; hoverId = null; hovered = null;
    habitats.scenery.forEach(p => { p.pulse = 0; }); creatures.forEach(c => { c.root.position.copy(c.home); c.pulse = 0; }); schools.reset(); effects.reset(); water.strength.value = 0;
    placeDiscoveries(); shell.lid.rotation.x = -0.08; keyCover.children.forEach((leaf, i) => { leaf.rotation.z = (i - 1) * 0.08; }); current = 0; goTo(0); resetView(); rig.update(0, 0, true); reportAt = -1;
  }, dispose() {
    disposed = true; cancelGestures(); cancelAnimationFrame(raf); observer.disconnect();
    canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('lostpointercapture', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('webglcontextlost', contextLost);
    window.removeEventListener('keydown', onKey); window.removeEventListener('blur', cancelGestures); document.removeEventListener('visibilitychange', visibility);
    creatures.forEach(c => { c.mixer?.stopAllAction(); if (c.mixer) c.mixer.uncacheRoot(c.mixer.getRoot()); });
    disposeObject(scene); Object.values(assets).forEach(a => disposeObject(a.scene)); environment.dispose(); clearMaterials(); renderer.dispose();
  } };
}
