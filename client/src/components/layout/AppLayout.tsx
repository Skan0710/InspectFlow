import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNavbar } from './TopNavbar';
import { ProductFooter } from './ProductFooter';

export const AppLayout: React.FC = () => {
  const { pathname } = useLocation();
  // The overview owns a full-bleed hero and lays out its own content container
  const fullBleed = pathname === '/';

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f7fd] font-sans text-slate-900 antialiased">
      <TopNavbar />
      <main className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8'}>
        <Outlet />
      </main>
      <ProductFooter />
    </div>
  );
};
