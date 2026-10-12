import React, { useEffect, useRef } from 'react';

/**
 * Soft cinematic spotlight that follows the pointer.
 * - Pointer position is written to CSS variables inside a single rAF per frame,
 *   so there is no React re-render and no canvas work.
 * - The glow is a fixed, pointer-events-none radial gradient composited on the
 *   GPU (translate-free, only a variable change).
 * - Disabled for coarse pointers (touch) and when reduced motion is requested.
 */
export const CursorSpotlight: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window.matchMedia !== 'function') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (reduced.matches || !finePointer.matches) return;

    let frame = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;

    const paint = () => {
      frame = 0;
      el.style.setProperty('--spot-x', `${x}px`);
      el.style.setProperty('--spot-y', `${y}px`);
    };
    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el.style.opacity = '1';
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onLeave = () => {
      el.style.opacity = '0';
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="cursor-spotlight pointer-events-none fixed inset-0 z-30 opacity-0 transition-opacity duration-500 motion-reduce:hidden"
    />
  );
};
