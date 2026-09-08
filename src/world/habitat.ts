import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MAX_DEPTH, randomSequence } from './catalog';

export type Water = { time: { value: number }; point: { value: T.Vector3 }; strength: { value: number } };
export type Scenery = { root: T.Object3D; kind: 'rock' | 'plant' | 'structure'; home: T.Vector3; rotation: T.Euler; pulse: number; name: string; anchored: boolean };
export const SEABED_DEPTH = MAX_DEPTH + 5;

function noise(x: number, y: number, z: number, seed: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (v: number) => v * v * (3 - 2 * v);
  const u = smooth(x - ix), v = smooth(y - iy), w = smooth(z - iz);
  const hash = (a: number, b: number, c: number) => { const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 13.1) * 43758.5453; return n - Math.floor(n); };
  const mix = T.MathUtils.lerp;
  return mix(mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), u), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), u), v), mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), u), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), u), v), w);
}

export function seabedHeight(x: number, z: number) {
  return -SEABED_DEPTH + Math.sin(x * 0.13 + z * 0.08) * 0.3 + Math.sin(z * 0.27 - x * 0.06) * 0.16;
}

export function waterMaterial(color: string, water: Water, plant = false, sand = false) {
  const material = new T.MeshStandardMaterial({ color, vertexColors: true, roughness: plant ? 0.58 : 0.94, metalness: 0, side: plant ? T.DoubleSide : T.FrontSide, transparent: sand, depthWrite: !sand });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uWaterTime: water.time, uTouch: water.point, uTouchStrength: water.strength });
    shader.vertexShader = 'varying vec3 vSeabed; uniform float uWaterTime; uniform vec3 uTouch; uniform float uTouchStrength;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 waterLocal=position;
      #ifdef USE_INSTANCING
        waterLocal=(instanceMatrix*vec4(waterLocal,1.)).xyz;
      #endif
      vec3 waterPosition=(modelMatrix*vec4(waterLocal,1.)).xyz;
      ${plant ? `float rooted=max(0.,position.y);
      vec2 away=waterPosition.xz-uTouch.xz;
      float touch=exp(-length(waterPosition-uTouch)*.6)*uTouchStrength;
      transformed.x+=(sin(uWaterTime*.7+waterPosition.z*.5+position.y*.7)*.075+touch*away.x/(1.+length(away))*.22)*rooted;
      transformed.z+=(cos(uWaterTime*.58+waterPosition.x*.4+position.y*.65)*.055+touch*away.y/(1.+length(away))*.22)*rooted;` : ''}
      vec3 waterFinal=transformed;
      #ifdef USE_INSTANCING
        waterFinal=(instanceMatrix*vec4(waterFinal,1.)).xyz;
      #endif
      vSeabed=(modelMatrix*vec4(waterFinal,1.)).xyz;`);
    shader.fragmentShader = 'varying vec3 vSeabed; uniform float uWaterTime; uniform vec3 uTouch; uniform float uTouchStrength;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain=fract(sin(dot(floor(vSeabed*85.),vec3(127.1,311.7,74.7)))*43758.5453);
      float seam=sin(vSeabed.y*8.+sin(vSeabed.x*1.7)*1.5+sin(vSeabed.z*1.3));
      float ripples=sin(vSeabed.x*9.+sin(vSeabed.z*.8)*2.+sin(vSeabed.z*2.)*.35);
      float relief=${plant ? '0.' : sand ? 'ripples*.012' : 'seam*.007'};
      float caustic=pow(max(0.,sin(vSeabed.x*2.4+sin(vSeabed.z*2.+uWaterTime*.5))*sin(vSeabed.z*2.8-uWaterTime*.4)),8.);
      float touchLight=exp(-distance(vSeabed,uTouch)*.8)*uTouchStrength;
      diffuseColor.rgb*= ${plant ? '.94+grain*.06' : sand ? '.88+ripples*.065+grain*.08' : '.89+grain*.07+relief*2.'};
      diffuseColor.rgb+=vec3(.06,.13,.12)*(caustic*.8+touchLight);
      ${sand ? 'diffuseColor.a*=1.-smoothstep(38.,70.,length(vViewPosition));' : ''}`);
    if (!plant) shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
      vec3 rx=cross(dy,normal),ry=cross(normal,dx);
      float determinant=dot(dx,rx);
      vec3 gradient=sign(determinant)*(dFdx(relief)*rx+dFdy(relief)*ry);
      normal=normalize(abs(determinant)*normal-gradient);`);
  };
  material.customProgramCacheKey = () => `underwater-${plant ? 'leaf' : sand ? 'sand' : 'stone'}-2`;
  return material;
}

export function boulder(seed: number, size: [number, number, number], material: T.Material, detail = 9) {
  const source = new T.IcosahedronGeometry(1, detail); source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const geometry = mergeVertices(source); source.dispose();
  const positions = geometry.getAttribute('position'), colors: number[] = [];
  const random = randomSequence(seed), cuts = Array.from({ length: 5 }, () => ({ normal: new T.Vector3(random() - 0.5, random() * 0.8, random() - 0.5).normalize(), limit: 0.75 + random() * 0.23 }));
  const vertex = new T.Vector3(), color = new T.Color(), base = new T.Color('#bec1ad'), patinaColor = new T.Color('#667866');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const shape = (a: number) => Math.sign(a) * Math.pow(Math.abs(a), 0.78);
    vertex.set(shape(x), shape(y), shape(z));
    for (const cut of cuts) { const excess = vertex.dot(cut.normal) - cut.limit; if (excess > 0) vertex.addScaledVector(cut.normal, -excess * 0.86); }
    const erosion = (noise(x * 3.8, y * 3.8, z * 3.8, seed) - 0.5) * 0.16 + (noise(x * 13, y * 13, z * 13, seed) - 0.5) * 0.035;
    vertex.multiplyScalar(1 + erosion);
    // A buried, flattened foot seats every rock on the terrain.
    vertex.set(vertex.x * size[0], (Math.max(-0.7, vertex.y) + 0.7) * size[1], vertex.z * size[2]);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
    color.copy(base).lerp(patinaColor, noise(x * 3 + 8, y * 4, z * 3, seed + 41) * 0.7);
    color.multiplyScalar(0.65 + Math.min(1, vertex.y / size[1]) * 0.3); colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return new T.Mesh(geometry, material);
}

function colored(geometry: T.BufferGeometry, tint: T.Color) {
  geometry.deleteAttribute('uv');
  const count = geometry.getAttribute('position').count, colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) tint.toArray(colors, i * 3);
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); return geometry;
}

function blade(base: T.Vector3, angle: number, length: number, width: number, lean: number, phase: number, grass = false) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = [];
  const rows = 24, columns = 6, dark = new T.Color('#4f6f42'), light = new T.Color('#b0c586'), tint = new T.Color();
  for (let row = 0; row <= rows; row++) {
    const t = row / rows, spread = width * Math.pow(Math.sin(Math.PI * t), grass ? 0.62 : 0.85);
    const turn = angle + Math.sin(t * 3 + phase) * t * 0.45;
    const reach = length * (lean * t * t + Math.sin(t * 3) * 0.12);
    for (let col = 0; col <= columns; col++) {
      const s = col / columns * 2 - 1, ruffle = Math.sin(t * 24 + phase + s) * spread * Math.pow(Math.abs(s), 2) * 0.22;
      positions.push(base.x + Math.cos(angle) * reach - Math.sin(turn) * s * spread,
        base.y + length * (t - t * t * (grass ? 0.26 : 0.4)) + spread * (1 - s * s) * 0.22 + ruffle,
        base.z + Math.sin(angle) * reach + Math.cos(turn) * s * spread);
      tint.copy(dark).lerp(light, 0.28 + Math.sin(t * Math.PI) * 0.42 + Math.abs(s) * 0.15 - (Math.abs(s) < 0.1 ? 0.15 : 0));
      colors.push(tint.r, tint.g, tint.b);
      if (row < rows && col < columns) { const n = row * (columns + 1) + col; indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1); }
    }
  }
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

function combine(parts: T.BufferGeometry[], material: T.Material) {
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); geometry.computeBoundingSphere(); return new T.Mesh(geometry, material);
}

export function seaPlant(seed: number, height: number, material: T.Material) {
  const random = randomSequence(seed), parts: T.BufferGeometry[] = [], stemColor = new T.Color('#7b854b');
  for (let stalk = 0; stalk < 3; stalk++) {
    const angle = stalk * 2.399 + random() * 0.5, h = height * (0.64 + random() * 0.36);
    const stem = (t: number) => new T.Vector3(Math.cos(angle) * t * t * h * 0.2, h * t, Math.sin(angle) * t * t * h * 0.2);
    const curve = new T.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => stem(i / 11)));
    parts.push(colored(new T.TubeGeometry(curve, 24, 0.018, 5, false), stemColor));
    for (let leaf = 0; leaf < 5; leaf++) {
      const base = stem(0.18 + leaf * 0.145), turn = angle + leaf * 2.399;
      parts.push(blade(base, turn, h * (0.33 + random() * 0.13), h * 0.055, 0.65 + random() * 0.5, random() * 6));
      const bladder = new T.SphereGeometry(0.055, 7, 5); bladder.scale(0.7, 1.35, 0.7); bladder.translate(base.x, base.y + 0.04, base.z); parts.push(colored(bladder, stemColor));
    }
    parts.push(blade(stem(0.88), angle + 1.2, h * 0.4, h * 0.065, 0.6, seed));
  }
  return combine(parts, material);
}

export function seaGrass(seed: number, height: number, material: T.Material) {
  const random = randomSequence(seed), parts: T.BufferGeometry[] = [];
  for (let i = 0; i < 13; i++) {
    const angle = i * 2.399, radius = random() * 0.3;
    parts.push(blade(new T.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius), angle, height * (0.5 + random() * 0.5), 0.035 + random() * 0.035, 0.2 + random() * 0.5, random() * 6, true));
  }
  return combine(parts, material);
}

export function branchingCoral(seed: number, material: T.Material) {
  const random = randomSequence(seed), parts: T.BufferGeometry[] = [], tint = new T.Color('#dac0a9');
  const branch = (start: T.Vector3, direction: T.Vector3, length: number, radius: number, level: number) => {
    const end = start.clone().addScaledVector(direction, length), middle = start.clone().lerp(end, 0.5); middle.z += (random() - 0.5) * 0.15;
    const curve = new T.CatmullRomCurve3([start, middle, end]);
    const tube = new T.TubeGeometry(curve, 6, radius, 5, false), pos = tube.getAttribute('position');
    for (let row = 0; row <= 6; row++) {
      const centre = curve.getPointAt(row / 6);
      for (let col = 0; col <= 5; col++) { const i = row * 6 + col, taper = 1 - row / 6 * 0.35; pos.setXYZ(i, centre.x + (pos.getX(i) - centre.x) * taper, centre.y + (pos.getY(i) - centre.y) * taper, centre.z + (pos.getZ(i) - centre.z) * taper); }
    }
    tube.computeVertexNormals(); parts.push(colored(tube, tint));
    if (level > 0) for (const side of [-1, 1]) {
      const next = direction.clone().applyAxisAngle(new T.Vector3(0, 0, 1), side * (0.25 + random() * 0.35)); next.z += (random() - 0.5) * 0.25; next.normalize();
      branch(end, next, length * (0.62 + random() * 0.15), radius * 0.65, level - 1);
    } else { const tip = new T.SphereGeometry(radius * 0.8, 5, 4); tip.translate(end.x, end.y, end.z); parts.push(colored(tip, new T.Color('#fae4cf'))); }
  };
  for (let i = -2; i <= 2; i++) branch(new T.Vector3(), new T.Vector3(i * 0.32, 1, (random() - 0.5) * 0.3).normalize(), 0.55 + random() * 0.3, 0.045, 3);
  return combine(parts, material);
}

export function buildHabitats(water: Water) {
  const root = new T.Group(), scenery: Scenery[] = [];
  const register = (object: T.Object3D, kind: Scenery['kind'], name: string, anchored = false) => {
    const prop: Scenery = { root: object, home: object.position.clone(), rotation: object.rotation.clone(), pulse: 0, kind, name, anchored };
    object.userData.scenery = prop; object.traverse(o => { if (o instanceof T.Mesh) { o.userData.scenery = prop; o.userData.owner = object; } });
    root.add(object); scenery.push(prop); return prop;
  };
  const rocks = ['#8c9890', '#6d7d83', '#839080'].map(c => waterMaterial(c, water));
  const greens = ['#477d68', '#65885f', '#92976a', '#488e81'].map(c => waterMaterial(c, water, true));
  const corals = ['#b58586', '#b291ae', '#b98e70'].map(c => waterMaterial(c, water, true));
  const sand = waterMaterial('#657d80', water, false, true);
  const floorGeometry = new T.PlaneGeometry(150, 150, 100, 100); floorGeometry.rotateX(-Math.PI / 2);
  const positions = floorGeometry.getAttribute('position'), colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), shade = 0.77 + noise(x * 0.13, 0, z * 0.13, 23) * 0.2;
    positions.setY(i, seabedHeight(x, z) + SEABED_DEPTH); colors.push(shade, shade, shade * 0.94);
  }
  floorGeometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); floorGeometry.computeVertexNormals();
  const floor = new T.Mesh(floorGeometry, sand); floor.position.y = -SEABED_DEPTH; floor.renderOrder = -1; floor.userData.maxPickDistance = 70; register(floor, 'rock', 'Ocean floor · stir the sand', true);
  const random = randomSequence(8267), shadowParts: T.BufferGeometry[] = [];
  const groundShadow = (x: number, z: number, radius: number) => {
    const geometry = new T.PlaneGeometry(radius * 2, radius * 2, 4, 4); geometry.rotateX(-Math.PI / 2); geometry.translate(x, 0, z);
    const vertices = geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) vertices.setY(i, seabedHeight(vertices.getX(i), vertices.getZ(i)) + SEABED_DEPTH + 0.018);
    shadowParts.push(geometry);
  };
  for (let i = 0; i < 30; i++) {
    const angle = i * 2.399, radius = 6.5 + random() * 15, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, scale = 0.9 + random() * 1.1;
    const rock = boulder(817 + i, [scale * (1.1 + random() * 0.7), scale * (0.6 + random() * 0.6), scale * (0.8 + random() * 0.5)], rocks[i % rocks.length]);
    rock.position.set(x, seabedHeight(x, z) - 0.12, z); rock.rotation.y = random() * Math.PI * 2;
    register(rock, 'rock', 'Weathered limestone · wake a cloud of sand');
    groundShadow(x, z, scale * 2.3);
  }
  const pebbleSource = boulder(419, [1, 0.6, 0.8], rocks[1], 3);
  const pebbles = new T.InstancedMesh(pebbleSource.geometry, rocks[1], 100), transform = new T.Object3D();
  for (let i = 0; i < pebbles.count; i++) {
    const angle = random() * Math.PI * 2, radius = 4.8 + random() * 24, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    transform.position.set(x, seabedHeight(x, z) + SEABED_DEPTH - 0.06, z); transform.rotation.y = random() * Math.PI * 2;
    transform.scale.setScalar(0.08 + random() * 0.23); transform.updateMatrix(); pebbles.setMatrixAt(i, transform.matrix);
  }
  pebbles.position.y = -SEABED_DEPTH; register(pebbles, 'rock', 'Shell gravel · stir the sand', true);
  for (let i = 0; i < 52; i++) {
    const angle = i * 2.399 + 0.7, radius = 5.5 + random() * 16, x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, type = i % 6;
    const plant = type === 0 ? branchingCoral(207 + i, corals[Math.floor(i / 6) % 3]) : type < 3 ? seaPlant(207 + i, 2.8 + random() * 3.4, greens[i % 4]) : seaGrass(207 + i, 1.2 + random() * 1.7, greens[i % 4]);
    plant.position.set(x, seabedHeight(x, z) - 0.04, z); plant.rotation.y = angle;
    register(plant, 'plant', type === 0 ? 'Sea fan · follow the current' : type < 3 ? 'Ribbon kelp · brush the blades' : 'Seagrass · brush the meadow', true);
    groundShadow(x, z, type < 3 ? 0.85 : 0.6);
  }
  const pixels = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4, radius = Math.hypot((x - 15.5) / 15.5, (y - 15.5) / 15.5);
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255; pixels[i + 3] = Math.pow(Math.max(0, 1 - radius), 1.4) * 255;
  }
  const shadowMap = new T.DataTexture(pixels, 32, 32); shadowMap.magFilter = shadowMap.minFilter = T.LinearFilter; shadowMap.needsUpdate = true;
  const shadows = combine(shadowParts, new T.MeshBasicMaterial({ color: '#061e25', map: shadowMap, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  shadows.raycast = () => {}; floor.add(shadows);
  return { root, floor, scenery, register, plantMaterial: greens[3] };
}
