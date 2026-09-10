import * as T from 'three';
import { SEAL_IDS, type RelicId } from './catalog';

// One small, generated calligraphy atlas serves every seal; no fonts or render targets.
function inscriptionAtlas() {
  const width = 512, height = 64, pixels = new Uint8Array(width * height * 4);
  const stroke = (ax: number, ay: number, bx: number, by: number, thickness: number) => {
    const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
    for (let y = Math.max(0, Math.floor(Math.min(ay, by) - 3)); y <= Math.min(height - 1, Math.ceil(Math.max(ay, by) + 3)); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(ax, bx) - 3)); x <= Math.min(width - 1, Math.ceil(Math.max(ax, bx) + 3)); x++) {
        const t = T.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / Math.max(0.01, length), 0, 1);
        const alpha = T.MathUtils.clamp(thickness + 0.8 - Math.hypot(x - ax - t * dx, y - ay - t * dy), 0, 1) * 255;
        const i = (y * width + x) * 4; pixels[i] = pixels[i + 1] = pixels[i + 2] = 255; pixels[i + 3] = Math.max(pixels[i + 3], alpha);
      }
    }
  };
  for (let glyph = 0; glyph < 16; glyph++) {
    const x = glyph * 32 + 4;
    const curve = (points: number[][], weight = 1) => {
      let px = points[0][0], py = points[0][1];
      for (let i = 1; i <= 18; i++) {
        const t = i / 18, s = 1 - t;
        const nx = s * s * points[0][0] + 2 * s * t * points[1][0] + t * t * points[2][0];
        const ny = s * s * points[0][1] + 2 * s * t * points[1][1] + t * t * points[2][1];
        stroke(x + px, py, x + nx, ny, weight); px = nx; py = ny;
      }
    };
    curve([[3, 13], [17 + glyph % 4, 3], [11, 49]], 1.2);
    curve([[11, 49], [2, 60], [23, 39]], 0.8);
    curve([[5, 29], [29, 9 + glyph % 3 * 7], [20, 43]], 0.9);
    if (glyph % 2) curve([[5, 36], [15, 24], [26, 31]], 0.8);
    else curve([[14, 18], [26, 39], [10, 38]], 0.8);
    stroke(x + 22, 9, x + 23, 11 + glyph % 4, 1);
  }
  const texture = new T.DataTexture(pixels, width, height);
  texture.wrapS = T.RepeatWrapping; texture.magFilter = texture.minFilter = T.LinearFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true; return texture;
}

export function createSeals(found: ReadonlySet<RelicId>) {
  const count = SEAL_IDS.length, root = new T.Group();
  const geometry = new T.RingGeometry(0.95, 1.05, 128, 1);
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv');
  for (let i = 0; i < positions.count; i++) uv.setXY(i, i % 129 / 128, Math.floor(i / 129));
  geometry.setAttribute('aSeal', new T.InstancedBufferAttribute(Float32Array.from(SEAL_IDS, (_, i) => i), 1));
  const progress = new Float32Array(count), broken = new Uint8Array(count);
  const material = new T.ShaderMaterial({ transparent: true, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uBreak: { value: progress }, uGlyphs: { value: inscriptionAtlas() }, uReduced: { value: 0 } },
    vertexShader: `attribute float aSeal; uniform float uTime; uniform float uBreak[${count}]; uniform float uReduced;
      varying vec2 vUv; varying float vBreak; varying float vSeal;
      void main(){vUv=uv;vBreak=uBreak[int(aSeal)];vSeal=aSeal;
      float direction=mod(aSeal,2.)<.5?1.:-1.;
      float angle=uv.x*6.2831853+uTime*(.08+aSeal*.008)*direction+aSeal*.27;
      float sector=floor(uv.x*12.);float breakup=vBreak*vBreak*(1.-uReduced);
      float radius=1.1+aSeal*.28+(length(position.xy)-1.)*2.;
      vec3 p=vec3(cos(angle)*radius,sin(angle)*radius,0.);
      p.z=sin(angle*2.+aSeal)*.09;
      float scatter=angle+sin(sector*12.7)*.4;
      p.xy+=vec2(cos(scatter),sin(scatter))*breakup*(1.+mod(sector,3.)*.4);
      p.z+=sin(sector*7.)*breakup*.7;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform sampler2D uGlyphs;uniform float uTime;varying vec2 vUv;varying float vBreak;varying float vSeal;
      void main(){if(vBreak>=1.)discard;
      float letters=texture2D(uGlyphs,vec2(vUv.x*2.+vSeal*.13,vUv.y)).a;
      float engraving=(1.-smoothstep(.012,.04,abs(vUv.y-.07)))+(1.-smoothstep(.012,.04,abs(vUv.y-.93)));
      float flame=.75+.25*sin(vUv.x*70.-uTime*1.7+vSeal);
      float gaps=smoothstep(.025,.065,fract(vUv.x*12.));
      float alpha=(letters*.9+engraving*.2)*flame*(1.-vBreak)*mix(1.,gaps,min(1.,vBreak*8.));
      vec3 gold=mix(vec3(1.,.5,.16),vec3(1.,.86,.48),letters);
      gl_FragColor=vec4(gold*(1.+sin(vBreak*3.14159)*1.5),alpha);}` });
  const rings = new T.InstancedMesh(geometry, material, count);
  rings.frustumCulled = false; rings.raycast = () => {}; root.add(rings);
  const matrix = new T.Matrix4(); for (let i = 0; i < count; i++) rings.setMatrixAt(i, matrix);
  function reset(saved: ReadonlySet<RelicId>) {
    SEAL_IDS.forEach((id, i) => { broken[i] = saved.has(id) ? 1 : 0; progress[i] = broken[i]; });
  }
  function breakSeal(id: RelicId) {
    const i = SEAL_IDS.indexOf(id as typeof SEAL_IDS[number]);
    if (i < 0 || broken[i]) return false;
    broken[i] = 1; progress[i] = 0; return true;
  }
  function update(dt: number, time: number, orientation: T.Quaternion, reduced: boolean) {
    root.quaternion.copy(orientation); material.uniforms.uTime.value = reduced ? 0 : time; material.uniforms.uReduced.value = reduced ? 1 : 0;
    for (let i = 0; i < count; i++) if (broken[i]) progress[i] = Math.min(1, progress[i] + dt / (reduced ? 0.25 : 1.25));
    rings.visible = progress.some(value => value < 1);
  }
  reset(found);
  return { root, count, progress, breakSeal, reset, update, remaining: () => broken.reduce((sum, value) => sum + 1 - value, 0) };
}
