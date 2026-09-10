import type { RelicId } from '@/world/catalog';
export function RelicIcon({ id }: { id: RelicId }) {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="relic-icon"><g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    {id === 'pearl' && <><path d="M13 46q27 34 54 0M13 46q27 11 54 0M17 46l8 10m1-8 6 12m8-11v13m8-14-3 12m12-13-7 11"/><circle cx="40" cy="35" r="13" fill="currentColor" fillOpacity=".2"/><path d="M34 29q4-4 9-2"/></>}
    {id === 'bottle' && <g transform="rotate(18 40 40)"><path d="M34 10h12v12l8 11v31q-14 6-28 0V33l8-11V10z" fill="currentColor" fillOpacity=".12"/><path d="M34 15h12M26 36h28M26 59h28M37 35h7v20h-7z"/><path d="M34 9h12v7H34z" fill="currentColor" fillOpacity=".4"/></g>}
    {id === 'compass' && <><circle cx="40" cy="43" r="24" fill="currentColor" fillOpacity=".12"/><circle cx="40" cy="43" r="19"/><circle cx="40" cy="13" r="5"/><path d="m46 28-3 18-9 12 3-18 9-12z" fill="currentColor" fillOpacity=".4"/><path d="M40 22v5m0 32v5M19 43h5m32 0h5"/></>}
    {id === 'key' && <g transform="rotate(30 40 40)"><circle cx="40" cy="22" r="12"/><circle cx="40" cy="22" r="7"/><path d="M37 34v33h17v-8h-6v-7h-5V34" fill="currentColor" fillOpacity=".2"/></g>}
    {id === 'lantern' && <><circle cx="40" cy="12" r="5"/><path d="m22 28 18-11 18 11-5 35H27l-5-35zM22 28h36M27 63h26M30 28v35m20-35v35"/><path d="m40 33 3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" fill="currentColor" fillOpacity=".5"/></>}
    {id === 'amber' && <><path d="m40 17 16 12 3 24-19 13-18-13 3-24z" fill="currentColor" fillOpacity=".25"/><circle cx="40" cy="41" r="9"/><path d="M40 26v6m0 18v6M25 41h6m18 0h6m-26-11 5 5m12 12 5 5m0-22-5 5M34 47l-5 5"/></>}
    {id === 'medallion' && <><circle cx="40" cy="42" r="24"/><circle cx="40" cy="42" r="19"/><circle cx="40" cy="12" r="5"/><path d="m40 26 4 11 12 1-9 8 3 11-10-6-10 6 3-11-9-8 12-1z" fill="currentColor" fillOpacity=".25"/></>}
    {id === 'rune' && <><path d="m26 15 23-4 11 17-5 34-29 5-7-25z" fill="currentColor" fillOpacity=".18"/><path d="m30 55 10-34 11 24M32 37l20-8" strokeWidth="3"/></>}
    {id === 'moon' && <><circle cx="40" cy="40" r="26" fill="currentColor" fillOpacity=".18"/><circle cx="30" cy="31" r="7"/><circle cx="49" cy="46" r="9"/><circle cx="31" cy="53" r="4"/><path d="M45 24a4 4 0 0 1 5 4M22 42l2 1M50 60l3-2"/></>}
  </g></svg>;
}
