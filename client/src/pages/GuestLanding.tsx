import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { ArrowRight, BarChart3, ListChecks, MessagesSquare, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../lib/auth';

const POINTS = [
  { icon: MessagesSquare, title: 'Bring in feedback', text: 'Import reviews from a CSV or add them by hand.' },
  { icon: BarChart3, title: 'See what matters', text: 'Sentiment, themes and priority issues at a glance.' },
  { icon: ListChecks, title: 'Act on it', text: 'Turn recurring problems into tracked actions and reports.' },
];

export const GuestLanding: React.FC = () => {
  const { openSignIn, signInDemo } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  // A guest sent here from a private route gets the dialog straight away
  useEffect(() => {
    if (from) openSignIn(from);
  }, [from, openSignIn]);

  return (
    <div className="mx-auto flex min-h-[calc(100vh-132px)] w-full max-w-5xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
        Turn customer feedback
        <br />
        into clear decisions
      </h1>
      <p className="mt-6 max-w-xl text-lg text-indigo-100 sm:text-xl">
        InsightFlow analyses what customers say and shows you what to fix first.
      </p>
      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <Button size="lg" rightIcon={<ArrowRight className="h-5 w-5" />} onClick={() => openSignIn()}>
          Sign in to get started
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="border-white/20 bg-white/10 hover:bg-white/20 text-white"
          leftIcon={<Sparkles className="h-5 w-5 text-indigo-300" />}
          onClick={() => signInDemo()}
        >
          Explore Demo Workspace
        </Button>
      </div>

      <ul className="mt-16 grid w-full gap-8 text-left sm:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex flex-col gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-indigo-100">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="text-lg font-semibold text-white">{title}</h2>
            <p className="text-base text-indigo-100">{text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};
