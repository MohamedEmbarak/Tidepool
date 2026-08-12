'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Shared environment hooks.
 *
 * All of them are SSR-safe: they report a conservative default on the server
 * and the first client render, then correct themselves in an effect. That
 * ordering matters — reading `window` during render would break hydration.
 */

/** True when the OS asks for reduced motion. Physics loops idle when set. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/** True on devices with a precise pointer — gates the custom cursor. */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(pointer: fine)');
    setFine(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setFine(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return fine;
}

/**
 * Element visibility, used to park every animation loop that is off-screen.
 * This is the single largest win for the 60 FPS target: with four canvases
 * in the document, only the one under the viewport is ever stepping.
 */
export function useInView<T extends Element>(
  ref: React.RefObject<T | null>,
  rootMargin = '200px',
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return inView;
}

export type Tilt = { x: number; y: number };

/**
 * Device tilt, normalised to roughly -1..1 on each axis.
 *
 * iOS 13+ requires an explicit permission call from inside a user gesture,
 * so this exposes `request()` for the HUD button rather than asking on
 * mount. `supported` distinguishes "no sensor" from "not yet granted", which
 * lets the UI avoid advertising a control that can never work.
 */
export function useGyroscope(active: boolean) {
  const [tilt, setTilt] = useState<Tilt>({ x: 0, y: 0 });
  const [granted, setGranted] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== 'undefined' && 'DeviceOrientationEvent' in window,
    );
  }, []);

  useEffect(() => {
    if (!active || !granted) return;

    const onOrient = (e: DeviceOrientationEvent) => {
      // gamma: left/right (-90..90), beta: front/back (-180..180).
      const gx = (e.gamma ?? 0) / 45;
      const gy = ((e.beta ?? 0) - 45) / 45;
      setTilt({
        x: Math.max(-1, Math.min(1, gx)),
        y: Math.max(-1, Math.min(1, gy)),
      });
    };

    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [active, granted]);

  const request = async (): Promise<boolean> => {
    type Requestable = {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const DOE = window.DeviceOrientationEvent as unknown as
      | Requestable
      | undefined;

    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        const ok = res === 'granted';
        setGranted(ok);
        return ok;
      } catch {
        setGranted(false);
        return false;
      }
    }

    // Android / desktop: no permission gate, the event just fires (or not).
    setGranted(true);
    return true;
  };

  return { tilt, granted, supported, request };
}

/**
 * A ref holding the current scroll velocity in px/frame, smoothed.
 * Kept in a ref rather than state so reading it inside an rAF loop costs
 * nothing and never triggers a React render.
 */
export function useScrollVelocity(): React.RefObject<number> {
  const velocity = useRef(0);

  useEffect(() => {
    let last = window.scrollY;
    let raf = 0;

    const tick = () => {
      const now = window.scrollY;
      const delta = now - last;
      last = now;
      // Smooth toward the instantaneous delta so a flick decays instead of
      // snapping to zero the moment the finger leaves the glass.
      velocity.current += (delta - velocity.current) * 0.18;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return velocity;
}
