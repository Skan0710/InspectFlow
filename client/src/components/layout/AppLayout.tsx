import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNavbar } from './TopNavbar';
import { ProductFooter } from './ProductFooter';
import { ChatCopilot } from '../chat/ChatCopilot';
import { HeroBackground } from '../canvas/HeroBackground';

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  // The overview lays out its own hero and content panel
  const selfLayout = pathname === '/';

  return (
    <div className="relative flex min-h-screen flex-col bg-indigo-950 font-sans text-slate-900 antialiased">
      {/* One indigo atmosphere behind the whole app */}
      <HeroBackground fixed />
      <TopNavbar />
      <main className="relative flex-1">
        {selfLayout ? (
          <Outlet />
        ) : (
          <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 sm:py-8 lg:px-8">
            <div className="rounded-3xl border border-white/50 bg-white/90 p-4 shadow-2xl shadow-indigo-950/30 backdrop-blur-md sm:p-6 lg:p-8">
              <Outlet />
            </div>
          </div>
        )}
      </main>
      <ProductFooter />
      <ChatCopilot />
    </div>
  );
};
