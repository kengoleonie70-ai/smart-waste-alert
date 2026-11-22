import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ThumbsUp,
} from 'lucide-react';
import { DSCHANG_NEIGHBORHOODS, formatRelativeTime } from '../lib/dschang.ts';
import { AnalyticsSummary, BinItem, CategoryItem, ReportItem } from '../types.ts';

interface OverviewSectionProps {
  reports: ReportItem[];
  bins: BinItem[];
  categories: CategoryItem[];
  analytics: AnalyticsSummary;
  onStartReport: () => void;
  onOpenMap: () => void;
  onSelectReport: (report: ReportItem) => void;
  onConfirmReport: (reportId: number) => Promise<void>;
  isSignedIn: boolean;
}

function ReportCardThumb({ photoUrl, title }: { photoUrl: string | null; title: string }) {
  const [failed, setFailed] = useState(false);

  if (!photoUrl || failed) {
    return (
      <div className="w-full h-44 bg-slate-100 border-b border-slate-200 flex flex-col items-center justify-center text-slate-400 gap-1.5">
        <Camera className="w-5 h-5" />
        <span className="text-xs">Citizen location pin</span>
      </div>
    );
  }

  return (
    <div className="w-full h-44 bg-slate-100 border-b border-slate-200 overflow-hidden">
      <img
        src={photoUrl}
        alt={title}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
      />
    </div>
  );
}

export function OverviewSection({
  reports,
  bins,
  categories,
  analytics,
  onStartReport,
  onOpenMap,
  onSelectReport,
  onConfirmReport,
  isSignedIn,
}: OverviewSectionProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [trackCode, setTrackCode] = useState('');
  const [trackLoading, setTrackLoading] = useState(false);
  const [trackError, setTrackError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Resolved'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [neighborhoodFilter, setNeighborhoodFilter] = useState<string>('All');
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const filteredReports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'All' && r.status !== statusFilter) return false;
      if (
        categoryFilter !== 'All' &&
        !r.categories.some((c) => c.name === categoryFilter)
      ) {
        return false;
      }
      if (neighborhoodFilter !== 'All' && r.neighborhood !== neighborhoodFilter) {
        return false;
      }
      if (q) {
        const hay = `${r.referenceCode} ${r.title} ${r.description} ${r.neighborhood}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, searchQuery, statusFilter, categoryFilter, neighborhoodFilter]);

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = trackCode.trim();
    if (!cleaned) return;
    setTrackLoading(true);
    setTrackError(null);
    try {
      const res = await fetch(`/api/reports/track/${encodeURIComponent(cleaned)}`);
      const data = await res.json();
      if (!res.ok) {
        setTrackError(data.error || 'Report not found.');
      } else if (data.report) {
        onSelectReport(data.report);
      }
    } catch {
      setTrackError('Unable to reach tracking service.');
    } finally {
      setTrackLoading(false);
    }
  };

  const handleConfirm = async (e: React.MouseEvent, reportId: number) => {
    e.stopPropagation();
    setConfirmingId(reportId);
    try {
      await onConfirmReport(reportId);
    } finally {
      setConfirmingId(null);
    }
  };

  const criticalBinsCount = bins.filter(
    (b) => b.status === 'Overflowing' || b.status === 'Damaged' || b.status === 'Full',
  ).length;

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="lg:col-span-6 p-7 sm:p-9 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="text-xs font-medium text-emerald-800 tracking-wide">
              Municipality of Dschang · West Region, Cameroon
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 leading-[1.15] [text-wrap:balance]">
              Citizen waste reporting and municipal sanitation follow-up
            </h1>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
              Report overflowing public dustbins, illegal roadside dumping, damaged containers, or request new neighborhood collection points with verified GPS coordinates and photo evidence.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onStartReport}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Report a Waste Issue
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenMap}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <MapPin className="w-4 h-4 text-emerald-800" />
                Explore Dschang Map
              </button>
            </div>

            <form onSubmit={handleTrackSubmit} className="pt-4 border-t border-slate-100">
              <label
                htmlFor="track-ref-input"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Track an existing report by reference code (e.g. DSG-2026-001)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="track-ref-input"
                  type="text"
                  value={trackCode}
                  onChange={(e) => setTrackCode(e.target.value)}
                  placeholder="Enter reference code..."
                  className="flex-1 min-w-0 px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
                <button
                  type="submit"
                  disabled={trackLoading}
                  className="px-4 py-2 text-sm font-medium text-slate-900 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {trackLoading ? 'Checking...' : 'Track'}
                </button>
              </div>
              {trackError && <p className="text-xs text-red-600 mt-1.5">{trackError}</p>}
            </form>
          </div>
        </div>

        <div className="lg:col-span-6 relative min-h-[280px] bg-slate-100">
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/dschang_civic_banner_1795323600068.jpg"
              alt="Clean municipal avenue and public waste bins in Dschang, West Cameroon"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover lg:h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-emerald-950 text-emerald-100 p-8 text-sm">
              Municipality of Dschang Sanitation Network
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent p-6 text-white">
            <div className="text-xs font-mono tabular-nums text-emerald-200">
              {bins.length} Public Bins Indexed · {criticalBinsCount} Requiring Collection
            </div>
            <div className="text-sm font-medium mt-0.5">
              Centralized reporting across Marché A, Campus UDs, Foto, Foreke, and Tsinkop
            </div>
          </div>
        </div>
      </section>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Total Reports Logged</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {analytics.totals.totalReports}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {analytics.totals.collectionRequestsCount} new point requests
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Pending Municipal Triage</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {analytics.totals.pendingCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Awaiting crew dispatch</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">In Progress</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-700 mt-1">
            {analytics.totals.inProgressCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Assigned to sanitation teams</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Resolution Rate</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {analytics.totals.resolutionRatePct}%
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {analytics.totals.resolvedCount} complaints resolved
          </div>
        </div>
      </section>

      {/* Community Feed & Search */}
      <section className="space-y-5">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">
              Recent Municipal Reports
            </h2>
            <p className="text-sm text-slate-600 mt-0.5">
              Search and inspect active waste alerts, photo evidence, and resolution updates across Dschang.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
            {(['All', 'Pending', 'In Progress', 'Resolved'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-white border border-slate-200 rounded-xl p-3.5">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by reference code, street, or description..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>
          <div className="md:col-span-3">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            >
              <option value="All">All Categories</option>
              {categories.map((c) => (
                <option key={c.categoryId} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select
              aria-label="Filter by neighborhood"
              value={neighborhoodFilter}
              onChange={(e) => setNeighborhoodFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
            >
              <option value="All">All Neighborhoods</option>
              {DSCHANG_NEIGHBORHOODS.map((n) => (
                <option key={n.name} value={n.name}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm text-slate-600">
              No reports match the current filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setCategoryFilter('All');
                setNeighborhoodFilter('All');
              }}
              className="px-4 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredReports.map((report) => (
              <article
                key={report.reportId}
                onClick={() => onSelectReport(report)}
                className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col cursor-pointer hover:border-slate-300 transition-colors"
              >
                <ReportCardThumb photoUrl={report.photoUrl} title={report.title} />
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-mono tabular-nums text-slate-500 truncate">
                      {report.referenceCode} · {report.neighborhood} ·{' '}
                      {formatRelativeTime(report.dateSubmitted)}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 leading-snug group-hover:text-emerald-800 transition-colors">
                      {report.title}
                    </h3>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {report.description}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 font-semibold ${
                        report.status === 'Resolved'
                          ? 'text-emerald-700'
                          : report.status === 'In Progress'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {report.status === 'Resolved' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : report.status === 'In Progress' ? (
                        <Clock className="w-3.5 h-3.5" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      {report.status}
                    </span>

                    <div className="flex items-center gap-3">
                      {isSignedIn && report.status !== 'Resolved' && (
                        <button
                          type="button"
                          disabled={confirmingId === report.reportId}
                          onClick={(e) => handleConfirm(e, report.reportId)}
                          className="inline-flex items-center gap-1 text-slate-600 hover:text-emerald-800 font-medium transition-colors"
                          title="Confirm you also see this issue"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                          <span className="font-mono tabular-nums">{report.upvotes}</span>
                        </button>
                      )}
                      {!isSignedIn && (
                        <span className="text-slate-400 font-mono tabular-nums">
                          {report.upvotes} confirm{report.upvotes === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-600 font-medium">
                        {report.categories[0]?.name || report.reportType}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
