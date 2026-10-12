import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNavbar } from './TopNavbar';
import { ProductFooter } from './ProductFooter';
import { ChatCopilot } from '../chat/ChatCopilot';
import { HeroBackground } from '../canvas/HeroBackground';

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  // The overview lays out its own full-bleed hero
  const fullBleed = pathname === '/';

  return (
    <div className="relative flex min-h-screen flex-col bg-indigo-950 font-sans text-slate-900 antialiased">
      {/* One indigo atmosphere behind the whole app */}
      <HeroBackground fixed />
      <TopNavbar />
      <main className="app-theme relative flex-1">
        {fullBleed ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            <Outlet />
          </div>
        )}
      </main>
      <ProductFooter />
      <ChatCopilot />
    </div>
  );
};
