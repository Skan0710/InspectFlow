import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, BarChart3, CheckCircle2, ListChecks, MessagesSquare, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth';

const POINTS = [
  { icon: MessagesSquare, title: 'Bring in feedback', text: 'Import customer reviews and support conversations from a CSV or add them on the fly.' },
  { icon: BarChart3, title: 'See what matters', text: 'Pinpoint friction themes, real-time sentiment shifts, and high-impact bottlenecks.' },
  { icon: ListChecks, title: 'Act on decisions', text: 'Transform recurring customer complaints into tracked action items and executive digest reports.' },
];

export const GuestLanding: React.FC = () => {
  const { openSignIn, signInDemo } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  // A guest sent here from a private route gets the dialog straight away
  useEffect(() => {
    if (from) {
      openSignIn(from);
      try {
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch {
        // ignore
      }
    }
  }, [from, openSignIn]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-132px)] w-full max-w-6xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6 lg:py-24">
      <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/15 px-4 py-1.5 text-sm sm:text-base font-semibold text-indigo-200 backdrop-blur-md mb-6 shadow-md shadow-indigo-950/40">
        <Sparkles className="h-4 w-4 text-indigo-300" />
        <span>Build Battle 2026 · Adaption & AI Decision Platform</span>
      </div>

      <h1 className="text-5xl font-black leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-7xl max-w-4xl">
        Turn customer feedback into{' '}
        <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">
          clear decisions
        </span>
      </h1>
      
      <p className="mt-8 max-w-2xl text-xl sm:text-2xl text-indigo-100 font-normal leading-relaxed">
        InsightFlow analyses what customers say and shows your team exactly what to fix first.
      </p>

      {/* Primary Focused CTAs */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
        <Button
          size="xl"
          rightIcon={<ArrowRight className="h-6 w-6" />}
          onClick={() => openSignIn()}
          className="cta-focus-glow text-lg sm:text-xl font-bold px-8 py-4 shadow-2xl shadow-indigo-500/40 ring-2 ring-white/30 hover:scale-[1.03] transition-all"
        >
          Sign in to get started
        </Button>
        <Button
          size="xl"
          variant="outline"
          className="border-white/30 bg-white/10 hover:bg-white/20 text-white text-lg sm:text-xl font-semibold px-8 py-4 shadow-xl backdrop-blur-md hover:scale-[1.03] transition-all"
          leftIcon={<Sparkles className="h-6 w-6 text-indigo-300" />}
          onClick={() => signInDemo()}
        >
          Explore Demo Workspace
        </Button>
      </div>

      {/* Trust & Ease Points */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-sm sm:text-base font-medium text-indigo-200/90">
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Instant Demo Access
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" /> 7,000+ Analyzed Reviews
        </span>
        <span className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" /> No Card Required
        </span>
      </div>

      {/* Value Pillars */}
      <ul className="mt-20 grid w-full gap-8 text-left sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li
            key={title}
            className="flex flex-col gap-4 rounded-3xl border border-white/15 bg-white/[0.07] p-8 shadow-2xl shadow-indigo-950/40 backdrop-blur-md transition-all hover:border-indigo-400/40 hover:bg-white/[0.11]"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/25 text-indigo-200 ring-1 ring-white/20 shadow-md">
              <Icon className="h-7 w-7" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{title}</h2>
            <p className="text-base sm:text-lg text-indigo-100/90 leading-relaxed">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
