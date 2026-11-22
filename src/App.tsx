import React, { useCallback, useEffect, useState } from 'react';
import { AnalyticsView } from './components/AnalyticsView.tsx';
import { DschangExplorerMap } from './components/DschangMap.tsx';
import { OperationsView } from './components/OperationsView.tsx';
import { OverviewSection } from './components/OverviewSection.tsx';
import { ReportDetailModal } from './components/ReportDetailModal.tsx';
import { ReportFormView } from './components/ReportFormView.tsx';
import { useAuth } from './context/AuthContext.tsx';
import { DSCHANG_NEIGHBORHOODS } from './lib/dschang.ts';
import {
  AnalyticsSummary,
  BinItem,
  CategoryItem,
  ReportItem,
} from './types.ts';

type ActiveView = 'overview' | 'report' | 'map' | 'analytics' | 'operations';

const EMPTY_ANALYTICS: AnalyticsSummary = {
  totals: {
    totalReports: 0,
    pendingCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    collectionRequestsCount: 0,
    duplicateCount: 0,
    resolutionRatePct: 0,
  },
  byNeighborhood: [],
  byCategory: [],
  byHour: [],
  peakReportingWindow: '08:00 – 09:00',
};

export default function App() {
  const { authUser, loading: authLoading, signInWithGoogle, signOut, getIdToken, authError } =
    useAuth();

  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [bins, setBins] = useState<BinItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>(EMPTY_ANALYTICS);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [mapFocus, setMapFocus] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const handler = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const loadOverview = useCallback(async () => {
    setDataError(null);
    try {
      const res = await fetch('/api/public/overview');
      const data = await res.json();
      if (!res.ok) {
        setDataError(data.error || 'Unable to load municipal waste data.');
        return;
      }
      setReports(data.reports || []);
      setBins(data.bins || []);
      setCategories(data.categories || []);
      setAnalytics(data.analytics || EMPTY_ANALYTICS);
    } catch {
      setDataError('Unable to reach server. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleConfirmReport = async (reportId: number) => {
    const token = await getIdToken();
    if (!token) {
      await signInWithGoogle();
      return;
    }
    const res = await fetch(`/api/reports/${reportId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await loadOverview();
    }
  };

  const navItems: { id: ActiveView; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'report', label: 'Report Issue' },
    { id: 'map', label: 'Live Map' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'operations', label: 'Operations' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navigation Bar — 3-Zone Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveView('overview')}
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dschang CleanWatch
          </button>

          {/* Zone 2: Clean Typography Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                  activeView === item.id
                    ? 'border-emerald-800 text-slate-950 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            {authLoading ? (
              <span className="text-xs text-slate-400 whitespace-nowrap">Checking...</span>
            ) : authUser ? (
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                title={`Signed in as ${authUser.email} (${authUser.rolename})`}
              >
                Sign Out · {authUser.fullname.split(' ')[0]}
              </button>
            ) : (
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* Mobile Nav Strip */}
        <div className="md:hidden border-t border-slate-100 px-3 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 ${
                activeView === item.id
                  ? 'bg-emerald-800 text-white'
                  : 'text-slate-600 bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {authError && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs rounded-lg px-4 py-3">
            Sign-in notice: {authError}
          </div>
        )}

        {dataError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg px-4 py-3 flex items-center justify-between gap-4">
            <span>{dataError}</span>
            <button
              type="button"
              onClick={loadOverview}
              className="font-semibold underline whitespace-nowrap shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {dataLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="h-72 bg-slate-200/70 rounded-xl" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-slate-200/70 rounded-xl" />
              <div className="h-24 bg-slate-200/70 rounded-xl" />
              <div className="h-24 bg-slate-200/70 rounded-xl" />
              <div className="h-24 bg-slate-200/70 rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            {activeView === 'overview' && (
              <OverviewSection
                reports={reports}
                bins={bins}
                categories={categories}
                analytics={analytics}
                onStartReport={() => setActiveView('report')}
                onOpenMap={() => setActiveView('map')}
                onSelectReport={setSelectedReport}
                onConfirmReport={handleConfirmReport}
                isSignedIn={Boolean(authUser)}
              />
            )}

            {activeView === 'report' && (
              <ReportFormView
                categories={categories}
                bins={bins}
                onSubmitted={loadOverview}
                onSelectReport={setSelectedReport}
              />
            )}

            {activeView === 'map' && (
              <div className="space-y-5">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">
                      Dschang Sanitation Map
                    </h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      Inspect citizen waste alerts alongside municipal public dustbins across Dschang neighborhoods.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {DSCHANG_NEIGHBORHOODS.slice(0, 6).map((hood) => (
                      <button
                        key={hood.name}
                        type="button"
                        onClick={() => setMapFocus({ lat: hood.lat, lng: hood.lng })}
                        className="px-2.5 py-1.5 text-xs font-medium bg-white border border-slate-200 hover:border-emerald-700 hover:text-emerald-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                      >
                        {hood.name}
                      </button>
                    ))}
                  </div>
                </div>

                <DschangExplorerMap
                  reports={reports}
                  bins={bins}
                  onInspectReport={setSelectedReport}
                  focusCoords={mapFocus}
                />
              </div>
            )}

            {activeView === 'analytics' && (
              <AnalyticsView
                analytics={analytics}
                reports={reports}
                bins={bins}
              />
            )}

            {activeView === 'operations' && (
              <OperationsView
                onDataChanged={loadOverview}
                onSelectReport={setSelectedReport}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            Smart Waste Alert Platform · Municipality of Dschang, West Region, Cameroon
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setActiveView('report')}
              className="hover:text-slate-900"
            >
              Submit Report
            </button>
            <button
              type="button"
              onClick={() => setActiveView('map')}
              className="hover:text-slate-900"
            >
              Bin Map
            </button>
            <button
              type="button"
              onClick={() => setActiveView('operations')}
              className="hover:text-slate-900"
            >
              Municipal Portal
            </button>
          </div>
        </div>
      </footer>

      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
        />
      )}
    </div>
  );
}
