'use client';

import Matter from 'matter-js';
import { useEffect, useRef } from 'react';
import { animateVisible } from '@/lib/animation';
import { arbitrateTouch } from '@/lib/gesture';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { clamp, pick, rand, rollReward, type RewardTier } from '@/lib/reward';
import { usePlayground } from '@/lib/store';

/**
 * DRIFT — a field of soft jellies you can grab, stretch, and fling.
 *
 * Each jelly is a ring of 10 small circles joined to a hidden hub by springy
 * constraints. That is a genuine soft body: pulling one point deforms the
 * whole ring and it wobbles back. A single circle with a scale animation
 * would look similar in a screenshot and feel completely dead in the hand —
 * the wobble *after* release is what makes it satisfying, and only a real
 * constraint network gives you that for free.
 *
 * Rendered to a 2D canvas rather than DOM nodes: 12 jellies × 10 nodes is 120
 * moving things per frame, which is fine for one canvas path and ruinous for
 * 120 elements in the layout tree.
 */

const RING_NODES = 10;
const JELLY_COUNT_DESKTOP = 12;
const JELLY_COUNT_MOBILE = 7;

const TIER_COLOR: Record<RewardTier, string> = {
  common: '#8ffff0',
  uncommon: '#ffd6a0',
  rare: '#ff9ce8',
};

type Jelly = {
  hub: Matter.Body;
  ring: Matter.Body[];
  radius: number;
  hue: string;
  /** 0..1, drives the glow that fades after a poke. */
  charge: number;
  home: { x: number; y: number };
};

type Ripple = {
  x: number;
  y: number;
  r: number;
  life: number;
  color: string;
};

export default function DriftScene({
  paused = false,
  depth = 0.33,
}: {
  paused?: boolean;
  depth?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const { reward } = usePlayground();

  // Keep the latest reward fn in a ref: the physics world is built once and
  // must not be torn down just because a callback identity changed.
  const rewardRef = useRef(reward);
  rewardRef.current = reward;
  const depthRef = useRef(depth);
  depthRef.current = depth;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    if (reduced) return;

    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = host.clientWidth;
    let h = host.clientHeight;
    const isMobile = window.matchMedia('(max-width: 780px)').matches;
    const count = isMobile ? JELLY_COUNT_MOBILE : JELLY_COUNT_DESKTOP;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0.001 },
      positionIterations: 6,
      velocityIterations: 4,
    });
    const world = engine.world;

    /* ---------- build one soft jelly ---------- */
    const makeJelly = (cx: number, cy: number, radius: number): Jelly => {
      const hub = Matter.Bodies.circle(cx, cy, radius * 0.3, {
        frictionAir: 0.045,
        restitution: 0.4,
        density: 0.0012,
      });

      const ring: Matter.Body[] = [];
      const constraints: Matter.Constraint[] = [];

      for (let i = 0; i < RING_NODES; i++) {
        const a = (i / RING_NODES) * Math.PI * 2;
        const node = Matter.Bodies.circle(
          cx + Math.cos(a) * radius,
          cy + Math.sin(a) * radius,
          radius * 0.2,
          { frictionAir: 0.05, restitution: 0.6, density: 0.0008 },
        );
        ring.push(node);

        // Spoke: holds the node out at radius. Soft enough to stretch.
        constraints.push(
          Matter.Constraint.create({
            bodyA: hub,
            bodyB: node,
            length: radius,
            stiffness: 0.055,
            damping: 0.12,
          }),
        );
      }

      // Hoop: neighbour-to-neighbour, keeps the outline from collapsing.
      for (let i = 0; i < RING_NODES; i++) {
        constraints.push(
          Matter.Constraint.create({
            bodyA: ring[i],
            bodyB: ring[(i + 1) % RING_NODES],
            length: (2 * Math.PI * radius) / RING_NODES,
            stiffness: 0.13,
            damping: 0.1,
          }),
        );
      }

      Matter.Composite.add(world, [hub, ...ring, ...constraints]);
      return {
        hub,
        ring,
        radius,
        hue: pick(['#8ffff0', '#a9b6ff', '#7fe3d4', '#c9a8ff', '#ffd6f2']),
        charge: 0,
        home: { x: cx / w, y: cy / h },
      };
    };

    let jellies: Jelly[] = [];
    let walls: Matter.Body[] = [];

    const buildWalls = () => {
      Matter.Composite.remove(world, walls);
      const t = 200;
      walls = [
        Matter.Bodies.rectangle(w / 2, -t / 2, w + t * 2, t, { isStatic: true }),
        Matter.Bodies.rectangle(w / 2, h + t / 2, w + t * 2, t, {
          isStatic: true,
        }),
        Matter.Bodies.rectangle(-t / 2, h / 2, t, h + t * 2, { isStatic: true }),
        Matter.Bodies.rectangle(w + t / 2, h / 2, t, h + t * 2, {
          isStatic: true,
        }),
      ];
      Matter.Composite.add(world, walls);
    };

    const populate = () => {
      jellies = Array.from({ length: count }, () =>
        makeJelly(
          rand(w * 0.12, w * 0.88),
          rand(h * 0.15, h * 0.85),
          rand(Math.min(w, h) * 0.045, Math.min(w, h) * 0.085),
        ),
      );
    };

    buildWalls();
    populate();

    /* ---------- pointer: multi-touch drag ---------- */
    // Matter's MouseConstraint is single-pointer. A playground has to survive
    // two thumbs, so drags are tracked per pointerId by hand.
    const drags = new Map<
      number,
      { body: Matter.Body; jelly: Jelly; x: number; y: number }
    >();

    const ripples: Ripple[] = [];

    const localPoint = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const nearest = (x: number, y: number) => {
      let best: { body: Matter.Body; jelly: Jelly; d: number } | null = null;
      for (const j of jellies) {
        for (const node of j.ring) {
          const d = Math.hypot(node.position.x - x, node.position.y - y);
          if (!best || d < best.d) best = { body: node, jelly: j, d };
        }
      }
      // Only grab if the touch actually landed near something.
      return best && best.d < 90 ? best : null;
    };

    const onDown = (e: PointerEvent) => {
      const { x, y } = localPoint(e);
      const hit = nearest(x, y);

      const tier = rollReward();
      ripples.push({ x, y, r: 0, life: 1, color: TIER_COLOR[tier] });

      if (hit) {
        drags.set(e.pointerId, { body: hit.body, jelly: hit.jelly, x, y });
        hit.jelly.charge = 1;
        canvas.setPointerCapture(e.pointerId);
        rewardRef.current(tier, 0.55, depthRef.current);
      } else {
        // A tap on empty water still pays out — quieter, but never nothing.
        rewardRef.current(tier, 0.22, depthRef.current);
      }
    };

    const onMove = (e: PointerEvent) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      const { x, y } = localPoint(e);
      d.x = x;
      d.y = y;
    };

    const onUp = (e: PointerEvent) => {
      const d = drags.get(e.pointerId);
      if (!d) return;
      drags.delete(e.pointerId);

      // Release velocity is already in the body from the drag steering, so
      // the flick is inherited rather than synthesised.
      const v = d.body.velocity;
      const speed = Math.hypot(v.x, v.y);
      if (speed > 4) {
        rewardRef.current(
          rollReward(),
          clamp(speed / 22, 0.2, 1),
          depthRef.current,
        );
      }
    };

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);

    // A finger that lands on a jelly is pulling it, not scrolling past it, so
    // the scene claims that touch outright and never has to wait out a press.
    const releaseTouch = arbitrateTouch(canvas, {
      shouldGrab: (clientX, clientY) => {
        const r = canvas.getBoundingClientRect();
        return !!nearest(clientX - r.left, clientY - r.top);
      },
    });

    /* ---------- resize ---------- */
    let sized = false;
    const resize = () => {
      if (sized && w === host.clientWidth && h === host.clientHeight) return;
      sized = true;
      w = host.clientWidth;
      h = host.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildWalls();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    /* ---------- draw ---------- */
    // Quadratic midpoint smoothing through the ring nodes. A plain polyline
    // through 10 points looks faceted; the smoothing is what sells
    // "membrane" over "polygon".
    const traceRing = (nodes: Matter.Body[]) => {
      const p = nodes.map((n) => n.position);
      const n = p.length;
      ctx.beginPath();
      ctx.moveTo((p[n - 1].x + p[0].x) / 2, (p[n - 1].y + p[0].y) / 2);
      for (let i = 0; i < n; i++) {
        const cur = p[i];
        const next = p[(i + 1) % n];
        ctx.quadraticCurveTo(
          cur.x,
          cur.y,
          (cur.x + next.x) / 2,
          (cur.y + next.y) / 2,
        );
      }
      ctx.closePath();
    };

    let last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(now - last, 1000 / 60);
      last = now;

      if (pausedRef.current) { drags.clear(); return; }

      // Steer dragged nodes toward the finger with a velocity set rather than
      // a teleport, so the rest of the ring gets dragged along by the
      // constraints instead of being snapped.
      for (const d of drags.values()) {
        const dx = d.x - d.body.position.x;
        const dy = d.y - d.body.position.y;
        Matter.Body.setVelocity(d.body, { x: dx * 0.28, y: dy * 0.28 });
        d.jelly.charge = Math.min(1, d.jelly.charge + 0.05);
      }

      for (const jelly of jellies) {
        if ([...drags.values()].some((drag) => drag.jelly === jelly)) continue;
        const dx = jelly.home.x * w - jelly.hub.position.x;
        const dy = jelly.home.y * h - jelly.hub.position.y;
        for (const body of [jelly.hub, ...jelly.ring]) {
          Matter.Body.applyForce(body, body.position, {
            x: dx * body.mass * 0.000002,
            y: dy * body.mass * 0.000002,
          });
        }
      }
      Matter.Engine.update(engine, dt);

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      for (const j of jellies) {
        j.charge *= 0.965;

        const glow = 0.18 + j.charge * 0.55;

        traceRing(j.ring);
        const c = j.hub.position;
        const grad = ctx.createRadialGradient(
          c.x,
          c.y,
          j.radius * 0.1,
          c.x,
          c.y,
          j.radius * 1.5,
        );
        grad.addColorStop(0, hexA(j.hue, 0.16 + j.charge * 0.4));
        grad.addColorStop(1, hexA(j.hue, 0));
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.strokeStyle = hexA(j.hue, glow);
        ctx.lineWidth = 1.4 + j.charge * 2.2;
        ctx.stroke();

        // Trailing tendrils — pure decoration, but they're what makes the
        // thing read as a creature rather than a bubble.
        ctx.lineWidth = 1;
        for (let i = 0; i < j.ring.length; i += 3) {
          const n = j.ring[i].position;
          const sway = Math.sin(now * 0.0018 + i) * j.radius * 0.35;
          ctx.beginPath();
          ctx.moveTo(n.x, n.y);
          ctx.quadraticCurveTo(
            n.x + sway,
            n.y + j.radius * 0.9,
            n.x + sway * 0.4,
            n.y + j.radius * 1.9,
          );
          ctx.strokeStyle = hexA(j.hue, 0.1 + j.charge * 0.22);
          ctx.stroke();
        }
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += 5.5;
        r.life -= 0.028;
        if (r.life <= 0) {
          ripples.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = hexA(r.color, r.life * 0.5);
        ctx.lineWidth = 2 * r.life;
        ctx.stroke();
      }

      ctx.globalCompositeOperation = 'source-over';
    };

    const stopAnimation = animateVisible(host, frame);

    return () => {
      stopAnimation();
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      releaseTouch();
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    };
  }, [reduced]);

  return (
    <div ref={hostRef} className="section__canvas">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', touchAction: 'pan-y' }}
        aria-hidden="true"
      />
    </div>
  );
}

/** '#rrggbb' + alpha → 'rgba(...)'. */
function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a.toFixed(3)})`;
}
