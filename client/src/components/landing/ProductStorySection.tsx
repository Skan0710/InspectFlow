import React from 'react';
import { DiagonalCarousel, type DiagonalCarouselItem } from '../ui/diagonal-carousel';

const CAROUSEL_ITEMS: DiagonalCarouselItem[] = [
  {
    src: '/carousel/ingestion.svg',
    title: 'Streaming Ingestion Pipeline',
    alt: 'Ingestion Pipeline',
  },
  {
    src: '/carousel/grounding.svg',
    title: 'Grounded Semantic Analysis',
    alt: 'AI Grounding',
  },
  {
    src: '/carousel/matrix.svg',
    title: 'Deterministic Triage Matrix',
    alt: 'Priority Matrix',
  },
  {
    src: '/carousel/actions.svg',
    title: 'Closed-Loop Action Tracking',
    alt: 'Action Center',
  },
  {
    src: '/carousel/reports.svg',
    title: 'Executive PDF & CSV Delivery',
    alt: 'Executive Delivery',
  },
];

export const ProductStorySection: React.FC = () => (
  <section aria-labelledby="how-it-works" className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-900/60 via-indigo-950/80 to-violet-950/70 p-6 shadow-xl shadow-black/20 sm:p-8">
    <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/20 blur-3xl" />
    <div className="relative">
      <h2 id="how-it-works" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
        From raw reviews to ranked actions
      </h2>
      <p className="mt-1 max-w-xl text-sm text-indigo-100">
        Five steps, every number traceable to a real feedback record.
      </p>
    </div>
    <div className="relative mt-4 h-[440px] w-full sm:h-[500px]">
      <DiagonalCarousel
        items={CAROUSEL_ITEMS}
        slideSize={240}
        rotationStep={18}
        verticalStep={56}
        inactiveScale={0.68}
        loop={true}
        imageClassName="ring-1 ring-white/25 shadow-2xl shadow-black/40"
        labelClassName="text-white font-medium"
        controlsClassName="border-white/20 bg-indigo-950/80 text-white backdrop-blur-md"
        className="h-full overflow-visible"
        viewportClassName="overflow-visible"
      />
    </div>
  </section>
);
