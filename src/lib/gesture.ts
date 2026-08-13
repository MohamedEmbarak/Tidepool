/**
 * Touch arbitration between the page and a scene.
 *
 * On a phone the toys and the scroll share the same pixels, and the browser
 * resolves that conflict in the scroller's favour: with `touch-action: pan-y`
 * any drag carrying a vertical component is claimed as a scroll, and the
 * moment it is, the scene receives `pointercancel` and drops whatever the
 * finger was holding. The result is that taps work and drags never do.
 *
 * Removing `pan-y` is not the fix — a full-bleed canvas with `touch-action:
 * none` leaves the user no way to scroll past the section at all.
 *
 * So the gesture is arbitrated instead. A flick is left to the page; the scene
 * takes it only when the intent is unambiguous:
 *
 *  - the finger landed on something grabbable (`shouldGrab`), or
 *  - it stayed put for `holdMs` — a press, which is nobody's idea of a
 *    scroll, or
 *  - it set off clearly sideways, a direction the page cannot go, or
 *  - a second finger arrived; `pan-y` has already ruled out pinch-zoom, so two
 *    fingers here can only mean a squeeze.
 *
 * Once the scene has the gesture, `preventDefault` on each move keeps the
 * scroller out. Every route to a grab requires the finger to have been still
 * or to have moved sideways, so no scroll has begun by that point and the move
 * is still cancelable.
 *
 * The vertical flick is deliberately left alone. Scroll is the one gesture the
 * piece promises never to take.
 */
export type GrabOptions = {
  /** Client coordinates; return true if the scene wants this touch outright. */
  shouldGrab?: (clientX: number, clientY: number) => boolean;
  /** How long the finger must hold still to count as a press. */
  holdMs?: number;
  /** Movement below this (px) still counts as holding still. */
  slop?: number;
};

export function arbitrateTouch(
  el: HTMLElement,
  { shouldGrab, holdMs = 160, slop = 10 }: GrabOptions = {},
): () => void {
  let startX = 0;
  let startY = 0;
  let grabbed = false;
  let conceded = false; // resolved as a scroll; stay out of the way until lift
  let timer = 0;

  const clearTimer = () => {
    if (timer) window.clearTimeout(timer);
    timer = 0;
  };

  const onStart = (e: TouchEvent) => {
    if (e.touches.length > 1) {
      grabbed = true;
      clearTimer();
      return;
    }

    clearTimer();
    grabbed = false;
    conceded = false;

    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;

    if (shouldGrab?.(startX, startY)) {
      grabbed = true;
      return;
    }

    timer = window.setTimeout(() => {
      timer = 0;
      grabbed = true;
    }, holdMs);
  };

  const onMove = (e: TouchEvent) => {
    if (grabbed) {
      // Not cancelable once the scroller already owns the gesture; calling
      // preventDefault then achieves nothing but a console violation.
      if (e.cancelable) e.preventDefault();
      return;
    }
    if (conceded) return;

    const t = e.touches[0];
    if (!t) return;

    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (Math.hypot(dx, dy) < slop) return;

    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      grabbed = true;
      clearTimer();
      if (e.cancelable) e.preventDefault();
    } else {
      conceded = true;
      clearTimer();
    }
  };

  const onEnd = (e: TouchEvent) => {
    if (e.touches.length > 0) return; // other fingers are still down
    clearTimer();
    grabbed = false;
    conceded = false;
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd, { passive: true });
  el.addEventListener('touchcancel', onEnd, { passive: true });

  return () => {
    clearTimer();
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onEnd);
  };
}
