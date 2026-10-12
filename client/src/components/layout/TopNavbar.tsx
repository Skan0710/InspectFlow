import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  Command,
  HelpCircle,
  ChevronDown,
  User,
  CheckCircle2,
  Database,
  FlaskConical,
  AlertTriangle,
} from 'lucide-react';
import { navigationItems } from './Sidebar';
import { SpotlightNavbar } from '../ui/spotlight-navbar';

interface TopNavbarProps {
  onOpenMobile: () => void;
}

interface DatasetStatusInfo {
  totalRecords: number;
  genuineCount: number;
  sampleCount: number;
  activeDatasetType: 'empty' | 'genuine' | 'sample' | 'mixed';
  lastImportAt: string | null;
  analysisStatus: 'not_started' | 'running' | 'completed';
  hasAnalysisRun: boolean;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenMobile }) => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDatasetInfo, setShowDatasetInfo] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState<DatasetStatusInfo | null>(null);

  const fetchDatasetStatus = async () => {
    try {
      const res = await fetch('/api/dataset/status');
      if (res.ok) {
        const data = await res.json();
        setDatasetStatus(data);
      }
    } catch {
      // Ignored if server offline
    }
  };

  useEffect(() => {
    fetchDatasetStatus();
    const interval = setInterval(fetchDatasetStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const currentItem = navigationItems.find((item) =>
    item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path)
  ) || { label: 'Console', path: '/' };

  const navigate = useNavigate();
  const spotlightItems = [
    { label: 'Overview', href: '/' },
    { label: 'Feedback', href: '/feedback' },
    { label: 'Actions', href: '/actions' },
    { label: 'Reports', href: '/reports' },
    { label: 'Adaption', href: '/adaption' },
  ];
  const activeSpotlightIndex = spotlightItems.findIndex((item) =>
    item.href === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.href)
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/90 bg-white px-4 sm:px-6 shadow-xs">
      {/* Left section: Mobile toggle + Page Title & Breadcrumb */}
      <div className="flex items-center gap-3 sm:gap-4">
        <button
          onClick={onOpenMobile}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

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

      {/* Center: Spotlight Navbar */}
      <div className="hidden lg:flex items-center justify-center flex-1 max-w-xl mx-4">
        <SpotlightNavbar
          items={spotlightItems}
          defaultActiveIndex={activeSpotlightIndex >= 0 ? activeSpotlightIndex : 0}
          onItemClick={(item) => navigate(item.href)}
          className="pt-0"
        />
      </div>

      {/* Right section: Visible Dataset Status, Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Visible Dataset & Import Status Pill */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDatasetInfo(!showDatasetInfo);
              setShowNotifications(false);
              setShowProfileMenu(false);
            }}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border transition-all cursor-pointer shadow-2xs hover:shadow-xs"
          >
            {datasetStatus?.activeDatasetType === 'genuine' ? (
              <span className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50/90 border-indigo-200">
                <Database className="h-3.5 w-3.5 text-indigo-600" />
                <span>{datasetStatus.genuineCount.toLocaleString()} Genuine Records</span>
              </span>
            ) : datasetStatus?.activeDatasetType === 'sample' ? (
              <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50/90 border-amber-200">
                <FlaskConical className="h-3.5 w-3.5 text-amber-600" />
                <span>{datasetStatus.sampleCount} Demo Sample Records</span>
              </span>
            ) : datasetStatus?.activeDatasetType === 'mixed' ? (
              <span className="flex items-center gap-1.5 text-purple-700 bg-purple-50/90 border-purple-200">
                <Database className="h-3.5 w-3.5 text-purple-600" />
                <span>{datasetStatus.totalRecords} Records (Mixed)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-slate-500 bg-slate-100 border-slate-200">
                <Database className="h-3.5 w-3.5 text-slate-400" />
                <span>Dataset: Unseeded</span>
              </span>
            )}
          </button>

          {/* Dataset Status Popover */}
          {showDatasetInfo && datasetStatus && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg z-50 animate-in fade-in slide-in-from-top-2 text-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
                  Dataset Provenance & State
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    datasetStatus.activeDatasetType === 'genuine'
                      ? 'bg-indigo-100 text-indigo-700'
                      : datasetStatus.activeDatasetType === 'sample'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {datasetStatus.activeDatasetType === 'genuine'
                    ? 'Genuine Ingestion'
                    : datasetStatus.activeDatasetType === 'sample'
                    ? 'Demo Sample Fixture'
                    : 'Unseeded'}
                </span>
              </div>

              <div className="mt-3 space-y-2.5">
                <div className="flex justify-between text-slate-600">
                  <span>Total Ingested Records:</span>
                  <strong className="text-slate-900">{datasetStatus.totalRecords.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Genuine CSV Records:</span>
                  <strong className="text-indigo-600">{datasetStatus.genuineCount.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Demo Sample Records:</span>
                  <strong className="text-amber-600">{datasetStatus.sampleCount.toLocaleString()}</strong>
                </div>

                <div className="pt-2 border-t border-slate-100 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    <span>AI Model Status: Not Yet Run</span>
                  </div>
                  <p className="text-slate-500 leading-tight">
                    Raw feedback is indexed. Sentiment analysis & topic clustering will be generated upon running the pipeline.
                  </p>
                </div>
              </div>
            </div>
          )}
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
              setShowDatasetInfo(false);
            }}
            aria-label="View notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-indigo-600 ring-2 ring-white" />
          </button>

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
                    <p className="font-semibold text-slate-800">Dataset Ingestion Verified</p>
                    <p className="text-slate-500 text-[11px]">
                      BuildBattle dataset streaming completed with deduplication
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200" />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => {
              setShowProfileMenu(!showProfileMenu);
              setShowNotifications(false);
              setShowDatasetInfo(false);
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
