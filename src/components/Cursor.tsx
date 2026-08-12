'use client';

import { useEffect, useRef } from 'react';
import { useFinePointer, usePrefersReducedMotion } from '@/lib/hooks';
import { damp } from '@/lib/reward';

/**
 * Custom cursor: a hard dot that tracks the pointer exactly, and a soft ring
 * that lags behind it on a spring.
 *
 * The split is the whole trick. The dot preserves the 1:1 sense of agency
 * that a lagging cursor destroys — input latency reads as broken, not
 * playful. The ring is free to be expressive precisely *because* the dot is
 * already honest about where the pointer is.
 *
 * Magnetic snap: when the ring is near an element marked [data-magnetic], it
 * is pulled toward that element's centre and swells. This is a Fitts's-law
 * cheat — the effective target is larger than the drawn one — and it doubles
 * as the curiosity cue, because the ring visibly "notices" things before the
 * user has decided to click them.
 *
 * Everything runs on one rAF writing only `transform`, so the layer never
 * leaves the compositor.
 */
export function Cursor() {
  const layerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  const fine = useFinePointer();
  const reduced = usePrefersReducedMotion();
  const active = fine && !reduced;

  useEffect(() => {
    if (!active) return;

    document.body.dataset.cursor = 'on';
    return () => {
      delete document.body.dataset.cursor;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;

    const dot = dotRef.current;
    const ring = ringRef.current;
    const layer = layerRef.current;
    if (!dot || !ring || !layer) return;

    // Start off-screen so nothing flashes at 0,0 before the first move.
    const target = { x: -100, y: -100 };
    const ringPos = { x: -100, y: -100 };
    let ringScale = 1;
    let targetScale = 1;
    let visible = false;
    let magnet: HTMLElement | null = null;
    let raf = 0;
    let last = performance.now();

    const onMove = (e: PointerEvent) => {
      target.x = e.clientX;
      target.y = e.clientY;

      if (!visible) {
        visible = true;
        layer.style.opacity = '1';
        // Teleport the ring on first sight rather than flying it in.
        ringPos.x = e.clientX;
        ringPos.y = e.clientY;
      }

      // Cheapest reliable hit test for the magnet target.
      const el = document.elementFromPoint(e.clientX, e.clientY);
      magnet = el
        ? (el.closest('[data-magnetic]') as HTMLElement | null)
        : null;
      targetScale = magnet ? 1.85 : 1;
    };

    const onDown = () => {
      targetScale = magnet ? 1.4 : 0.62;
    };
    const onUp = () => {
      targetScale = magnet ? 1.85 : 1;
    };
    const onLeave = () => {
      visible = false;
      layer.style.opacity = '0';
    };

    const tick = (now: number) => {
      // Clamp dt so a backgrounded tab does not produce one enormous step.
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      let aimX = target.x;
      let aimY = target.y;

      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        // Pull 55% of the way to centre — enough to feel assisted, not
        // enough to feel like the cursor was taken away.
        aimX = target.x + (cx - target.x) * 0.55;
        aimY = target.y + (cy - target.y) * 0.55;
      }

      // 0.0016 ≈ 99.84% of the gap closed per second: quick but visibly soft.
      ringPos.x = damp(ringPos.x, aimX, 0.0016, dt);
      ringPos.y = damp(ringPos.y, aimY, 0.0016, dt);
      ringScale = damp(ringScale, targetScale, 0.0009, dt);

      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0) scale(${ringScale})`;

      raf = requestAnimationFrame(tick);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, [active]);

  if (!active) return null;

  return (
    <div
      ref={layerRef}
      className="cursor-layer"
      aria-hidden="true"
      style={{ opacity: 0, transition: 'opacity 220ms ease' }}
    >
      <div ref={ringRef} className="cursor-ring" />
      <div ref={dotRef} className="cursor-dot" />
    </div>
  );
}
