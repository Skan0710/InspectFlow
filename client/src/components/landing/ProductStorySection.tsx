import React, { useRef } from 'react';
import { 
  FileSpreadsheet, 
  BrainCircuit, 
  Layers, 
  CheckCircle2, 
  ArrowRight, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { gsap, useGsapContext, prefersReducedMotion } from '../../lib/animations/gsap';
import { DiagonalCarousel, type DiagonalCarouselItem } from '../ui/diagonal-carousel';
import { LineHoverLink } from '../ui/line-hover-link';

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

export const ProductStorySection: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useGsapContext(containerRef, () => {
    if (prefersReducedMotion()) return;

    // Headline entrance
    gsap.from('.story-header', {
      scrollTrigger: {
        trigger: '.story-header',
        start: 'top 85%',
        toggleActions: 'play none none none',
      },
      opacity: 0,
      y: 28,
      duration: 0.8,
      ease: 'power3.out',
    });

    // Staggered cards reveal
    gsap.from('.story-card', {
      scrollTrigger: {
        trigger: '.story-cards-container',
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
      opacity: 0,
      y: 35,
      stagger: 0.18,
      duration: 0.85,
      ease: 'power3.out',
    });

    // Interactive progress pulse
    gsap.fromTo(
      '.story-step-indicator',
      { scale: 0.85, opacity: 0.4 },
      {
        scale: 1,
        opacity: 1,
        duration: 1.2,
        stagger: 0.2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }
    );
  });

  const steps = [
    {
      step: '01',
      title: 'Multichannel Voice Ingestion',
      subtitle: 'Raw Customer Reviews',
      description: 'Stream structured CSVs, Zendesk tickets, or direct customer survey inputs. Every record is cryptographically content-hashed to eliminate duplicates while preserving the raw source truth.',
      icon: FileSpreadsheet,
      accent: 'indigo',
      tag: 'Raw Data Layer',
      example: '"The batch export crashes on large datasets with 504 timeout..."',
    },
    {
      step: '02',
      title: 'AI Sentiment & Semantic Analysis',
      subtitle: 'Zero-Hallucination Extraction',
      description: 'Structured Gemini and OpenAI extraction models calibrate sentiment (-1 to +1), evaluate severity (1 to 5), and extract key evidence phrases grounded directly in the user review.',
      icon: BrainCircuit,
      accent: 'violet',
      tag: 'Semantic Engine',
      example: 'Sentiment: Negative (-0.85) • Severity: 4/5 • Topic: Export Timeout',
    },
    {
      step: '03',
      title: 'Deterministic Priority Scoring',
      subtitle: 'Multi-Factor Mathematical Ranking',
      description: 'Issues are clustered by semantic similarity and ranked via deterministic formulas balancing Frequency Points (40%), Severity Points (35%), and Negative Ratio (25%). No black-box guesses.',
      icon: Layers,
      accent: 'amber',
      tag: 'Priority Matrix',
      example: 'Priority Score: 88/100 [CRITICAL] • 42 mentions (28 unique)',
    },
    {
      step: '04',
      title: 'Closed-Loop Action & Intelligence',
      subtitle: 'Executive Decision Automation',
      description: 'Action Center manages ownership and ticket resolution statuses, while automated report generation compiles executive briefings, PDF documents, and CSV digests.',
      icon: CheckCircle2,
      accent: 'emerald',
      tag: 'Actionable Delivery',
      example: 'Assigned to Engineering • Action: Implement Streaming • PDF Ready',
    },
  ];

  return (
    <section ref={containerRef} className="py-10 space-y-8">
      {/* Section Header */}
      <div className="story-header text-center max-w-3xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-3.5 py-1 text-xs font-semibold text-indigo-700 shadow-2xs">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          End-to-End Analytical Architecture
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
          The InsightFlow Journey:{' '}
          <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-800 bg-clip-text text-transparent">
            Raw Customer Voice to Executive Action
          </span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          From unorganized user feedback to evidence-backed engineering tickets and executive PDF digests. Discover how verified customer intelligence flows through our 4-stage pipeline.
        </p>
      </div>

      {/* 4-Stage Journey Cards */}
      <div className="story-cards-container grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {steps.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.step}
              className="story-card rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Subtle top indicator bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-violet-500 opacity-80 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-xl bg-slate-100 text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="story-step-indicator inline-block h-2 w-2 rounded-full bg-indigo-600" />
                    <span className="font-mono text-xs font-bold text-slate-400 group-hover:text-indigo-600 transition-colors">
                      Stage {item.step}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Badge variant="indigo" size="sm">
                      {item.tag}
                    </Badge>
                  </div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    {item.title}
                  </h3>
                  <div className="text-[11px] font-medium text-slate-500">
                    {item.subtitle}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Sample Output Excerpt */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 mb-1">
                  Verified Data Artifact:
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-[11px] font-mono text-slate-700 border border-slate-100 line-clamp-2">
                  {item.example}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3D Diagonal Showcase Carousel */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-white shadow-xl overflow-hidden relative">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/40 bg-indigo-500/15 px-3 py-0.5 text-xs font-semibold text-indigo-300">
              <Sparkles className="h-3 w-3 text-indigo-400" />
              Interactive Pipeline Showcase
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-1.5">
              3D Architecture Flow
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Slide through the five core engines powering verified customer intelligence.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">Use arrows or drag to explore</span>
        </div>
        <div className="h-96 sm:h-[420px] w-full relative">
          <DiagonalCarousel
            items={CAROUSEL_ITEMS}
            slideSize={280}
            rotationStep={22}
            verticalStep={70}
            loop={true}
            className="h-full"
          />
        </div>
      </div>

      {/* Trust & Methodology Callout */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            <strong>Deterministic Truth Invariant: </strong>
            Metrics, priority calculations, and citations reflect actual customer database records with zero fabricated data.
          </span>
        </div>
        <LineHoverLink
          variant="slide"
          href="#architecture"
          className="flex items-center gap-1 font-mono text-[11px] text-indigo-600 shrink-0 font-medium hover:text-indigo-800"
        >
          InsightFlow Architecture v2026.1
          <ArrowRight className="h-3.5 w-3.5" />
        </LineHoverLink>
      </div>
    </section>
  );
};
