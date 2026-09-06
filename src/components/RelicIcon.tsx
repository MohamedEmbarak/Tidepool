import type { RelicId } from '@/world/catalog';
export function RelicIcon({ id }: { id: RelicId }) {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="relic-icon"><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {id === 'pearl' && <><path d="M13 46q27 34 54 0M13 46q27 11 54 0M17 46l8 10m1-8 6 12m8-11v13m8-14-3 12m12-13-7 11"/><circle cx="40" cy="35" r="13" fill="currentColor" fillOpacity=".2"/><path d="M34 29q4-4 9-2"/></>}
    {id === 'bottle' && <g transform="rotate(18 40 40)"><path d="M34 10h12v12l8 11v31q-14 6-28 0V33l8-11V10z" fill="currentColor" fillOpacity=".12"/><path d="M34 15h12M26 36h28M26 59h28M37 35h7v20h-7z"/><path d="M34 9h12v7H34z" fill="currentColor" fillOpacity=".4"/></g>}
    {id === 'compass' && <><circle cx="40" cy="43" r="24" fill="currentColor" fillOpacity=".12"/><circle cx="40" cy="43" r="19"/><circle cx="40" cy="13" r="5"/><path d="m46 28-3 18-9 12 3-18 9-12z" fill="currentColor" fillOpacity=".4"/><path d="M40 22v5m0 32v5M19 43h5m32 0h5"/></>}
    {id === 'key' && <g transform="rotate(30 40 40)"><circle cx="40" cy="22" r="12"/><circle cx="40" cy="22" r="7"/><path d="M37 34v33h17v-8h-6v-7h-5V34" fill="currentColor" fillOpacity=".2"/></g>}
    {id === 'lantern' && <><circle cx="40" cy="12" r="5"/><path d="m22 28 18-11 18 11-5 35H27l-5-35zM22 28h36M27 63h26M30 28v35m20-35v35"/><path d="m40 33 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" fill="currentColor" fillOpacity=".5"/></>}
    {id === 'moon' && <><ellipse cx="40" cy="40" rx="31" ry="16" transform="rotate(30 40 40)"/><ellipse cx="40" cy="40" rx="31" ry="16" transform="rotate(-40 40 40)"/><path d="m40 22 16 10v17L40 59 24 49V32l16-10zM24 32l16 10 16-10M40 42v17" fill="currentColor" fillOpacity=".24"/></>}
  </g></svg>;
}
