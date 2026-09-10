import * as T from 'three';
import type { Water } from './habitat';
import { randomSequence } from './catalog';

export function waterEffects(water: Water, ratio: number) {
  const root = new T.Group(), random = randomSequence(441), capacity = 640;
  const positions = new Float32Array(capacity * 3), velocities = new Float32Array(capacity * 3), life = new Float32Array(capacity), colors = new Float32Array(capacity * 3);
  const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.BufferAttribute(positions, 3)); geometry.setAttribute('aLife', new T.BufferAttribute(life, 1)); geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
  const material = new T.ShaderMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uRatio: { value: ratio } },
    vertexShader: 'attribute float aLife; varying float vLife; varying vec3 vColor; uniform float uRatio; void main(){vLife=aLife;vColor=color;vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=clamp(100./max(8.,-p.z),2.,9.)*uRatio;}',
    fragmentShader: 'varying float vLife; varying vec3 vColor; void main(){float d=length(gl_PointCoord-.5); if(d>.5||vLife<=0.)discard;gl_FragColor=vec4(vColor, min(1.,vLife)*(1.-smoothstep(.2,.5,d)));}' });
  const particles = new T.Points(geometry, material); particles.frustumCulled = false; root.add(particles);
  let cursor = 0;
  function burst(point: T.Vector3, celebration = false, sand = false, reduced = false) {
    const count = reduced ? 12 : celebration ? 360 : sand ? 55 : 28;
    const color = new T.Color();
    for (let i = 0; i < count; i++) {
      const n = cursor++ % capacity, a = random() * Math.PI * 2, radius = celebration ? 1.6 : 0.3;
      positions[n * 3] = point.x + Math.cos(a) * radius; positions[n * 3 + 1] = point.y + (random() - 0.5) * radius; positions[n * 3 + 2] = point.z + Math.sin(a) * radius;
      velocities[n * 3] = Math.cos(a) * (celebration ? 3 + random() * 3 : 0.5) * (reduced ? 0.05 : 1);
      velocities[n * 3 + 1] = (celebration ? 1.5 + random() * 5 : sand ? 0.6 : 1.4) * (reduced ? 0.1 : 1);
      velocities[n * 3 + 2] = Math.sin(a) * (celebration ? 3 + random() * 3 : 0.5) * (reduced ? 0.05 : 1);
      life[n] = celebration ? 4 + random() * 2 : 1.4 + random();
      color.set(sand ? '#c3b89b' : celebration ? ['#ffe4a3', '#8cf2df', '#bea3ff'][i % 3] : '#93dcd7'); color.toArray(colors, n * 3);
    }
    geometry.getAttribute('color').needsUpdate = true;
  }
  const shaftMaterial = new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending,
    uniforms: { uTime: water.time, uTouch: water.strength, uDepth: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv;uniform float uTime;uniform float uTouch;uniform float uDepth;void main(){float edge=pow(sin(vUv.x*3.14159),3.);float fade=sin(vUv.y*3.14159);float shimmer=.7+.3*sin(vUv.y*12.+uTime*.4);gl_FragColor=vec4(.63,.91,.79,edge*fade*shimmer*(.018+uTouch*.006)*(1.-uDepth));}' });
  const shafts = new T.Group(); root.add(shafts);
  for (let i = 0; i < 7; i++) {
    const shaft = new T.Mesh(new T.CylinderGeometry(0.1, 1.7, 28, 10, 1, true), shaftMaterial);
    shaft.position.set(Math.cos(i * 2.399) * 8, 3, Math.sin(i * 2.399) * 8 - 3); shaft.rotation.z = -0.17 + i * 0.035; shafts.add(shaft);
  }
  function update(dt: number, depth: number, night = 0) {
    shaftMaterial.uniforms.uDepth.value = 1 - (1 - Math.min(1, depth / 65)) * (1 - night); shafts.visible = depth < 65 && night < 0.999;
    for (let i = 0; i < capacity; i++) {
      if (life[i] <= 0) continue; life[i] = Math.max(0, life[i] - dt);
      for (let axis = 0; axis < 3; axis++) positions[i * 3 + axis] += velocities[i * 3 + axis] * dt;
      velocities[i * 3] *= Math.exp(-dt * 0.65); velocities[i * 3 + 2] *= Math.exp(-dt * 0.65);
    }
    geometry.getAttribute('position').needsUpdate = true; geometry.getAttribute('aLife').needsUpdate = true;
  }
  function reset() { life.fill(0); geometry.getAttribute('aLife').needsUpdate = true; }
  return { root, burst, update, reset, setPixelRatio(value: number) { material.uniforms.uRatio.value = value; } };
}
