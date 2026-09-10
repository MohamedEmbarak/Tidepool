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
  } else if (id === 'amber') {
    g.add(mesh(new T.IcosahedronGeometry(0.38, 2), '#ffc46b', [0, 0, 0], [0.8, 1.1, 0.75], 0.55));
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const ray = mesh(new T.ConeGeometry(0.045, 0.24, 5), '#ffe4a1', [Math.sin(a) * 0.37, Math.cos(a) * 0.37, 0]); ray.rotation.z = -a; g.add(ray); }
  } else if (id === 'medallion') {
    const disk = mesh(new T.CylinderGeometry(0.48, 0.48, 0.11, 32), '#d4a258'); disk.rotation.x = Math.PI / 2; g.add(disk);
    g.add(ring('#ffe0a0', 0.4, 0.018, 0, 0, 0.07));
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 0.4; g.add(ball('#daefff', Math.sin(a) * 0.26, Math.cos(a) * 0.26, 0.08, 0.035, 0.4)); }
    g.add(ring('#ceaa71', 0.11, 0.027, 0, 0.61, 0));
  } else if (id === 'rune') {
    g.add(mesh(new T.DodecahedronGeometry(0.52), '#365263', [0, 0, 0], [0.82, 1.2, 0.35]));
    g.add(line([new T.Vector3(-0.17, -0.28, 0.2), new T.Vector3(0, 0.32, 0.2), new T.Vector3(0.17, -0.1, 0.2)], 0.022, '#b1fbeb', 1.5));
    g.add(line([new T.Vector3(-0.12, 0.05, 0.2), new T.Vector3(0.19, 0.17, 0.2)], 0.018, '#b1fbeb', 1.5));
  } else {
    g.add(mesh(new T.IcosahedronGeometry(0.43, 1), '#d0bcff', [0, 0, 0], [1, 1, 1], 0.9));
  }
  return g;
}

export function shellModel() {
  const group = new T.Group(), lid = new T.Group(), hinge = new T.Vector3(0, -0.02, -0.65);
  const shellMaterial = new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.08, clearcoat: 0.35, clearcoatRoughness: 0.3, side: T.DoubleSide });
  const innerMaterial = new T.MeshPhysicalMaterial({ color: '#ead6d0', roughness: 0.24, metalness: 0.12, iridescence: 0.45, iridescenceIOR: 1.25, side: T.DoubleSide });
  function valve(upper: boolean) {
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    const pink = new T.Color('#bf827d'), ivory = new T.Color('#ecd1b3'), tint = new T.Color();
    for (let row = 0; row <= 22; row++) for (let col = 0; col <= 64; col++) {
      const t = row / 22, angle = (col / 64 - 0.5) * 2.4;
      const rib = 0.5 + 0.5 * Math.cos(angle * 31), radius = t * (1.42 + rib * 0.035);
      const dome = Math.sin(t * Math.PI) * (0.26 + Math.cos(angle) * 0.05);
      positions.push(Math.sin(angle) * radius * 0.81, (upper ? 1 : -1) * (dome + rib * 0.04 * Math.sin(t * Math.PI)), Math.cos(angle) * radius);
      tint.copy(pink).lerp(ivory, 0.22 + t * 0.3 + rib * 0.25); colors.push(tint.r, tint.g, tint.b);
      if (row < 22 && col < 64) { const n = row * 65 + col; indices.push(n, n + 65, n + 1, n + 1, n + 65, n + 66); }
    }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    const root = new T.Group(), outside = new T.Mesh(geo, shellMaterial), insideGeo = geo.clone();
    insideGeo.translate(0, upper ? -0.025 : 0.025, 0);
    root.add(outside, new T.Mesh(insideGeo, innerMaterial)); return root;
  }
  const lower = valve(false); lower.position.copy(hinge); group.add(lower);
  lid.position.copy(hinge); lid.add(valve(true)); group.add(lid);
  return { group, lid };
}

function merged(parts: T.Mesh[], color: string) {
  const geometries = parts.map((p) => { p.updateMatrix(); const geom = p.geometry.clone().applyMatrix4(p.matrix); p.geometry.dispose(); return geom; });
  geometries.forEach((g) => g.deleteAttribute('uv'));
  const geo = mergeGeometries(geometries); geometries.forEach((g) => g.dispose());
  return mesh(geo!, color);
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

export function arch() {
  const g = new T.Group();
  for (let i = 0; i < 11; i++) { const a = i / 10 * Math.PI; const stone = mesh(new T.BoxGeometry(0.72, 0.78, 0.7), i % 2 ? '#35506a' : '#405975', [Math.cos(a) * 2.4, Math.sin(a) * 2.4, -1]); stone.rotation.z = a; g.add(stone); }
  for (const x of [-2.4, 2.4]) g.add(mesh(new T.CylinderGeometry(0.32, 0.43, 2.7, 7), '#3b526b', [x, -1.2, -1])); return g;
}

export function makeRelics() {
  return RELICS.map((relic) => {
    const group = new T.Group(); group.position.set(0, -relic.depth, 0);
    const model = relicModel(relic.id); group.add(model);
    const hit = new T.Mesh(new T.SphereGeometry(0.9, 12, 8), new T.MeshBasicMaterial({ visible: false }));
    hit.userData.relic = relic.id; group.add(hit); return { relic, group, model, hit };
  });
}
