import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RELICS, type RelicId } from './catalog';

const materials = new Map<string, T.MeshStandardMaterial>();
export function material(color: string, glow = 0, metalness = 0.15) {
  const key = `${color}:${glow}:${metalness}`;
  if (!materials.has(key)) materials.set(key, new T.MeshStandardMaterial({ color, roughness: 0.48, metalness, emissive: color, emissiveIntensity: glow }));
  return materials.get(key)!;
}
export function clearMaterials() { materials.forEach((m) => m.dispose()); materials.clear(); }
export function mesh(geometry: T.BufferGeometry, color: string, position: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1], glow = 0) {
  const m = new T.Mesh(geometry, material(color, glow)); m.position.set(...position); m.scale.set(...scale); return m;
}
function ball(color: string, x = 0, y = 0, z = 0, r = 1, glow = 0) { return mesh(new T.SphereGeometry(r, 24, 16), color, [x, y, z], [1, 1, 1], glow); }
function ring(color: string, radius: number, tube: number, x = 0, y = 0, z = 0) { return mesh(new T.TorusGeometry(radius, tube, 8, 48), color, [x, y, z]); }
function line(points: T.Vector3[], radius: number, color: string, glow = 0) { return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points), 24, radius, 5, false), color, [0, 0, 0], [1, 1, 1], glow); }

export function relicModel(id: RelicId): T.Group {
  const g = new T.Group();
  if (id === 'pearl') {
    g.add(ball('#fff1db', 0, 0, 0, 0.34, 0.7));
    const halo = ring('#ffdaa4', 0.48, 0.014); halo.rotation.x = 0.6; g.add(halo);
  } else if (id === 'bottle') {
    const glass = new T.MeshPhysicalMaterial({ color: '#76d6c1', transparent: true, opacity: 0.48, roughness: 0.1, metalness: 0.05, side: T.DoubleSide, depthWrite: false });
    const body = new T.Mesh(new T.CylinderGeometry(0.29, 0.33, 0.85, 24), glass);
    g.add(body, mesh(new T.CylinderGeometry(0.14, 0.28, 0.25, 24), '#71c7b0', [0, 0.52, 0]), mesh(new T.CylinderGeometry(0.14, 0.14, 0.3, 16), '#8dbf9e', [0, 0.76, 0]));
    g.add(mesh(new T.CylinderGeometry(0.145, 0.14, 0.17, 12), '#ba8355', [0, 0.93, 0]));
    g.add(mesh(new T.CylinderGeometry(0.11, 0.11, 0.6, 16), '#f5deb3', [0, 0, 0.08]));
    const tag = mesh(new T.PlaneGeometry(0.28, 0.22), '#ead4a7', [0.1, 0.23, 0.35]); tag.rotation.z = -0.22; g.add(tag); g.rotation.z = -0.25;
  } else if (id === 'compass') {
    const face = mesh(new T.CylinderGeometry(0.53, 0.53, 0.14, 40), '#344e51'); face.rotation.x = Math.PI / 2; g.add(face);
    g.add(ring('#e9b66f', 0.53, 0.06), ring('#b08652', 0.4, 0.012, 0, 0, 0.1), ring('#dbac6a', 0.12, 0.035, 0, 0.69, 0));
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const mark = mesh(new T.BoxGeometry(0.024, i % 3 ? 0.055 : 0.12, 0.015), '#e2c59b', [Math.sin(a) * 0.44, Math.cos(a) * 0.44, 0.1]); mark.rotation.z = -a; g.add(mark); }
    const needle = mesh(new T.ConeGeometry(0.09, 0.4, 4), '#ff9878', [0, 0.14, 0.16]); needle.rotation.z = -0.4; g.add(needle, ball('#f8dfa2', 0, 0, 0.2, 0.065));
  } else if (id === 'key') {
    g.add(ring('#d4c487', 0.28, 0.085, 0, 0.35, 0));
    g.add(mesh(new T.CylinderGeometry(0.065, 0.065, 0.88, 12), '#d4c487', [0, -0.23, 0]));
    g.add(mesh(new T.BoxGeometry(0.24, 0.1, 0.12), '#d4c487', [0.1, -0.61, 0]), mesh(new T.BoxGeometry(0.1, 0.2, 0.12), '#d4c487', [0.19, -0.56, 0]));
    g.rotation.z = -0.5;
  } else if (id === 'lantern') {
    g.add(mesh(new T.CylinderGeometry(0.37, 0.27, 0.2, 6), '#597d98', [0, -0.5, 0]), mesh(new T.ConeGeometry(0.42, 0.32, 6), '#79a1b9', [0, 0.54, 0]), ring('#a0cbdb', 0.15, 0.035, 0, 0.86, 0));
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; g.add(mesh(new T.CylinderGeometry(0.025, 0.025, 0.9, 6), '#8aafbe', [Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3])); }
    g.add(ball('#b7e8ff', 0, 0, 0, 0.22, 2.4));
  } else {
    g.add(mesh(new T.IcosahedronGeometry(0.43, 1), '#d0bcff', [0, 0, 0], [1, 1, 1], 0.9));
    for (let i = 0; i < 3; i++) { const r = ring('#c1b0e2', 0.65 + i * 0.1, 0.018); r.rotation.set(i * 0.6, i * 0.7, 0.3); g.add(r); }
  }
  return g;
}

export function shellModel() {
  const group = new T.Group(); const lid = new T.Group();
  const lower = mesh(new T.SphereGeometry(0.95, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), '#c997b4', [0, -0.28, 0], [1, 0.38, 0.75]); lower.rotation.x = Math.PI; group.add(lower);
  const upper = mesh(new T.SphereGeometry(0.95, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), '#e0b0b9', [0, 0, 0], [1, 0.4, 0.75]); lid.add(upper);
  for (let i = 0; i < 9; i++) {
    const x = (i - 4) * 0.19;
    lid.add(line([new T.Vector3(0, 0.05, -0.65), new T.Vector3(x * 0.65, 0.4 - Math.abs(x) * 0.2, -0.2), new T.Vector3(x, 0.1, Math.sqrt(0.8 - x * x) * 0.7)], 0.023, '#f5c8c6'));
  }
  lid.position.y = -0.28; group.add(lid); return { group, lid };
}

function merged(parts: T.Mesh[], color: string) {
  const geometries = parts.map((p) => { p.updateMatrix(); const geom = p.geometry.clone().applyMatrix4(p.matrix); p.geometry.dispose(); return geom; });
  geometries.forEach((g) => g.deleteAttribute('uv'));
  const geo = mergeGeometries(geometries); geometries.forEach((g) => g.dispose());
  return mesh(geo!, color);
}

export function reef(seed: number, color: string) {
  const g = new T.Group(); const rocks: T.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const n = Math.sin(i * 73.31 + seed) * 0.5 + 0.5;
    const geo = new T.IcosahedronGeometry(1, 2);
    const positions = geo.getAttribute('position');
    for (let j = 0; j < positions.count; j++) {
      const x = positions.getX(j), y = positions.getY(j), z = positions.getZ(j);
      const noise = 1 + Math.sin(x * 7 + seed) * Math.sin(y * 8 + z * 4) * 0.1;
      positions.setXYZ(j, x * noise, y * noise, z * noise);
    }
    geo.computeVertexNormals();
    const r = mesh(geo, color, [(i % 5 - 2) * 1.15 + n * 0.3, -Math.floor(i / 5) * 0.54 - n * 0.15, -n * 1.1], [0.75 + n * 0.7, 0.3 + n * 0.35, 0.65 + n]);
    r.rotation.set(n * 0.35, n * 2, n * 0.2); rocks.push(r);
  }
  const combined = merged(rocks, color);
  const rockMaterial = new T.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0 });
  rockMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = 'varying vec3 vRock;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRock = position;');
    shader.fragmentShader = 'varying vec3 vRock;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat grain=sin(vRock.x*57.)*sin(vRock.y*69.)*sin(vRock.z*81.); float strata=sin(vRock.y*32.+sin(vRock.x*3.)); diffuseColor.rgb *= .86 + grain*.07+strata*.07;');
  };
  combined.material = rockMaterial; g.add(combined); return g;
}

export function coral(color: string, seed: number) {
  const parts: T.Mesh[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 7 - 0.5) * 1.9; const h = 1 + (Math.sin(seed + i * 13) * 0.5 + 0.5) * 1.1;
    const limb = mesh(new T.CylinderGeometry(0.045, 0.12, h, 7), color, [Math.sin(a) * h * 0.4, h * 0.45, 0]); limb.rotation.z = -a * 0.6; parts.push(limb);
    for (let j = 0; j < 2; j++) { const twig = mesh(new T.CylinderGeometry(0.015, 0.06, 0.5, 6), color, [Math.sin(a) * h * 0.5 + (j ? 0.2 : -0.2), h * 0.65, 0]); twig.rotation.z = j ? -0.65 : 0.65; parts.push(twig); }
  }
  return merged(parts, color);
}

export function frond(color: string, height: number, phase: number) {
  const verts: number[] = []; const indices: number[] = [];
  const stem = (p: number) => new T.Vector3(Math.sin(p * 5 + phase) * p * 0.45, p * height, Math.sin(p * 4 + phase) * 0.25);
  const blade = (base: T.Vector3, direction: number, length: number, broad: number) => {
    const offset = verts.length / 3;
    for (let i = 0; i <= 16; i++) {
      const p = i / 16, width = Math.sin(p * Math.PI) * broad;
      const x = base.x + direction * p * length * 0.7;
      const y = base.y + Math.sin(p * 1.8) * length * 0.6;
      const z = base.z + Math.sin(p * 3 + phase) * p * 0.35;
      verts.push(x-width, y, z, x, y + width*.25, z + width*.6, x+width, y, z);
      if (i < 16) { const n = offset + i * 3; indices.push(n,n+1,n+3,n+1,n+4,n+3,n+1,n+2,n+4,n+2,n+5,n+4); }
    }
  };
  for (let i = 1; i < 8; i++) {
    const p = i / 9;
    blade(stem(p), i % 2 ? -1 : 1, height * (0.16 + Math.sin(i + phase) * 0.035), 0.11 + height * 0.018);
  }
  blade(stem(0.78), Math.sin(phase), height * 0.34, 0.16);
  const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(verts, 3)); geo.setIndex(indices); geo.computeVertexNormals();
  const points = Array.from({length: 20}, (_, i) => stem(i/19));
  const stalk = new T.TubeGeometry(new T.CatmullRomCurve3(points), 28, 0.025, 5, false); stalk.deleteAttribute('uv');
  const combined = mergeGeometries([geo, stalk])!; geo.dispose(); stalk.dispose();
  const m = new T.MeshStandardMaterial({ color, roughness: 0.64, metalness: 0.05, side: T.DoubleSide }); return new T.Mesh(combined, m);
}

export function jelly(color: string, seed: number) {
  const g = new T.Group();
  const cap = mesh(new T.SphereGeometry(0.7, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2 + 0.15), color, [0, 0, 0], [1, 0.68, 1], 0.45);
  cap.material = new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, transparent: true, opacity: 0.6, roughness: 0.2, side: T.DoubleSide, depthWrite: false }); g.add(cap);
  const rim = ring(color, 0.68, 0.028); rim.rotation.x = Math.PI / 2; g.add(rim, ball(color, 0, 0.15, 0, 0.16, 1));
  const parts: T.Mesh[] = [];
  for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.17; parts.push(line([new T.Vector3(x, 0, 0), new T.Vector3(x + Math.sin(seed + i) * 0.25, -0.5, 0), new T.Vector3(x - 0.15, -1.1 - Math.sin(i) * 0.3, 0.1), new T.Vector3(x + 0.05, -1.65 - Math.sin(i) * 0.25, 0)], 0.014, color)); }
  g.add(merged(parts, color)); return g;
}

export function wreck() {
  const g = new T.Group(); const parts: T.Mesh[] = [];
  for (let i = 0; i < 12; i++) { const x = (i - 5.5) * 0.52; const plank = mesh(new T.BoxGeometry(0.43, 0.13, 2.1), '#816b61', [x, x * x * 0.075, 0]); plank.rotation.z = x * 0.1; parts.push(plank); }
  for (let side = -1; side <= 1; side += 2) for (let i = 0; i < 6; i++) { const rib = mesh(new T.BoxGeometry(0.12, 1.2, 0.12), '#816b61', [(i - 2.5) * 0.95, 0.55, side * 0.85]); rib.rotation.z = (i - 2.5) * -0.13; parts.push(rib); }
  parts.push(mesh(new T.CylinderGeometry(0.06, 0.1, 3.8, 8), '#816b61', [-0.9, 1.5, 0]));
  g.add(merged(parts, '#816b61'));
  const sail = mesh(new T.PlaneGeometry(1.7, 2.1, 1, 1), '#758787', [0, 1.8, -0.2]); sail.rotation.z = -0.15; (sail.material as T.MeshStandardMaterial).side = T.DoubleSide; g.add(sail); g.rotation.set(0.32, -0.18, -0.12); return g;
}

export function arch() {
  const g = new T.Group();
  for (let i = 0; i < 11; i++) { const a = i / 10 * Math.PI; const stone = mesh(new T.BoxGeometry(0.72, 0.78, 0.7), i % 2 ? '#35506a' : '#405975', [Math.cos(a) * 2.4, Math.sin(a) * 2.4, -1]); stone.rotation.z = a; g.add(stone); }
  for (const x of [-2.4, 2.4]) g.add(mesh(new T.CylinderGeometry(0.32, 0.43, 2.7, 7), '#3b526b', [x, -1.2, -1])); return g;
}

export function whale() {
  const g = new T.Group(); const body = mesh(new T.SphereGeometry(1, 40, 24), '#8dbbdc', [0, 0, 0], [3.4, 1.1, 0.95], 0.15);
  const skin = new T.MeshStandardMaterial({ color: '#749fc5', emissive: '#527aa9', emissiveIntensity: 0.5, transparent: true, opacity: 0.8, roughness: 0.4 }); body.material = skin; g.add(body);
  for (const side of [-1, 1]) { const fin = mesh(new T.SphereGeometry(1, 18, 12), '#90bcdb', [2.9, side * 0.6, 0], [1.1, 0.25, 0.18], 0.4); fin.rotation.z = side * 0.5; g.add(fin); }
  const fin = mesh(new T.SphereGeometry(1, 18, 12), '#6494b9', [-0.8, -1, 0.3], [0.4, 1.15, 0.2]); fin.rotation.z = -0.65; g.add(fin, ball('#e8faff', -2.3, 0.15, 0.82, 0.09, 3));
  for (let i = 0; i < 26; i++) { const x = Math.sin(i * 16.3) * 2.7; const y = Math.cos(i * 7.7) * 0.7; g.add(ball('#bbdfff', x, y, 0.85, 0.025 + i % 3 * 0.009, 2)); }
  return g;
}

export function makeRelics() {
  return RELICS.map((relic) => {
    const group = new T.Group(); group.position.set(relic.x, -relic.depth, 1.3);
    const model = relicModel(relic.id); group.add(model);
    const hit = new T.Mesh(new T.SphereGeometry(0.9, 12, 8), new T.MeshBasicMaterial({ visible: false }));
    hit.userData.relic = relic.id; group.add(hit); return { relic, group, model, hit };
  });
}
