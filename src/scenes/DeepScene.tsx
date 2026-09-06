'use client';

import { useEffect, useRef } from 'react';
import { animateVisible } from '@/lib/animation';
import { arbitrateTouch } from '@/lib/gesture';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { clamp, rand, rollReward, type RewardTier } from '@/lib/reward';
import { usePlayground } from '@/lib/store';

/**
 * DEEP — near-black water where the only light is the light you make.
 *
 * This is where the variable-ratio schedule is most visible, and it is placed
 * last on purpose. By this point the user has learned three reliable
 * interaction grammars (push, squeeze, brush); the deep withholds the
 * *feedback* but never the *response*, which is the condition under which
 * intermittent reward becomes interesting rather than frustrating.
 *
 * Three layers:
 *  1. Motes — a slow plankton drift that reacts to the pointer. Always there,
 *     always responsive. This is the floor: touching the dark is never inert.
 *  2. Bursts — particle explosions on tap, coloured by reward tier.
 *  3. Sleepers — dim shapes that only become visible when the pointer passes
 *     near them. They are the curiosity engine: you can see *that* something
 *     is there long before you can see *what*, and the only way to resolve it
 *     is to move closer. Waking one is what rolls for a rare.
 */

const MOTE_COUNT_DESKTOP = 190;
const MOTE_COUNT_MOBILE = 110;
const SLEEPER_COUNT = 7;
const WAKE_RADIUS = 150;

const TIER_COLOR: Record<RewardTier, [number, number, number]> = {
  common: [143, 255, 240],
  uncommon: [255, 214, 160],
  rare: [255, 156, 232],
};

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  rgb: [number, number, number];
};

type Sleeper = {
  x: number;
  y: number;
  r: number;
  /** 0 = invisible, 1 = fully woken */
  wake: number;
  /** cooldown so one sleeper cannot be farmed by scrubbing over it */
  cooled: number;
  phase: number;
  arms: number;
};

export default function DeepScene({
  paused = false,
  depth = 1,
}: {
  paused?: boolean;
  depth?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const { reward } = usePlayground();

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
    const moteCount = isMobile ? MOTE_COUNT_MOBILE : MOTE_COUNT_DESKTOP;

    let motes: Mote[] = [];
    let sleepers: Sleeper[] = [];
    const particles: Particle[] = [];

    const build = () => {
      motes = Array.from({ length: moteCount }, () => ({
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.09, 0.09),
        vy: rand(-0.16, -0.03), // drift gently upward, like marine snow rising
        r: rand(0.5, 1.9),
        a: rand(0.16, 0.7),
      }));

      sleepers = Array.from({ length: SLEEPER_COUNT }, () => ({
        x: rand(w * 0.08, w * 0.92),
        y: rand(h * 0.12, h * 0.88),
        r: rand(26, 58),
        wake: 0,
        cooled: 0,
        phase: rand(0, Math.PI * 2),
        arms: Math.floor(rand(5, 9)),
      }));
    };

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
      build();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    /* ---------- input ---------- */
    const pointers = new Map<number, { x: number; y: number }>();

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const burst = (x: number, y: number, tier: RewardTier, power: number) => {
      const rgb = TIER_COLOR[tier];
      const n = tier === 'rare' ? 54 : tier === 'uncommon' ? 28 : 16;
      for (let i = 0; i < n; i++) {
        const a = rand(0, Math.PI * 2);
        const sp = rand(0.6, 4.4) * power;
        particles.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          decay: rand(0.008, 0.024),
          size: rand(1, tier === 'rare' ? 3.6 : 2.4),
          rgb,
        });
      }
    };

    const onDown = (e: PointerEvent) => {
      const p = local(e);
      pointers.set(e.pointerId, p);
      canvas.setPointerCapture(e.pointerId);

      // Did the tap land on a sleeper? That is the good outcome, and it is
      // the only path that can roll a rare here.
      let onSleeper: Sleeper | null = null;
      for (const s of sleepers) {
        if (Math.hypot(s.x - p.x, s.y - p.y) < s.r * 1.15 && s.cooled <= 0) {
          onSleeper = s;
          break;
        }
      }

      if (onSleeper) {
        const hit = onSleeper;
        const tier = rollReward();
        hit.wake = 1;
        hit.cooled = 150; // ~2.5s at 60fps
        burst(hit.x, hit.y, tier, 1.5);
        rewardRef.current(tier, 0.85, depthRef.current);

        // Woken sleepers relocate, so the field never becomes a solved map.
        setTimeout(() => {
          hit.x = rand(w * 0.08, w * 0.92);
          hit.y = rand(h * 0.12, h * 0.88);
          hit.r = rand(26, 58);
          hit.arms = Math.floor(rand(5, 9));
        }, 1400);
      } else {
        // Empty water still lights up — dimmer, and never rare.
        burst(p.x, p.y, 'common', 0.7);
        rewardRef.current('common', 0.3, depthRef.current);
      }
    };

    const onMove = (e: PointerEvent) => {
      const tracked = pointers.has(e.pointerId);
      if (tracked || e.pointerType === 'mouse') {
        pointers.set(e.pointerId, local(e));
      }
    };
    const onUp = (e: PointerEvent) => pointers.delete(e.pointerId);
    const onLeave = () => pointers.clear();

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    // Landing on a sleeper is the whole point of this scene, so that touch is
    // claimed immediately; anywhere else, the page keeps its flick.
    const releaseTouch = arbitrateTouch(canvas, {
      shouldGrab: (clientX, clientY) => {
        const r = canvas.getBoundingClientRect();
        const x = clientX - r.left;
        const y = clientY - r.top;
        return sleepers.some(
          (s) => s.cooled <= 0 && Math.hypot(s.x - x, s.y - y) < s.r * 1.15,
        );
      },
    });

    /* ---------- loop ---------- */
    let t = 0;

    const frame = () => {
      if (pausedRef.current) { pointers.clear(); return; }
      t += 1 / 60;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      /* motes */
      for (const m of motes) {
        m.x += m.vx;
        m.y += m.vy;

        for (const p of pointers.values()) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 26000 && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / 161) * 0.34;
            m.vx += (dx / d) * f;
            m.vy += (dy / d) * f;
          }
        }

        // Bleed off pointer energy quickly and cap it. Without this the
        // repulsion herds motes into permanent clumps and the even
        // marine-snow field degrades into blobs after a minute of play.
        m.vx *= 0.955;
        m.vy *= 0.955;
        const ms = Math.hypot(m.vx, m.vy);
        if (ms > 2.4) {
          m.vx = (m.vx / ms) * 2.4;
          m.vy = (m.vy / ms) * 2.4;
        }

        // wrap
        if (m.x < -5) m.x = w + 5;
        if (m.x > w + 5) m.x = -5;
        if (m.y < -5) m.y = h + 5;
        if (m.y > h + 5) m.y = -5;

        const tw = 0.65 + Math.sin(t * 2 + m.x * 0.05) * 0.35;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 230, 255, ${(m.a * tw).toFixed(3)})`;
        ctx.fill();
      }

      /* sleepers */
      for (const s of sleepers) {
        if (s.cooled > 0) s.cooled -= 1;

        let near = 0;
        for (const p of pointers.values()) {
          const d = Math.hypot(s.x - p.x, s.y - p.y);
          near = Math.max(near, clamp(1 - d / WAKE_RADIUS, 0, 1));
        }

        // Approach reveals, distance re-hides. The decay is slower than the
        // rise so a near-miss leaves an afterimage worth chasing.
        s.wake = Math.max(near, s.wake * 0.972);
        if (s.wake < 0.008) continue;

        const pulse = 0.86 + Math.sin(t * 1.7 + s.phase) * 0.14;
        const a = s.wake * pulse;

        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 1.9);
        g.addColorStop(0, `rgba(143, 255, 240, ${(a * 0.34).toFixed(3)})`);
        g.addColorStop(0.5, `rgba(120, 170, 255, ${(a * 0.14).toFixed(3)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 1.9, 0, Math.PI * 2);
        ctx.fill();

        // Radial arms — a shape specific enough to be worth resolving.
        ctx.strokeStyle = `rgba(190, 255, 250, ${(a * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < s.arms; i++) {
          const ang = (i / s.arms) * Math.PI * 2 + t * 0.22 + s.phase;
          const len = s.r * (0.75 + Math.sin(t * 1.3 + i) * 0.22);
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.quadraticCurveTo(
            s.x + Math.cos(ang + 0.35) * len * 0.6,
            s.y + Math.sin(ang + 0.35) * len * 0.6,
            s.x + Math.cos(ang) * len,
            s.y + Math.sin(ang) * len,
          );
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.22, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(230, 255, 253, ${(a * 0.8).toFixed(3)})`;
        ctx.fill();
      }

      /* particles */
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.972;
        p.vy *= 0.972;
        p.vy -= 0.012; // buoyant rise
        p.life -= p.decay;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const [r, g2, b] = p.rgb;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g2}, ${b}, ${(p.life * 0.85).toFixed(3)})`;
        ctx.fill();
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
      canvas.removeEventListener('pointerleave', onLeave);
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
