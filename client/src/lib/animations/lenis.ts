import Lenis from 'lenis';
import { gsap, ScrollTrigger, prefersReducedMotion } from './gsap';

export interface LenisInstanceWrapper {
  lenis: Lenis | null;
  destroy: () => void;
}

/**
 * Initializes Lenis smooth scrolling with GSAP ScrollTrigger ticker integration.
 * Respects prefers-reduced-motion by keeping native browser scrolling active.
 */
export function initLenis(): LenisInstanceWrapper {
  if (typeof window === 'undefined') {
    return { lenis: null, destroy: () => {} };
  }

  // Fall back immediately to native scrolling if user prefers reduced motion
  if (prefersReducedMotion()) {
    return { lenis: null, destroy: () => {} };
  }

  const lenis = new Lenis({
    duration: 1.15,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    touchMultiplier: 1,
    wheelMultiplier: 1,
    prevent: (node: HTMLElement) => {
      // Preserve native scrolling on nested interactive elements:
      // tables, selects, dialogs, drawers, code blocks, and data-lenis-prevent items
      let el: HTMLElement | null = node;
      while (el && el !== document.body) {
        if (
          el.hasAttribute('data-lenis-prevent') ||
          el.classList.contains('lenis-prevent') ||
          el.getAttribute('role') === 'dialog' ||
          el.tagName === 'TABLE' ||
          el.tagName === 'SELECT'
        ) {
          return true;
        }

        // Avoid capturing nested scrollable containers with active overflowing content
        const overflowY = window.getComputedStyle(el).overflowY;
        if (
          (overflowY === 'auto' || overflowY === 'scroll') &&
          el.scrollHeight > el.clientHeight
        ) {
          return true;
        }

        el = el.parentElement;
      }
      return false;
    },
  });

  // 1. Synchronize Lenis scroll updates with GSAP ScrollTrigger
  const handleScroll = () => {
    ScrollTrigger.update();
  };
  lenis.on('scroll', handleScroll);

  // 2. Drive Lenis updates directly from GSAP ticker for synchronous frame delivery
  const tickerHandler = (time: number) => {
    lenis.raf(time * 1000);
  };
  gsap.ticker.add(tickerHandler);

  // 3. Disable GSAP lag smoothing to eliminate stutter during heavier frame bursts
  gsap.ticker.lagSmoothing(0);

  const destroy = () => {
    gsap.ticker.remove(tickerHandler);
    lenis.off('scroll', handleScroll);
    lenis.destroy();
  };

  return { lenis, destroy };
}
