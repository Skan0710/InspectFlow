import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Menu,
  Search,
  Bell,
  Command,
  HelpCircle,
  ChevronDown,
  User,
  CheckCircle2,
} from 'lucide-react';
import { navigationItems } from './Sidebar';

interface TopNavbarProps {
  onOpenMobile: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenMobile }) => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Determine current page metadata
  const currentItem = navigationItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  ) || { label: 'Console', path: '/' };

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-4 sm:px-6 shadow-xs">
      {/* Left section: Mobile toggle + Page Title & Breadcrumb */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile menu button */}
        <button
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Title and context */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <span>InsightFlow</span>
            <span>/</span>
            <span className="text-slate-800">{currentItem.label}</span>
          </div>
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight">
            {currentItem.label}
          </h1>
        </div>
      </div>

      {/* Center: Global Search Entry Point */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search feedback, accounts, topics..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/80 py-1.5 pl-9 pr-14 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/15"
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
            <kbd className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-400 shadow-xs">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right section: System Status, Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Live sync badge */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Telemetry Active</span>
        </div>

        {/* Documentation / Help */}
        <button
          aria-label="Help and resources"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowProfileMenu(false);
            }}
            aria-label="View notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
          </button>

          {/* Notifications Dropdown Preview */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 px-1">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Notifications
                </span>
                <span className="text-[11px] font-medium text-indigo-600 hover:underline cursor-pointer">
                  Mark all as read
                </span>
              </div>
              <div className="mt-2 space-y-2 text-xs">
                <div className="flex items-start gap-2.5 rounded-lg p-2 bg-slate-50 hover:bg-slate-100/70 transition-colors">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">Weekly insight report ready</p>
                    <p className="text-slate-500 text-[11px]">Sentiment trend up +14% vs last week</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg p-2 hover:bg-slate-50 transition-colors">
                  <div className="h-2 w-2 rounded-full bg-indigo-600 shrink-0 mt-1.5" />
                  <div>
                    <p className="font-semibold text-slate-800">New feedback batch imported</p>
                    <p className="text-slate-500 text-[11px]">18 items synced from Salesforce & Zendesk</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Profile Placeholder */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2.5 rounded-lg p-1 text-left hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-semibold text-xs shadow-xs">
              AV
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                Alex Vance
              </span>
              <span className="text-[11px] text-slate-500 leading-tight">
                Product Ops
              </span>
            </div>
            <ChevronDown className="hidden sm:block h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* Profile Dropdown */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
              <div className="border-b border-slate-100 px-3 py-2 text-xs">
                <p className="font-bold text-slate-900">Alex Vance</p>
                <p className="text-slate-500">alex.vance@acme.corp</p>
              </div>
              <div className="pt-1 text-xs text-slate-700">
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-100 text-left"
                >
                  <User className="h-3.5 w-3.5 text-slate-500" />
                  Account Profile
                </button>
                <button
                  onClick={() => setShowProfileMenu(false)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 hover:bg-slate-100 text-left"
                >
                  <Command className="h-3.5 w-3.5 text-slate-500" />
                  Keyboard Shortcuts
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
