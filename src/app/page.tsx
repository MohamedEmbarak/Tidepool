'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Cursor } from '@/components/Cursor';
import { Hud } from '@/components/Hud';
import { usePrefersReducedMotion } from '@/lib/hooks';
import { audio } from '@/lib/audio';
import { PlaygroundProvider } from '@/lib/store';

/**
 * The descent.
 *
 * Every scene is dynamically imported with ssr:false. Three.js + Rapier is
 * roughly two thirds of the JavaScript in this project and none of it is
 * needed to paint the first screen, so it is fetched as the user falls
 * toward it rather than before they see anything.
 *
 * Scroll orchestration rules:
 *  - Nothing is pinned, snapped, or hijacked. The user's scroll is theirs.
 *    Every "scroll-jacking" pattern trades the user's sense of control for
 *    the author's sense of choreography, and control is the more valuable of
 *    the two in a piece whose whole claim is that it is calming.
 *  - Sections overlap slightly and cross-fade, so there is never a hard cut.
 *  - Only the section under the viewport is unpaused; the rest are frozen.
 */

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

const SurfaceScene = dynamic(() => import('@/scenes/SurfaceScene'), {
  ssr: false,
  loading: sceneLoading,
});
const DriftScene = dynamic(() => import('@/scenes/DriftScene'), {
  ssr: false,
  loading: sceneLoading,
});
const KelpScene = dynamic(() => import('@/scenes/KelpScene'), {
  ssr: false,
  loading: sceneLoading,
});
const DeepScene = dynamic(() => import('@/scenes/DeepScene'), {
  ssr: false,
  loading: sceneLoading,
});

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
  const reduced = usePrefersReducedMotion();

  const [depth, setDepth] = useState(0);
  const [activeSection, setActiveSection] = useState<SectionId>(0);
  const lastSwell = useRef<SectionId | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      /* ---- depth: one trigger drives the whole document's colour ---- */
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const p = self.progress;
          setDepth(p);
          document.documentElement.style.setProperty('--depth', p.toFixed(4));
        },
      });

      /* ---- per-section activation + parallax ---- */
      const sections = gsap.utils.toArray<HTMLElement>('[data-section]');

      sections.forEach((el, i) => {
        ScrollTrigger.create({
          trigger: el,
          start: 'top 65%',
          end: 'bottom 35%',
          onToggle: (self) => {
            if (!self.isActive) return;
            const id = i as SectionId;
            setActiveSection(id);
            if (lastSwell.current !== id) {
              lastSwell.current = id;
              audio.swell(i / 3);
            }
          },
        });

        if (reduced) return;

        // Parallax with per-layer weight. Copy rises faster than the canvas
        // behind it, which is what produces the sense of falling *past*
        // something rather than scrolling a flat page.
        const copy = el.querySelector('[data-parallax="copy"]');
        if (copy) {
          // The first section is already on screen at load, so fading it in
          // from a scroll position the user never occupied would just make
          // the hero permanently dim. It gets drift, not a fade.
          const fades = i > 0;

          gsap.fromTo(
            copy,
            { yPercent: 14, ...(fades ? { opacity: 0.25 } : null) },
            {
              yPercent: -14,
              ...(fades ? { opacity: 1 } : null),
              ease: 'none',
              scrollTrigger: {
                trigger: el,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1.1, // >0 adds momentum: the copy lags the scroll
              },
            },
          );
        }
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reduced]);

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
          scene={<SurfaceScene paused={activeSection !== 0} depth={depth} />}
        />

        <Section
          index={1}
          active={activeSection === 1}
          eyebrow="400 m · Drift"
          title="Squeeze something soft."
          lede="Grab a jelly and pull. They stretch, they wobble back, and they remember the shape of the tug for a second afterwards. Two fingers work as well as one."
          scene={<DriftScene paused={activeSection !== 1} depth={depth} />}
        />

        <Section
          index={2}
          active={activeSection === 2}
          eyebrow="800 m · Kelp"
          title="Run your hand through it."
          lede="The forest parts around you and closes again. It is already breathing on its own, slowly, about six times a minute. On a phone, tilt the screen and the current follows."
          scene={<KelpScene paused={activeSection !== 2} depth={depth} />}
        />

        <Section
          index={3}
          active={activeSection === 3}
          eyebrow="1200 m · Deep"
          title="Something is down here."
          lede="Move slowly. Shapes only show themselves when you get close, and they do not surface on any schedule you can learn. Tap one when you find it."
          scene={<DeepScene paused={activeSection !== 3} depth={depth} />}
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

      <div className="section__copy" data-parallax="copy">
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
