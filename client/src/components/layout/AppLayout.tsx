import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNavbar } from './TopNavbar';
import { ProductFooter } from './ProductFooter';
import { ChatCopilot } from '../chat/ChatCopilot';
import { CursorSpotlight } from './CursorSpotlight';
import { HeroBackground } from '../canvas/HeroBackground';
import { useAuth } from '../../lib/auth';

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  const { status } = useAuth();
  // The overview lays out its own full-bleed hero
  const fullBleed = pathname === '/';
  const reduce = useReducedMotion();
  const enter = reduce ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: 'easeOut' as const } };

  return (
    <div className="relative flex min-h-screen flex-col bg-indigo-950 font-sans text-slate-900 antialiased">
      {/* One indigo atmosphere behind the whole app */}
      <HeroBackground fixed />
      <CursorSpotlight />
      <TopNavbar />
      <main className="app-theme relative flex-1">
        <motion.div key={pathname} {...enter}>
          {fullBleed ? (
            <Outlet />
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
              <Outlet />
            </div>
          )}
        </motion.div>
      </main>
      <ProductFooter />
      {status === 'authenticated' && <ChatCopilot />}
    </div>
  );
};
