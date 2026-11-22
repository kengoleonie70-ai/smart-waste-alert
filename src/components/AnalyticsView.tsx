import React from 'react';
import { Download } from 'lucide-react';
import { exportReportsToCsv } from '../lib/dschang.ts';
import { AnalyticsSummary, BinItem, ReportItem } from '../types.ts';

interface AnalyticsViewProps {
  analytics: AnalyticsSummary;
  reports: ReportItem[];
  bins: BinItem[];
}

export function AnalyticsView({ analytics, reports, bins }: AnalyticsViewProps) {
  const maxNeighborhoodTotal = Math.max(
    1,
    ...analytics.byNeighborhood.map((n) => n.total),
  );
  const maxHourCount = Math.max(1, ...analytics.byHour.map((h) => h.count));
  const maxCatCount = Math.max(1, ...analytics.byCategory.map((c) => c.count));

  const overflowingBins = bins.filter(
    (b) => b.status === 'Overflowing' || b.status === 'Full',
  ).length;
  const damagedBins = bins.filter((b) => b.status === 'Damaged').length;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Sanitation Analytics & Priority Planning
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Identify high-need neighborhoods in Dschang, peak citizen reporting windows, and collection capacity gaps.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportReportsToCsv(reports)}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Export Reports CSV
        </button>
      </div>

      {/* Top Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Busiest Reporting Window</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {analytics.peakReportingWindow}
          </div>
          <div className="text-xs text-slate-500 mt-1">Highest citizen alert volume</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Top Affected Area</div>
          <div className="text-xl font-bold text-slate-900 mt-1 truncate">
            {analytics.byNeighborhood[0]?.neighborhood || 'Marché A'}
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-500 mt-1">
            {analytics.byNeighborhood[0]?.total || 0} logged reports
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Collection Point Requests</div>
          <div className="text-xl font-bold font-mono tabular-nums text-emerald-800 mt-1">
            {analytics.totals.collectionRequestsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">New public bin demands</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Bins Needing Attention</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {overflowingBins + damagedBins} / {bins.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {overflowingBins} full/overflow · {damagedBins} damaged
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Most Affected Areas */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Most Affected Areas in Dschang
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Report volume by neighborhood split by Pending, In Progress, and Resolved
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Pending
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-600 inline-block" /> Active
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Resolved
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {analytics.byNeighborhood.map((area) => {
              const widthPct = Math.round((area.total / maxNeighborhoodTotal) * 100);
              const pendingPct = area.total ? (area.pending / area.total) * 100 : 0;
              const progressPct = area.total ? (area.inProgress / area.total) * 100 : 0;
              const resolvedPct = area.total ? (area.resolved / area.total) * 100 : 0;

              return (
                <div key={area.neighborhood} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{area.neighborhood}</span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {area.total} total ({area.pending} pending · {area.inProgress} active ·{' '}
                      {area.resolved} resolved)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-100 rounded-md overflow-hidden">
                    <div
                      className="h-full flex"
                      style={{ width: `${Math.max(widthPct, 8)}%` }}
                    >
                      {pendingPct > 0 && (
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${pendingPct}%` }}
                        />
                      )}
                      {progressPct > 0 && (
                        <div
                          className="h-full bg-blue-600"
                          style={{ width: `${progressPct}%` }}
                        />
                      )}
                      {resolvedPct > 0 && (
                        <div
                          className="h-full bg-emerald-600"
                          style={{ width: `${resolvedPct}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Complaints by Category
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribution across overflow, illegal dumping, and bin maintenance
            </p>
          </div>

          <div className="space-y-3.5">
            {analytics.byCategory.map((cat) => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-800">{cat.name}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-700">
                    {cat.count}
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-emerald-800 rounded-md"
                    style={{ width: `${Math.round((cat.count / maxCatCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Busiest Reporting Times */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Busiest Reporting Times (24-Hour Distribution)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Hourly citizen submission frequency to guide municipal crew shift scheduling
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            Peak Window: <span className="font-semibold text-slate-900">{analytics.peakReportingWindow}</span>
          </div>
        </div>

        <div className="grid grid-cols-12 sm:grid-cols-24 gap-1.5 items-end h-36 pt-4">
          {analytics.byHour.map((bucket) => {
            const heightPct = bucket.count === 0 ? 6 : Math.max(18, Math.round((bucket.count / maxHourCount) * 100));
            return (
              <div
                key={bucket.hour}
                className="flex flex-col items-center justify-end h-full group"
                title={`${bucket.label}: ${bucket.count} report(s)`}
              >
                <div className="text-[10px] font-mono tabular-nums text-slate-500 opacity-0 group-hover:opacity-100 mb-1">
                  {bucket.count}
                </div>
                <div
                  className={`w-full rounded-t-sm transition-colors ${
                    bucket.count > 0
                      ? 'bg-emerald-700 group-hover:bg-emerald-900'
                      : 'bg-slate-200'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
                <span className="text-[10px] font-mono tabular-nums text-slate-400 mt-1.5">
                  {bucket.hour % 3 === 0 ? String(bucket.hour).padStart(2, '0') : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
