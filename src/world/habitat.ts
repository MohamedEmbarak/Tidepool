import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { randomSequence } from './catalog';

export type Water = { time: { value: number }; point: { value: T.Vector3 }; strength: { value: number } };
export type Scenery = { root: T.Object3D; kind: 'rock' | 'plant' | 'structure'; home: T.Vector3; rotation: T.Euler; pulse: number; name: string };

export function waterMaterial(color: string, water: Water, plant = false) {
  const material = new T.MeshStandardMaterial({ color, roughness: plant ? 0.53 : 0.87, metalness: 0.02, side: plant ? T.DoubleSide : T.FrontSide });
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { uWaterTime: water.time, uTouch: water.point, uTouchStrength: water.strength });
    shader.vertexShader = 'varying vec3 vSeabed; uniform float uWaterTime; uniform vec3 uTouch; uniform float uTouchStrength;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vec3 waterPosition=(modelMatrix*vec4(position,1.)).xyz;
      ${plant ? `float bend=sin(uWaterTime*.8+waterPosition.z*.6+position.y*.9)*.065;
      bend+=exp(-distance(waterPosition,uTouch)*.55)*uTouchStrength*.3;
      transformed.x+=bend*max(0.,position.y); transformed.z+=sin(uWaterTime*.65+position.y)*max(0.,position.y)*.035;` : ''}
      vSeabed=(modelMatrix*vec4(transformed,1.)).xyz;`);
    shader.fragmentShader = 'varying vec3 vSeabed; uniform float uWaterTime; uniform vec3 uTouch; uniform float uTouchStrength;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float grain=fract(sin(dot(floor(vSeabed*43.),vec3(127.1,311.7,74.7)))*43758.5453);
      float ripple=sin(vSeabed.x*2.4+sin(vSeabed.z*2.+uWaterTime*.5))*sin(vSeabed.z*2.8-uWaterTime*.4);
      float caustic=pow(max(0.,ripple),8.);
      float touchLight=exp(-distance(vSeabed,uTouch)*.9)*uTouchStrength;
      float strata=sin(vSeabed.y*5.+sin(vSeabed.x*.7)+sin(vSeabed.z*.9))*.035;
      diffuseColor.rgb*=.86+grain*.07+strata+caustic*.24;
      diffuseColor.rgb+=vec3(.08,.16,.13)*touchLight;`);
  };
  material.customProgramCacheKey = () => `underwater-${plant ? 'leaf' : 'stone'}-1`;
  return material;
}

export function boulder(seed: number, size: [number, number, number], material: T.Material) {
  const source = new T.IcosahedronGeometry(1, 5); source.deleteAttribute('normal'); source.deleteAttribute('uv');
  const geometry = mergeVertices(source); source.dispose();
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    const coarse = Math.sin(x * 3.1 + seed) * Math.cos(z * 3.7 - seed * 0.4) * Math.sin(y * 2.8 + 1);
    const fine = Math.sin(x * 11 + seed) * Math.sin(y * 9 + z * 7);
    const scale = 1 + coarse * 0.22 + fine * 0.04;
    positions.setXYZ(i, x * scale * size[0], (y * scale + Math.sin(x * 3 + z * 2) * 0.06) * size[1], z * scale * size[2]);
  }
  geometry.computeVertexNormals();
  return new T.Mesh(geometry, material);
}

export function seaPlant(seed: number, height: number, material: T.Material) {
  const random = randomSequence(seed), parts: T.BufferGeometry[] = [];
  for (let stalk = 0; stalk < 3; stalk++) {
    const angle = stalk * 2.399 + seed, h = height * (0.7 + random() * 0.3);
    const stem = (t: number) => new T.Vector3(Math.cos(angle) * t * 0.7 + Math.sin(t * 4 + seed) * t * 0.3, h * t, Math.sin(angle) * t * 0.7);
    const curve = new T.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => stem(i / 11)));
    const tube = new T.TubeGeometry(curve, 20, 0.025, 5, false); tube.deleteAttribute('uv'); parts.push(tube);
    for (let leaf = 1; leaf <= 7; leaf++) {
      const base = stem(leaf / 9), turn = angle + leaf * 2.399;
      const direction = new T.Vector3(Math.cos(turn), 0, Math.sin(turn));
      const across = new T.Vector3(-Math.sin(turn), 0, Math.cos(turn));
      const length = h * (0.25 + random() * 0.1), width = h * 0.055;
      const vertices: number[] = [], indices: number[] = [];
      for (let row = 0; row <= 12; row++) {
        const t = row / 12, broad = Math.sin(t * Math.PI) * width * (0.85 + Math.sin(t * 20) * 0.15);
        for (let column = -1; column <= 1; column++) {
          const point = base.clone().addScaledVector(direction, t * length * 0.82).addScaledVector(across, column * broad);
          point.y += Math.sin(t * 2.4) * length * 0.52 + (column === 0 ? broad * 0.5 : 0);
          vertices.push(point.x, point.y, point.z);
        }
        if (row < 12) { const n = row * 3; indices.push(n,n+3,n+1,n+1,n+3,n+4,n+1,n+4,n+2,n+2,n+4,n+5); }
      }
      const blade = new T.BufferGeometry(); blade.setAttribute('position', new T.Float32BufferAttribute(vertices, 3)); blade.setIndex(indices); blade.computeVertexNormals(); parts.push(blade);
    }
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose());
  return new T.Mesh(geometry, material);
}

export function branchingCoral(seed: number, material: T.Material) {
  const random = randomSequence(seed), parts: T.BufferGeometry[] = [];
  const branch = (a: T.Vector3, b: T.Vector3, radius: number) => {
    const middle = a.clone().lerp(b, 0.5); middle.x += (random() - 0.5) * 0.2;
    const geo = new T.TubeGeometry(new T.CatmullRomCurve3([a, middle, b]), 7, radius, 6, false); geo.deleteAttribute('uv'); parts.push(geo);
    const tip = new T.SphereGeometry(radius * 1.15, 6, 4); tip.translate(b.x, b.y, b.z); tip.deleteAttribute('uv'); parts.push(tip);
  };
  for (let i = 0; i < 7; i++) {
    const a = i * 2.399, h = 0.7 + random() * 0.9;
    const top = new T.Vector3(Math.cos(a) * 0.6, h, Math.sin(a) * 0.6);
    branch(new T.Vector3(0, -0.15, 0), top, 0.07);
    for (let j = 0; j < 3; j++) {
      const origin = top.clone().multiplyScalar(0.45 + j * 0.16);
      const tip = origin.clone().add(new T.Vector3(Math.cos(a + j) * 0.4, 0.35, Math.sin(a + j) * 0.4));
      branch(origin, tip, 0.035);
    }
  }
  const geometry = mergeGeometries(parts)!; parts.forEach(g => g.dispose()); return new T.Mesh(geometry, material);
}

export function buildHabitats(water: Water) {
  const root = new T.Group(), scenery: Scenery[] = [];
  const register = (object: T.Object3D, kind: Scenery['kind'], name: string) => {
    const prop: Scenery = { root: object, home: object.position.clone(), rotation: object.rotation.clone(), pulse: 0, kind, name };
    object.userData.scenery = prop; object.traverse(o => { if (o instanceof T.Mesh) { o.userData.scenery = prop; o.userData.owner = object; } });
    root.add(object); scenery.push(prop); return prop;
  };
  const rocks = ['#526761', '#4b616b', '#445f54', '#384d64'].map(c => waterMaterial(c, water));
  const greens = ['#317e64', '#548d69', '#23625d', '#75a675'].map(c => waterMaterial(c, water, true));
  const corals = ['#c57978', '#b58ab8', '#d4a271', '#74b6a4'].map(c => waterMaterial(c, water, true));
  const floors = [6.8, 23, 45, 75, 103, 125];
  for (const [zone, depth] of floors.entries()) {
    const random = randomSequence(713 + zone * 113), color = rocks[Math.min(3, Math.floor(depth / 30))];
    const ground = boulder(zone + 5, [11.8, 1.6, 10.5], color); ground.position.set(0, -depth - 1.5, -1.5);
    register(ground, 'rock', 'Living limestone · stir the sand');
    for (let i = 0; i < 10; i++) {
      const a = i * 2.399 + zone, radius = 5.5 + random() * 3.8;
      const rock = boulder(zone * 100 + i, [0.8 + random() * 1.4, 0.65 + random() * 1.5, 0.8 + random() * 1.4], color);
      rock.position.set(Math.cos(a) * radius, -depth + random() * 0.3, Math.sin(a) * radius - 1.5);
      rock.rotation.y = random() * Math.PI; register(rock, 'rock', 'Reef stone · wake a cloud of sand');
    }
    for (let i = 0; i < 18; i++) {
      const a = i * 2.399 + zone * 0.3, radius = 4 + random() * 5;
      const kelp = zone === 3 || i % 3 !== 0;
      const plant = kelp ? seaPlant(zone * 31 + i, (zone === 3 ? 3.2 : 1.5) + random() * 2, greens[i % 4]) : branchingCoral(zone * 31 + i, corals[i % 4]);
      plant.position.set(Math.cos(a) * radius, -depth + 0.1, Math.sin(a) * radius - 1.5);
      plant.rotation.y = a; register(plant, 'plant', kelp ? 'Sea garden · brush the leaves' : 'Coral colony · follow the current');
    }
  }
  return { root, scenery, register, rockMaterial: rocks[0], plantMaterial: greens[3] };
}
