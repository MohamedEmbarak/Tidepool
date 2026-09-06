'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, memo, type ReactNode } from 'react';
import { Cursor } from '@/components/Cursor';
import { Hud } from '@/components/Hud';
import { audio } from '@/lib/audio';
import { PlaygroundProvider } from '@/lib/store';

const sceneLoading = () => (
  <div
    className="section__canvas"
    aria-hidden="true"
    style={{
      display: 'grid',
      placeItems: 'center',
      color: 'var(--ink-faint)',
      fontSize: '0.7rem',
      letterSpacing: '0.3em',
      textTransform: 'uppercase',
    }}
  >
    settling…
  </div>
);

const SurfaceScene = memo(dynamic(() => import('@/scenes/SurfaceScene'), {
  ssr: false,
  loading: sceneLoading,
}));
const DriftScene = memo(dynamic(() => import('@/scenes/DriftScene'), {
  ssr: false,
  loading: sceneLoading,
}));
const KelpScene = memo(dynamic(() => import('@/scenes/KelpScene'), {
  ssr: false,
  loading: sceneLoading,
}));
const DeepScene = memo(dynamic(() => import('@/scenes/DeepScene'), {
  ssr: false,
  loading: sceneLoading,
}));

type SectionId = 0 | 1 | 2 | 3;

export default function Page() {
  return (
    <PlaygroundProvider>
      <Descent />
    </PlaygroundProvider>
  );
}

function Descent() {
  const rootRef = useRef<HTMLDivElement>(null);

  const [depth, setDepth] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionId>(0);
  const lastSwell = useRef<SectionId | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const sections = gsap.utils.toArray<HTMLElement>('[data-section]');
      const update = () => {
        const maxScroll = document.documentElement.scrollHeight - innerHeight;
        const p = Math.round(Math.min(1, Math.max(0, scrollY / Math.max(1, maxScroll))) * 100) / 100;
        setDepth(p);
        document.documentElement.style.setProperty('--depth', String(p));
        const centre = scrollY + innerHeight / 2;
        let id: SectionId = 0;
        sections.forEach((el, i) => {
          if (el.offsetTop <= centre) id = i as SectionId;
        });
        setActiveSection(id);
        if (lastSwell.current !== id) {
          lastSwell.current = id;
          audio.swell(id / 3);
        }
      };
      ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: update,
        onRefresh: update,
      });
      update();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={rootRef}>
      <Cursor />
      <Hud depth={depth} />

      <main>
        <Section
          index={0}
          active={activeSection === 0}
          eyebrow="0 m · Surface"
          title="Everything here is touchable."
          lede="Push the floats. Nothing here can be broken, nothing is keeping score, and there is no way to do this wrong. Keep going down when you feel like it."
          scene={<SurfaceScene paused={activeSection !== 0} depth={0.0000} />}
        />

        <Section
          index={1}
          active={activeSection === 1}
          eyebrow="400 m · Drift"
          title="Squeeze something soft."
          lede="Grab a jelly and pull. They stretch, they wobble back, and they remember the shape of the tug for a second afterwards. Two fingers work as well as one."
          scene={<DriftScene paused={activeSection !== 1} depth={0.3333} />}
        />

        <Section
          index={2}
          active={activeSection === 2}
          eyebrow="800 m · Kelp"
          title="Run your hand through it."
          lede="The forest parts around you and closes again. It is already breathing on its own, slowly, about six times a minute. On a phone, tilt the screen and the current follows."
          scene={<KelpScene paused={activeSection !== 2} depth={0.6667} />}
        />

        <Section
          index={3}
          active={activeSection === 3}
          eyebrow="1200 m · Deep"
          title="Something is down here."
          lede="Move slowly. Shapes only show themselves when you get close, and they do not surface on any schedule you can learn. Tap one when you find it."
          scene={<DeepScene paused={activeSection !== 3} depth={1.0000} />}
          last
        />
      </main>

      <footer
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '4rem clamp(1.5rem, 5vw, 5rem) 5rem',
          color: 'var(--ink-faint)',
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          lineHeight: 1.9,
          maxWidth: '42ch',
        }}
      >
        <p style={{ margin: 0 }}>
          Tidepool · built to be fidgeted with. No account, no streak, nothing
          to lose by leaving.
        </p>
      </footer>
    </div>
  );
}

function Section({
  index,
  active,
  eyebrow,
  title,
  lede,
  scene,
  last = false,
}: {
  index: number;
  active: boolean;
  eyebrow: string;
  title: string;
  lede: string;
  scene: ReactNode;
  last?: boolean;
}) {
  return (
    <section
      data-section={index}
      /* Layout lives in CSS, not here: the phone breakpoint has to be able to
         override the vertical centring, and an inline style cannot be. */
      className={last ? 'section section--last' : 'section'}
      aria-label={eyebrow}
    >
      <div className="section__canvas">{scene}</div>

      <div className="section__copy">
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="headline" data-magnetic>
          {title}
        </h2>
        <p className="lede">{lede}</p>

        {index === 0 && (
          <p
            className="eyebrow"
            aria-hidden="true"
            style={{
              marginTop: '2.5rem',
              opacity: active ? 0.85 : 0.3,
              transition: 'opacity 600ms ease',
            }}
          >
            ↓ scroll to descend
          </p>
        )}
      </div>
    </section>
  );
}
