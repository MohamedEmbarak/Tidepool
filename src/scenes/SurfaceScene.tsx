'use client';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { clamp, pick, rand, rollReward } from '@/lib/reward';
import { usePlayground } from '@/lib/store';

/**
 * SURFACE — a tank of buoyant floats you can shove around.
 *
 * The interaction is deliberately the simplest one in the piece: push things,
 * they move, they bob back. No goal, no score, no failure state. This is the
 * onboarding contract — within about two seconds of arriving the user has
 * learned that everything here is touchable and nothing here can be broken.
 *
 * Physics notes:
 * - Gravity points *up* at a fraction of g, which is what "buoyancy" is when
 *   you only have a rigid-body solver. Combined with high linear damping it
 *   produces the slow, syrupy rise that reads as underwater.
 * - The pointer is a kinematic sphere that pushes the floats around. Using a
 *   real collider rather than an impulse-at-a-point means the contact feels
 *   continuous under a drag, not like a series of taps.
 */

const FLOAT_COUNT_DESKTOP = 14;
const FLOAT_COUNT_MOBILE = 9;

const PALETTE = ['#8ffff0', '#7fe3d4', '#a8e6ff', '#ffd6a0', '#c9b8ff'];

type FloatSpec = {
  key: number;
  position: [number, number, number];
  radius: number;
  color: string;
};

/**
 * The pointer, projected onto the z=0 plane and driven as a kinematic body.
 *
 * Its movement is speed-limited. A kinematic body's velocity is inferred by
 * the solver from how far it teleported since the last step, so an unclamped
 * pointer flicked across the viewport in one frame reads as hundreds of units
 * per second and launches everything it touches into the void. Capping the
 * step is what makes the hand feel like a hand rather than a railgun.
 */
const POINTER_MAX_STEP = 0.34; // world units per frame

function PointerBody() {
  const ref = useRef<RapierRigidBody>(null);
  const { viewport } = useThree();
  const target = useRef(new THREE.Vector3(0, -100, 0));
  const current = useRef(new THREE.Vector3(0, -100, 0));

  useFrame(({ pointer }) => {
    const body = ref.current;
    if (!body) return;

    // pointer is -1..1 in NDC; viewport gives world units at z=0.
    target.current.set(
      (pointer.x * viewport.width) / 2,
      (pointer.y * viewport.height) / 2,
      0,
    );

    const step = target.current.clone().sub(current.current);
    const dist = step.length();
    if (dist > POINTER_MAX_STEP) step.multiplyScalar(POINTER_MAX_STEP / dist);
    current.current.add(step);

    body.setNextKinematicTranslation(current.current);
  });

  return (
    <RigidBody ref={ref} type="kinematicPosition" colliders={false} name="pointer">
      <BallCollider args={[0.55]} />
    </RigidBody>
  );
}

/** Hard ceiling on how fast a float may travel, in world units/second. */
const MAX_SPEED = 8;

function Float({
  spec,
  limits,
  onHit,
}: {
  spec: FloatSpec;
  limits: { x: number; y: number };
  onHit: (speed: number) => void;
}) {
  const body = useRef<RapierRigidBody>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const squish = useRef(0);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);

  useFrame((state, delta) => {
    const m = mesh.current;
    const b = body.current;
    if (!m) return;

    // Neutral buoyancy: instead of a global "up" gravity — which just piles
    // every float against the ceiling within a few seconds and leaves the
    // tank empty — each float is sprung toward the spot it started at. The
    // field therefore always recomposes itself after being scattered, which
    // is what makes it worth shoving a second and a third time.
    if (b) {
      const t = b.translation();
      const v = b.linvel();

      // 1. Speed ceiling. Bounds the energy any single shove can inject,
      //    which is what stops a fast drag from tunnelling through a wall.
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > MAX_SPEED) {
        const s = MAX_SPEED / speed;
        b.setLinvel({ x: v.x * s, y: v.y * s, z: v.z * s }, true);
      }

      // 2. Containment backstop. Walls plus a speed cap should be enough, but
      //    "should be" is not a guarantee, and a float that escapes is gone
      //    forever — the one failure this toy must not have. If anything ends
      //    up outside the play box, it is put back.
      const escaped =
        Math.abs(t.x) > limits.x ||
        Math.abs(t.y) > limits.y ||
        Math.abs(t.z) > 1.5;
      if (escaped) {
        b.setTranslation(
          {
            x: clamp(t.x, -limits.x, limits.x),
            y: clamp(t.y, -limits.y, limits.y),
            z: 0,
          },
          true,
        );
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }

      // 3. Spring home. The offset is clamped so a distant body eases back
      //    instead of being slingshot past its origin.
      const k = 3.4 * delta;
      b.applyImpulse(
        {
          x: clamp(spec.position[0] - t.x, -2.5, 2.5) * k,
          y: clamp(spec.position[1] - t.y, -2.5, 2.5) * k,
          z: -t.z * k * 2, // hold the play to the z=0 plane
        },
        true,
      );
    }

    // Squish decays back to round. Non-uniform scale on a sphere is the
    // cheapest convincing soft-body: it costs one matrix update, no solver.
    squish.current *= Math.pow(0.0001, delta);
    const s = squish.current;
    m.scale.set(1 + s, 1 - s * 0.8, 1 + s * 0.4);

    // A slow idle bob so the field is never fully still — stillness reads as
    // "broken" where motion reads as "alive and waiting".
    const t = state.clock.elapsedTime;
    m.position.y = Math.sin(t * 0.7 + phase) * 0.05;
    m.rotation.z = Math.sin(t * 0.4 + phase) * 0.12;
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      position={spec.position}
      linearDamping={1.6}
      angularDamping={1.4}
      restitution={0.72}
      friction={0.1}
      ccd /* swept collision — a fast float cannot skip past a thin wall */
      onCollisionEnter={({ other }) => {
        const v = body.current?.linvel();
        const speed = v ? Math.hypot(v.x, v.y, v.z) : 0;
        const fromPointer = other.rigidBodyObject?.name === 'pointer';

        // Ignore whisper-quiet resting contacts, otherwise a settling pile
        // would chime forever.
        if (speed < 0.55 && !fromPointer) return;

        squish.current = clamp(speed * 0.14, 0.06, 0.42);
        onHit(speed);
      }}
    >
      <BallCollider args={[spec.radius]} />
      <mesh ref={mesh}>
        <sphereGeometry args={[spec.radius, 24, 16]} />
        {/* Deliberately NOT using `transmission`. Real refraction forces
            three.js to render the scene into a transmission target once per
            transmissive mesh — with a dozen floats that is a dozen extra
            full-scene passes per frame, which resets the GPU outright on
            integrated graphics. Alpha + clearcoat + a little emissive reads
            as "wet glass" at a fraction of the cost. */}
        <meshPhysicalMaterial
          color={spec.color}
          roughness={0.16}
          metalness={0}
          transparent
          opacity={0.84}
          clearcoat={1}
          clearcoatRoughness={0.1}
          emissive={spec.color}
          emissiveIntensity={0.22}
        />
      </mesh>
    </RigidBody>
  );
}

/**
 * A canvas whose context has been lost paints as opaque white and covers the
 * whole section, which is a far worse failure than simply having no 3D. This
 * catches the loss, lets the browser attempt a restore, and reports upward so
 * the canvas can be hidden until it recovers.
 */
function ContextGuard({ onChange }: { onChange: (lost: boolean) => void }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;

    const onLost = (e: Event) => {
      // Without preventDefault the context can never be restored.
      e.preventDefault();
      onChange(true);
    };
    const onRestored = () => onChange(false);

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl, onChange]);

  return null;
}

/** Static walls so nothing can be flicked out of the tank and lost. */
function Bounds() {
  const { viewport } = useThree();
  const w = viewport.width / 2;
  const h = viewport.height / 2;
  const t = 1;

  return (
    <RigidBody type="fixed" colliders={false} restitution={0.6} friction={0.05}>
      <CuboidCollider args={[w + t, t, 4]} position={[0, h + t, 0]} />
      <CuboidCollider args={[w + t, t, 4]} position={[0, -h - t, 0]} />
      <CuboidCollider args={[t, h + t, 4]} position={[-w - t, 0, 0]} />
      <CuboidCollider args={[t, h + t, 4]} position={[w + t, 0, 0]} />
      {/* Front and back plates keep everything on the z=0 plane. */}
      <CuboidCollider args={[w + t, h + t, t]} position={[0, 0, -1.6]} />
      <CuboidCollider args={[w + t, h + t, t]} position={[0, 0, 1.6]} />
    </RigidBody>
  );
}

/**
 * Owns float layout, because layout has to be derived from the live viewport
 * and this is the one component inside the Canvas that can read it.
 *
 * Everything here is expressed as a fraction of the visible frustum rather
 * than in absolute world units. A fixed 8.8-unit-wide field is fine on a
 * desktop frustum (~9.8 units) and catastrophic in portrait (~2.8 units),
 * where it would scatter most of the floats off-screen and leave the toy
 * looking empty on precisely the devices most likely to be poked at.
 */
function Floats({
  count,
  onHit,
}: {
  count: number;
  onHit: (speed: number) => void;
}) {
  const { viewport } = useThree();
  const { width: vw, height: vh } = viewport;

  const limits = useMemo(() => ({ x: vw / 2 + 1.2, y: vh / 2 + 1.2 }), [vw, vh]);

  // Jittered grid rather than pure random placement. Uniform random on a
  // small sample reliably produces clumps and bald patches, and since these
  // are also the *home* positions the spring returns to, a bad draw would be
  // permanent rather than momentary.
  const specs = useMemo<FloatSpec[]>(() => {
    const portrait = vw < vh;
    const cols = portrait ? 3 : count >= 12 ? 5 : 3;
    const rows = Math.ceil(count / cols);

    const spanX = vw * 0.82;
    const spanY = vh * 0.78;
    const base = Math.min(vw, vh);

    return Array.from({ length: count }, (_, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      return {
        key: i,
        position: [
          -spanX / 2 + ((col + 0.5 + rand(-0.3, 0.3)) * spanX) / cols,
          -spanY / 2 + ((row + 0.5 + rand(-0.28, 0.28)) * spanY) / rows,
          0,
        ] as [number, number, number],
        radius: rand(base * 0.035, base * 0.08),
        color: pick(PALETTE),
      };
    });
  }, [count, vw, vh]);

  return (
    <>
      {specs.map((s) => (
        <Float key={s.key} spec={s} limits={limits} onHit={onHit} />
      ))}
    </>
  );
}

function Tank({
  count,
  paused,
  onHit,
  onContextChange,
}: {
  count: number;
  paused: boolean;
  onHit: (speed: number) => void;
  onContextChange: (lost: boolean) => void;
}) {
  return (
    <>
      <ContextGuard onChange={onContextChange} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 6, 5]} intensity={1.15} />
      <pointLight position={[-4, -2, 3]} intensity={22} color="#8ffff0" />

      {/* Zero gravity — buoyancy is per-body (see the spring in Float), so
          the tank stays evenly populated instead of draining upward. */}
      <Physics gravity={[0, 0, 0]} paused={paused} timeStep="vary">
        <Bounds />
        <PointerBody />
        <Floats count={count} onHit={onHit} />
      </Physics>
    </>
  );
}

export default function SurfaceScene({
  paused = false,
  depth = 0,
}: {
  paused?: boolean;
  depth?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const { reward } = usePlayground();
  const [count, setCount] = useState(FLOAT_COUNT_DESKTOP);
  const [contextLost, setContextLost] = useState(false);
  const lastSound = useRef(0);

  // Fewer bodies on a small screen: the solver, not the renderer, is the
  // budget here.
  const onCanvasCreated = useCallback(() => {
    setCount(
      window.matchMedia('(max-width: 780px)').matches
        ? FLOAT_COUNT_MOBILE
        : FLOAT_COUNT_DESKTOP,
    );
  }, []);

  const onHit = useCallback(
    (speed: number) => {
      // Rate-limit so a pile-up cannot machine-gun the synth.
      const now = performance.now();
      if (now - lastSound.current < 55) return;
      lastSound.current = now;

      reward(rollReward(), clamp(speed / 6, 0.12, 1), depth);
    },
    [reward, depth],
  );

  return (
    <Canvas
      className="section__canvas"
      onCreated={onCanvasCreated}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 8], fov: 42 }}
      // Freeze the render loop entirely when parked — zero GPU cost
      // off-screen, which is what keeps four scenes affordable at once.
      frameloop={paused || reduced ? 'demand' : 'always'}
      // Hidden rather than unmounted while the context is gone: unmounting
      // would destroy the very canvas that has to receive `contextrestored`.
      style={contextLost ? { opacity: 0 } : undefined}
    >
      <Tank
        count={count}
        paused={paused || reduced}
        onHit={onHit}
        onContextChange={setContextLost}
      />
    </Canvas>
  );
}
