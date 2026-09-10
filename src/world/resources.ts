export function renderPixelRatio(width: number, height: number, deviceRatio: number, deviceMemory = 8) {
  const limited = deviceMemory <= 4;
  return Math.min(deviceRatio || 1, limited ? 1 : 1.5, Math.sqrt((limited ? 1000000 : 2000000) / Math.max(1, width * height)));
}
