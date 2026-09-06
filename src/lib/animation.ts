/** Stop scheduling frames when a canvas is offscreen or the tab is hidden. */
export function animateVisible(host: HTMLElement, frame: (now: number) => void) {
  let visible = false;
  let raf = 0;
  let last = 0;
  const tick = (now: number) => {
    // Keep frame-based simulations consistent on high refresh rate displays.
    if (now - last >= 1000 / 60 - 1) {
      last = now;
      frame(now);
    }
    raf = requestAnimationFrame(tick);
  };
  const sync = () => {
    cancelAnimationFrame(raf);
    if (visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(tick);
    }
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  });
  observer.observe(host);
  document.addEventListener('visibilitychange', sync);
  return () => {
    cancelAnimationFrame(raf);
    observer.disconnect();
    document.removeEventListener('visibilitychange', sync);
  };
}
