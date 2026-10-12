import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X, Settings, Sparkles, User, ChevronDown, LogOut } from 'lucide-react';
import { navigationItems } from './navigation';
import { SpotlightNavbar } from '../ui/spotlight-navbar';
import { ACCENTS, getInitials, useProfile } from '../../lib/profile';
import { useAuth } from '../../lib/auth';
import { Button } from '../ui/Button';

const mobileLink =
  'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300';

const isActivePath = (pathname: string, path: string) =>
  path === '/' ? pathname === '/' : pathname.startsWith(path);

export const TopNavbar: React.FC = () => {
  const { pathname } = useLocation();
  const profile = useProfile();
  const { status, openSignIn, signOut, user } = useAuth();
  const signedIn = status === 'authenticated';
  // Menus remember the route they were opened on, so navigating closes them without an effect
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [profileAt, setProfileAt] = useState<string | null>(null);
  const menuOpen = menuAt === pathname;
  const profileOpen = profileAt === pathname;
  const setMenuOpen = (next: boolean | ((open: boolean) => boolean)) =>
    setMenuAt((cur) => ((typeof next === 'function' ? next(cur === pathname) : next) ? pathname : null));
  const setProfileOpen = (next: boolean | ((open: boolean) => boolean)) =>
    setProfileAt((cur) => ((typeof next === 'function' ? next(cur === pathname) : next) ? pathname : null));
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen && !profileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuAt(null);
        setProfileAt(null);
      }
    };
    const onPointer = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileAt(null);
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
          className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          aria-label="InsightFlow home"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-lg shadow-indigo-950/40">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="text-xl font-extrabold tracking-tight text-white">InsightFlow</span>
        </Link>

        <div className="hidden flex-1 justify-center lg:flex">
          <SpotlightNavbar items={items} activeIndex={activeIndex} />
        </div>

        <div className="flex items-center gap-2">
          {!signedIn && status === 'guest' && (
            <Button
              size="md"
              onClick={() => openSignIn()}
              className="cta-focus-glow px-5 py-2 text-base font-bold shadow-lg shadow-indigo-500/30 ring-1 ring-white/30"
            >
              Sign in
            </Button>
          )}

          {signedIn && (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              aria-label="Open profile menu"
              className="flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1 pl-1 pr-2.5 text-white backdrop-blur-md transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  className="h-8 w-8 rounded-full object-cover ring-1 ring-white/30"
                />
              ) : (
                <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${ACCENTS[profile.accent]} text-xs font-bold text-indigo-950`}>
                  {initials}
                </span>
              )}
              <span className="hidden max-w-[8rem] truncate text-sm font-medium sm:block">{profile.name}</span>
              <ChevronDown className={`h-4 w-4 text-indigo-200 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-indigo-950 shadow-2xl shadow-black/40 z-50"
              >
                <div className="border-b border-white/10 bg-white/5 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                    {profile.isGoogleAuth ? (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                        Google
                      </span>
                    ) : user?.app_metadata?.provider === 'demo' ? (
                      <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                        Demo
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-indigo-100">{profile.email || profile.role}</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-100 hover:bg-white/10 hover:text-white"
                  >
                    <User className="h-4 w-4" />
                    View profile
                  </Link>
                  <Link
                    to="/settings"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-indigo-100 hover:bg-white/10 hover:text-white"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>

                  <div className="mt-1 border-t border-white/10 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileOpen(false);
                        void signOut();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-red-300 hover:bg-red-500/20 hover:text-red-200"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

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
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `${mobileLink} ${
                      isActive ? 'bg-white/15 text-white' : 'text-indigo-50 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="mx-auto mt-3 max-w-7xl border-t border-white/10 pt-3">
            {signedIn ? (
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${ACCENTS[profile.accent]} text-xs font-bold text-indigo-950`}>
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{profile.name}</p>
                    <p className="truncate text-xs text-indigo-200">{profile.email || profile.role}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void signOut();
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-200 hover:bg-red-500/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out
                </button>
              </div>
            ) : (
              <Button
                size="md"
                onClick={() => {
                  setMenuOpen(false);
                  openSignIn();
                }}
                className="cta-focus-glow w-full py-2.5 text-base font-bold shadow-lg shadow-indigo-500/30"
              >
                Sign in
              </Button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};
