'use client';

import { useEffect, useRef } from 'react';
import {
  useFinePointer,
  useGyroscope,
  usePrefersReducedMotion,
} from '@/lib/hooks';
import { animateVisible } from '@/lib/animation';
import { arbitrateTouch } from '@/lib/gesture';
import { rand, rollReward } from '@/lib/reward';
import { usePlayground } from '@/lib/store';

/**
 * KELP — a forest of verlet-simulated strands that part around your hand.
 *
 * Each strand is a chain of points solved with Verlet integration and a few
 * distance-constraint passes. This is the classic rope solver and it is used
 * here for a specific reason: it is *stable under absurd input*. A user can
 * scrub a finger back and forth as fast as the digitiser reports, and the
 * strands stretch and recover instead of exploding. Robustness under abuse is
 * the difference between a toy and a demo.
 *
 * The current is the ambient layer: a slow travelling sine that keeps the
 * whole forest breathing at roughly 6 cycles/minute — close to the resonant
 * breathing rate used in paced-breathing protocols. Users are not asked to
 * breathe along with it and are never told it is there; it works as
 * entrainment or not at all.
 *
 * The gyroscope hook lives *inside* this component rather than in the page,
 * because its `granted` state and its event listener have to be the same
 * instance — a permission granted by a button in some other component would
 * not be visible here.
 */

const SEGMENTS_DESKTOP = 18;
const SEGMENTS_MOBILE = 13;
const CONSTRAINT_PASSES = 4;
const TOUCH_RADIUS = 110;

/** Strand length as a fraction of canvas height. */
const STRAND_SPAN = 0.62;

type Point = { x: number; y: number; px: number; py: number };

type Strand = {
  pts: Point[];
  baseX: number;
  hue: number;
  width: number;
  phase: number;
  /** rises when disturbed, decays — drives the bioluminescent flush */
  glow: number;
};

export default function KelpScene({
  paused = false,
  depth = 0.66,
}: {
  paused?: boolean;
  depth?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = usePrefersReducedMotion();
  const fine = useFinePointer();
  const { reward } = usePlayground();
  const { tilt, granted, supported, request } = useGyroscope(!paused);

  const rewardRef = useRef(reward);
  rewardRef.current = reward;
  const depthRef = useRef(depth);
  depthRef.current = depth;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const tiltRef = useRef(tilt);
  tiltRef.current = tilt;

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
    const segCount = isMobile ? SEGMENTS_MOBILE : SEGMENTS_DESKTOP;

    let strands: Strand[] = [];
    // Segment length is derived from the canvas so the forest always reaches
    // a fixed fraction up the section. A hard-coded value made 200px stubs on
    // a 1000px canvas — grass clippings rather than kelp.
    let segLen = 30;

    const build = () => {
      segLen = Math.max(16, (h * STRAND_SPAN) / segCount);
      const spacing = isMobile ? 30 : 24;
      const n = Math.max(6, Math.floor(w / spacing));
      strands = Array.from({ length: n }, (_, i) => {
        const baseX = (i + 0.5) * (w / n) + rand(-4, 4);
        const pts: Point[] = [];
        for (let s = 0; s < segCount; s++) {
          const y = h - s * segLen;
          pts.push({ x: baseX, y, px: baseX, py: y });
        }
        return {
          pts,
          baseX,
          hue: rand(150, 196),
          width: rand(2.2, 5.2),
          phase: rand(0, Math.PI * 2),
          glow: 0,
        };
      });
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

    /* ---------- pointers (multi-touch) ---------- */
    const pointers = new Map<number, { x: number; y: number }>();
    let lastReward = 0;

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, local(e));
      canvas.setPointerCapture(e.pointerId);
      rewardRef.current(rollReward(), 0.4, depthRef.current);
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, local(e));

      // Reward on sustained brushing, throttled — one chime per ~140ms of
      // contact keeps a long drag musical rather than a machine gun.
      const now = performance.now();
      if (now - lastReward > 140) {
        lastReward = now;
        rewardRef.current(rollReward(), 0.3, depthRef.current);
      }
    };
    const onUp = (e: PointerEvent) => pointers.delete(e.pointerId);

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove, { passive: true });
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onUp);

    // There is nothing discrete to land on here — the whole field responds —
    // so a sweep through the fronds is claimed by hold or by direction alone.
    const releaseTouch = arbitrateTouch(canvas);

    /* ---------- simulate ---------- */
    let t = 0;

    const frame = () => {
      if (pausedRef.current) { pointers.clear(); return; }

      t += 1 / 60;

      // ~6 cycles per minute.
      const breath = Math.sin(t * 0.63);
      const tiltX = tiltRef.current.x;

      // Every force is expressed as a fraction of segment length, so the
      // simulation behaves identically on a short mobile canvas and a tall
      // desktop one instead of turning to spaghetti on the larger of the two.
      const unit = segLen / 30;
      const maxV = segLen * 0.85;

      for (const st of strands) {
        // Current: strongest at the tip, zero at the holdfast.
        const drift =
          (breath * 0.55 * Math.sin(t * 0.3 + st.phase) + tiltX * 1.9) * unit;

        for (let i = 1; i < st.pts.length; i++) {
          const p = st.pts[i];
          const influence = i / st.pts.length; // tip moves most

          let vx = (p.x - p.px) * 0.94;
          let vy = (p.y - p.py) * 0.94;

          // Clamp before integrating. Without this a hard flick can hand a
          // point more velocity than the constraint solver can retire in one
          // frame, and the strand snaps into a straight spike.
          const sp = Math.hypot(vx, vy);
          if (sp > maxV) {
            vx = (vx / sp) * maxV;
            vy = (vy / sp) * maxV;
          }

          p.px = p.x;
          p.py = p.y;

          p.x += vx + drift * influence;
          // Buoyancy: kelp is held up, so this term is negative.
          p.y += vy - 0.22 * unit * influence;
        }

        // Push away from every active pointer.
        for (const ptr of pointers.values()) {
          for (let i = 1; i < st.pts.length; i++) {
            const p = st.pts[i];
            const dx = p.x - ptr.x;
            const dy = p.y - ptr.y;
            const d = Math.hypot(dx, dy);
            if (d < TOUCH_RADIUS && d > 0.001) {
              const force = (1 - d / TOUCH_RADIUS) ** 2 * 14 * unit;
              p.x += (dx / d) * force;
              p.y += (dy / d) * force;
              st.glow = Math.min(1, st.glow + 0.09);
            }
          }
        }

        // Distance constraints. The holdfast (index 0) is pinned.
        for (let pass = 0; pass < CONSTRAINT_PASSES; pass++) {
          st.pts[0].x = st.baseX;
          st.pts[0].y = h;

          for (let i = 0; i < st.pts.length - 1; i++) {
            const a = st.pts[i];
            const b = st.pts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy) || 0.0001;
            const diff = (d - segLen) / d;
            const mx = dx * 0.5 * diff;
            const my = dy * 0.5 * diff;

            if (i > 0) {
              a.x += mx;
              a.y += my;
            }
            b.x -= mx;
            b.y -= my;
          }
        }

        st.glow *= 0.94;
      }

      /* ---------- draw ---------- */
      ctx.clearRect(0, 0, w, h);

      // Silt floor — grounds the strands so they don't read as floating.
      const floor = ctx.createLinearGradient(0, h - 90, 0, h);
      floor.addColorStop(0, 'rgba(4,10,16,0)');
      floor.addColorStop(1, 'rgba(4,10,16,0.85)');
      ctx.fillStyle = floor;
      ctx.fillRect(0, h - 90, w, 90);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (const st of strands) {
        const pts = st.pts;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length - 1; i++) {
          const cur = pts[i];
          const next = pts[i + 1];
          ctx.quadraticCurveTo(
            cur.x,
            cur.y,
            (cur.x + next.x) / 2,
            (cur.y + next.y) / 2,
          );
        }
        const tip = pts[pts.length - 1];
        ctx.lineTo(tip.x, tip.y);

        const g = st.glow;
        ctx.strokeStyle = `hsla(${st.hue}, ${58 + g * 34}%, ${34 + g * 38}%, ${
          0.68 + g * 0.32
        })`;
        ctx.lineWidth = st.width;
        ctx.stroke();

        if (g > 0.05) {
          // Second, wider, additive pass = bloom without a shader.
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `hsla(${st.hue + 12}, 100%, 72%, ${g * 0.32})`;
          ctx.lineWidth = st.width + 7 * g;
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        }

        // A luminous bud on the tip of every disturbed strand.
        if (g > 0.12) {
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 2 + g * 4, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${st.hue + 20}, 100%, ${62 + g * 20}%, ${g})`;
          ctx.fill();
        }
      }
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
      canvas.removeEventListener('pointerleave', onUp);
    };
  }, [reduced]);

  // Only offered where a sensor plausibly exists. Advertising a tilt control
  // on a desktop that will never fire an event is worse than not having one.
  const offerTilt = supported && !granted && !fine && !reduced;

  return (
    <div ref={hostRef} className="section__canvas">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', touchAction: 'pan-y' }}
        aria-hidden="true"
      />
      {offerTilt && (
        <button
          type="button"
          onClick={() => void request()}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '1.75rem',
            transform: 'translateX(-50%)',
            zIndex: 3,
            appearance: 'none',
            border: '1px solid var(--hud-border)',
            background: 'var(--hud-bg)',
            backdropFilter: 'blur(12px)',
            color: 'var(--ink)',
            borderRadius: 999,
            padding: '0.6rem 1.1rem',
            fontSize: '0.75rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Tilt to sway
        </button>
      )}
    </div>
  );
}
