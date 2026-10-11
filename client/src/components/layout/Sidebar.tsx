import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  MessageSquareQuote,
  Sparkles,
  CheckSquare,
  FileBarChart,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: 'default' | 'indigo' | 'warning';
}

export const navigationItems: NavItem[] = [
  {
    label: 'Overview',
    path: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'Feedback',
    path: '/feedback',
    icon: MessageSquareQuote,
    badge: '18',
    badgeVariant: 'indigo',
  },
  {
    label: 'AI Insights',
    path: '/insights',
    icon: Sparkles,
  },
  {
    label: 'Action Center',
    path: '/actions',
    icon: CheckSquare,
    badge: '4',
    badgeVariant: 'warning',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: FileBarChart,
  },
  {
    label: 'Settings',
    path: '/settings',
    icon: Settings,
  },
];

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const location = useLocation();

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-800/80 bg-slate-950 text-slate-200 transition-all duration-300 ease-in-out lg:static ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${isCollapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800/80 px-4">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30">
              <Zap className="h-5 w-5 fill-white/20 text-white" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col overflow-hidden text-left">
                <span className="truncate font-bold tracking-tight text-white text-base">
                  InsightFlow
                </span>
                <span className="truncate text-[11px] font-medium text-slate-400">
                  Customer Intelligence
                </span>
              </div>
            )}
          </div>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={onToggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800/80 hover:text-white transition-colors"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Workspace pill (only when expanded) */}
        {!isCollapsed && (
          <div className="px-3 pt-4 pb-1">
            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/60 px-3 py-2 text-xs">
              <div className="flex items-center gap-2 truncate">
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="truncate font-medium text-slate-300">Production Tenant</span>
              </div>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
                PRO
              </span>
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path);

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onCloseMobile}
                title={isCollapsed ? item.label : undefined}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/15 text-indigo-300 border-l-2 border-indigo-500 pl-2.5'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 transition-colors ${
                    isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />

                {!isCollapsed && (
                  <span className="flex-1 truncate tracking-tight">{item.label}</span>
                )}

                {!isCollapsed && item.badge && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.badgeVariant === 'warning'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}

                {/* Collapsed active indicator */}
                {isCollapsed && isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-r-full bg-indigo-500" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer info */}
        <div className="shrink-0 border-t border-slate-800/80 p-3">
          {!isCollapsed ? (
            <div className="flex items-center justify-between rounded-lg bg-slate-900/40 p-2.5 text-xs text-slate-400">
              <div className="flex items-center gap-2 truncate">
                <ShieldCheck className="h-4 w-4 text-indigo-400 shrink-0" />
                <span className="truncate">SOC2 Type II Verified</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">v1.0.0</span>
            </div>
          ) : (
            <div className="flex justify-center p-1 text-slate-500" title="SOC2 Type II Verified">
              <ShieldCheck className="h-4 w-4 text-indigo-400" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
