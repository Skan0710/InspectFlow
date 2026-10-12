import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Settings, Sparkles, User, ChevronDown } from 'lucide-react';
import { navigationItems } from './navigation';
import { SpotlightNavbar } from '../ui/spotlight-navbar';
import { ACCENTS, getInitials, useProfile } from '../../lib/profile';

const mobileLink =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300';

const isActivePath = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname.startsWith(path);

export const TopNavbar: React.FC = () => {
  const { pathname } = useLocation();
  const profile = useProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close menus on navigation
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen && !profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setProfileOpen(false);
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen, profileOpen]);

  const items = navigationItems.map(({ label, path }) => ({ label, href: path }));
  const activeIndex = navigationItems.findIndex(({ path }) => isActivePath(pathname, path));
  const initials = getInitials(profile.name);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-indigo-950/55 backdrop-blur-lg">
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          aria-label="InsightFlow home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-lg shadow-indigo-950/40">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="text-base font-bold tracking-tight text-white">InsightFlow</span>
        </Link>

        <div className="hidden flex-1 justify-center lg:flex">
          <SpotlightNavbar items={items} activeIndex={activeIndex} />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-2.5 text-white backdrop-blur-md transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${ACCENTS[profile.accent]} text-xs font-bold text-indigo-950`}>
                {initials}
              </span>
              <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:block">{profile.name}</span>
              <ChevronDown className={`h-4 w-4 text-indigo-200 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-white/15 bg-indigo-950 shadow-2xl shadow-black/40"
              >
                <div className="border-b border-white/10 bg-white/5 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                  <p className="truncate text-xs text-indigo-200/80">{profile.email || profile.role}</p>
                </div>
                <div className="p-1.5">
                  <Link
                    to="/profile"
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-100 hover:bg-white/10 hover:text-white"
                  >
                    <User className="h-4 w-4" />
                    View profile
                  </Link>
                  <Link
                    to="/settings"
                    role="menuitem"
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-100 hover:bg-white/10 hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-indigo-50 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Primary mobile"
          className="border-t border-white/10 bg-indigo-950/95 px-4 py-3 lg:hidden"
        >
          <ul className="mx-auto grid max-w-7xl gap-1 sm:grid-cols-2">
            {navigationItems.map(({ label, path, icon: Icon }) => (
              <li key={path}>
                <NavLink
                  to={path}
                  end={path === '/'}
                  className={({ isActive }) =>
                    `${mobileLink} ${
                      isActive ? 'bg-white/15 text-white' : 'text-indigo-200 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
};
