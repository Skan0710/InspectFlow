import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { animate } from 'framer-motion';

export interface SpotlightNavItem {
  label: string;
  href: string;
}

interface SpotlightNavbarProps {
  items: SpotlightNavItem[];
  /** Index of the active item, or -1 when no item is active */
  activeIndex: number;
  className?: string;
}

/**
 * Floating pill navigation with a pointer-following spotlight and an
 * "ambience" glow that rests under the active item.
 */
export function SpotlightNavbar({ items, activeIndex, className = '' }: SpotlightNavbarProps) {
  const navRef = useRef<HTMLElement>(null);
  const spotlightX = useRef(0);
  const ambienceX = useRef(0);
  const [hovering, setHovering] = useState(false);

  const centerOf = (nav: HTMLElement, index: number): number | null => {
    const item = nav.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!item) return null;
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    return itemRect.left - navRect.left + itemRect.width / 2;
  };

  // Rest the ambience under the active item
  useEffect(() => {
    const nav = navRef.current;
    if (!nav || activeIndex < 0) return;
    const target = centerOf(nav, activeIndex);
    if (target === null) return;
    const controls = animate(ambienceX.current || target, target, {
      type: 'spring',
      stiffness: 200,
      damping: 22,
      onUpdate: (v) => {
        ambienceX.current = v;
        nav.style.setProperty('--ambience-x', `${v}px`);
      },
    });
    return () => controls.stop();
  }, [activeIndex, items.length]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX - nav.getBoundingClientRect().left;
      spotlightX.current = x;
      nav.style.setProperty('--spotlight-x', `${x}px`);
      setHovering(true);
    };
    const onLeave = () => setHovering(false);
    nav.addEventListener('mousemove', onMove);
    nav.addEventListener('mouseleave', onLeave);
    return () => {
      nav.removeEventListener('mousemove', onMove);
      nav.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Primary"
      className={`relative h-11 overflow-hidden rounded-full border border-white/20 bg-white/10 shadow-lg shadow-indigo-950/30 backdrop-blur-md ${className}`}
    >
      <ul className="relative z-10 flex h-full items-center gap-0.5 px-1.5">
        {items.map((item, idx) => {
          const active = idx === activeIndex;
          return (
            <li key={item.href} className="flex h-full items-center">
              <Link
                to={item.href}
                data-index={idx}
                aria-current={active ? 'page' : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200 ${
                  active ? 'bg-white/15 text-white' : 'text-white/90 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-300"
        style={{
          opacity: hovering ? 1 : 0,
          background:
            'radial-gradient(120px circle at var(--spotlight-x, 50%) 100%, rgba(165,180,252,0.35) 0%, transparent 60%)',
        }}
      />
      {activeIndex >= 0 && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 z-[2] h-[2px] w-full"
          style={{
            background:
              'radial-gradient(60px circle at var(--ambience-x, 50%) 0%, rgba(224,231,255,1) 0%, transparent 100%)',
          }}
        />
      )}
    </nav>
  );
}
