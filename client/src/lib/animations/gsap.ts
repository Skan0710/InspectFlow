import { useEffect, useRef, type DependencyList } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register ScrollTrigger safely in browser context
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * Checks whether user has enabled prefers-reduced-motion in OS/browser.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * React-safe hook for running GSAP animations with automatic context cleanup.
 * Guarantees that all tweens and ScrollTriggers created within the callback
 * are cleanly reverted on unmount, preventing memory leaks and StrictMode duplication.
 *
 * @param scopeRef React ref to the root container element
 * @param callback Function where GSAP animations and ScrollTriggers are created
 * @param deps Dependency list for re-executing the animation context
 */
export function useGsapContext(
  scopeRef: React.RefObject<HTMLElement | null>,
  callback: (ctx: gsap.Context) => void,
  deps: DependencyList = []
): void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!scopeRef.current) return;

    // Create GSAP context scoped to container
    const ctx = gsap.context((self) => {
      callbackRef.current(self);
    }, scopeRef);

    return () => {
      ctx.revert(); // Automatically kills all tweens & ScrollTriggers created inside
    };
  }, [scopeRef, ...deps]);
}

export { gsap, ScrollTrigger };
