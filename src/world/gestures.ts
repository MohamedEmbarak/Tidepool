export type Point = { x: number; y: number };
export type GestureTarget = { kind: 'creature' | 'relic' | 'scenery'; value: unknown; holdable?: boolean };
export type GestureCallbacks = {
  hit: (point: Point) => GestureTarget | null;
  start: () => void;
  navigate: (dx: number, dy: number, twoFinger: boolean) => void;
  drag: (target: GestureTarget, dx: number, dy: number) => void;
  tap: (target: GestureTarget | null, point: Point) => void;
  hold: (target: GestureTarget, point: Point) => void;
  zoom: (ratio: number, centre: Point) => void;
  release: (velocityY: number) => void;
  reset: () => void;
};

/** Pointer IDs own a gesture until release/cancel; changing finger count rebases it. */
export class DiveGestures {
  readonly pointers = new Map<number, Point>();
  private origin: Point = { x: 0, y: 0 };
  private target: GestureTarget | null = null;
  private moved = false;
  private held = false;
  private multiple = false;
  private lastMove = 0;
  private velocity = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastTap: { point: Point; time: number } | null = null;

  constructor(private callbacks: GestureCallbacks) {}
  get active() { return this.pointers.size > 0; }
  private clearHold() { if (this.timer) clearTimeout(this.timer); this.timer = null; }
  private pair() {
    const [a, b] = [...this.pointers.values()];
    return { centre: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, distance: Math.max(12, Math.hypot(a.x - b.x, a.y - b.y)) };
  }
  down(id: number, point: Point, now: number, touch: boolean) {
    this.pointers.set(id, point); this.callbacks.start(); this.clearHold();
    this.velocity = 0; this.lastMove = now;
    if (this.pointers.size > 1) { this.multiple = true; this.moved = true; this.target = null; return; }
    this.multiple = false; this.moved = false; this.held = false; this.origin = point;
    this.target = this.callbacks.hit(point);
    if (this.target && (this.target.holdable || touch && this.target.kind === 'relic')) {
      this.timer = setTimeout(() => { this.held = true; if (this.target) this.callbacks.hold(this.target, point); }, this.target.holdable ? 650 : 420);
    }
  }
  move(id: number, point: Point, now: number) {
    const old = this.pointers.get(id); if (!old) return;
    if (this.pointers.size >= 2) {
      const before = this.pair(); this.pointers.set(id, point); const after = this.pair();
      this.callbacks.navigate(after.centre.x - before.centre.x, after.centre.y - before.centre.y, true);
      this.callbacks.zoom(after.distance / before.distance, after.centre); return;
    }
    this.pointers.set(id, point);
    const dx = point.x - old.x, dy = point.y - old.y;
    if (Math.hypot(point.x - this.origin.x, point.y - this.origin.y) > 8) { this.moved = true; this.clearHold(); }
    const elapsed = Math.max(8, now - this.lastMove);
    this.velocity = this.velocity * 0.55 + dy / elapsed * 1000 * 0.45; this.lastMove = now;
    if (!this.moved) return;
    if (this.target?.kind === 'creature') this.callbacks.drag(this.target, dx, dy);
    else this.callbacks.navigate(dx, dy, false);
  }
  up(id: number, point: Point, now: number, cancelled = false) {
    if (!this.pointers.has(id)) return;
    this.pointers.delete(id); this.clearHold();
    if (this.pointers.size) { this.origin = [...this.pointers.values()][0]; this.moved = true; this.target = null; this.velocity = 0; return; }
    if (!cancelled && !this.multiple && !this.moved && !this.held) {
      if (!this.target && this.lastTap && now - this.lastTap.time < 320 && Math.hypot(point.x - this.lastTap.point.x, point.y - this.lastTap.point.y) < 30) {
        this.callbacks.reset(); this.lastTap = null;
      } else { this.callbacks.tap(this.target, point); this.lastTap = this.target ? null : { point, time: now }; }
    }
    this.callbacks.release(!cancelled && !this.multiple && this.moved && this.target?.kind !== 'creature' && now - this.lastMove < 100 ? this.velocity : 0);
    this.target = null; this.velocity = 0;
  }
  cancel() { this.clearHold(); this.pointers.clear(); this.target = null; this.velocity = 0; this.lastTap = null; this.callbacks.release(0); }
}
