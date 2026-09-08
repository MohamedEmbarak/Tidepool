import * as T from 'three';

export const FIELD_OF_VIEW = 44;

export function viewDimensions(width: number, height: number, zoom: number) {
  const aspect = Math.max(0.2, width / Math.max(1, height));
  const viewWidth = (width < 700 ? 15 : width < 1000 ? 24 : 30) / zoom;
  const viewHeight = Math.max(12 / zoom, viewWidth / aspect);
  return { width: viewHeight * aspect, height: viewHeight, distance: viewHeight / (2 * Math.tan(FIELD_OF_VIEW * Math.PI / 360)) };
}

export class DiveCamera {
  readonly camera = new T.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 240);
  readonly focus = new T.Vector3();
  readonly right = new T.Vector3(1, 0, 0);
  readonly up = new T.Vector3(0, 1, 0);
  zoom = 1;
  yaw = 0;
  targetYaw = 0;
  pan = 0;
  width = 30;
  height = 20;
  private distance = 25;

  resize(width: number, height: number) {
    const view = viewDimensions(width, height, this.zoom);
    this.width = view.width; this.height = view.height; this.distance = view.distance;
    this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
  }
  orbit(pixels: number, width: number) { this.targetYaw -= pixels / Math.max(320, width) * Math.PI * 1.4; }
  reset() { this.zoom = 1; this.targetYaw = 0; this.pan = 0; }
  update(depth: number, dt: number, direct: boolean) {
    this.yaw += (this.targetYaw - this.yaw) * (direct ? 1 : 1 - Math.exp(-9 * dt));
    if (Math.abs(this.yaw) > Math.PI * 4) { const turns = Math.trunc(this.yaw / (Math.PI * 2)) * Math.PI * 2; this.yaw -= turns; this.targetYaw -= turns; }
    this.focus.set(Math.cos(this.yaw) * this.pan, -depth, -Math.sin(this.yaw) * this.pan);
    const horizontal = this.distance * 0.985;
    this.camera.position.set(this.focus.x + Math.sin(this.yaw) * horizontal, -depth + this.distance * 0.173, this.focus.z + Math.cos(this.yaw) * horizontal);
    this.camera.lookAt(this.focus); this.camera.updateMatrixWorld(true);
    this.right.setFromMatrixColumn(this.camera.matrixWorld, 0); this.up.setFromMatrixColumn(this.camera.matrixWorld, 1);
  }
}
