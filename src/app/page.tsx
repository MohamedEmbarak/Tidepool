'use client';
import dynamic from 'next/dynamic';
const Expedition = dynamic(() => import('@/components/Expedition'), { ssr: false, loading: () => <div className="loading-world"><span className="loading-orbit" /><p>Finding the current…</p></div> });
export default function Page() { return <Expedition />; }
