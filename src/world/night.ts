import * as T from 'three';
import { randomSequence } from './catalog';

// Two shared lights illuminate the swarms; individual motes stay in one draw call.
export function nightSwarms(ratio: number) {
  const root = new T.Group(), random = randomSequence(7138);
  const centers = [new T.Vector3(-4, 1.8, 3), new T.Vector3(4, -2, 2)];
  const lights = centers.map((center, i) => {
    const light = new T.PointLight(i ? '#a995ff' : '#73ffda', 0, 24, 1.6);
    light.position.copy(center); root.add(light); return light;
  });
  const positions = new Float32Array(128 * 3), groups = new Float32Array(128);
  for (let i = 0; i < 128; i++) {
    positions[i * 3] = (random() - 0.5) * 5;
    positions[i * 3 + 1] = (random() - 0.5) * 6;
    positions[i * 3 + 2] = (random() - 0.5) * 5;
    groups[i] = i % 2;
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  geometry.setAttribute('aSwarm', new T.BufferAttribute(groups, 1));
  const material = new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uRatio: { value: ratio }, uCenters: { value: centers } },
    vertexShader: `attribute float aSwarm; uniform vec3 uCenters[2]; uniform float uTime; uniform float uRatio;
      varying vec3 vColor; varying float vPulse;
      void main(){vec3 p=position;float phase=position.y*3.+position.x;
        p.x+=sin(uTime*.3+phase)*.7;p.y+=sin(uTime*.4+phase)*.5;
        p+=uCenters[int(aSwarm)];vColor=mix(vec3(.3,1.,.75),vec3(.65,.5,1.),aSwarm);
        vPulse=.65+.35*sin(uTime*.9+phase);vec4 mv=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mv;gl_PointSize=clamp(100./max(6.,-mv.z),3.,13.)*uRatio;}`,
    fragmentShader: `uniform float uNight;varying vec3 vColor;varying float vPulse;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        float glow=exp(-r*r*5.)*(1.-smoothstep(.7,1.,r));
        gl_FragColor=vec4(vColor+vec3(pow(1.-r,8.)),glow*vPulse*uNight*.8);}` });
  const motes = new T.Points(geometry, material); motes.frustumCulled = false; root.add(motes);
  return { root, update(time: number, night: number, focus: T.Vector3, reduced: boolean) {
    root.position.copy(focus);
    material.uniforms.uTime.value = reduced ? 0 : time;
    material.uniforms.uNight.value = night; motes.visible = night > 0.001;
    for (let i = 0; i < centers.length; i++) {
      centers[i].y = (i ? -2 : 1.8) + (reduced ? 0 : Math.sin(time * 0.22 + i * 2) * 0.6);
      lights[i].position.copy(centers[i]); lights[i].intensity = night * 22;
    }
  }, setPixelRatio(value: number) { material.uniforms.uRatio.value = value; } };
}
