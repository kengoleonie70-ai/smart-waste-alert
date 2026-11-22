import React, { useState } from 'react';
import { Camera, CheckCircle2, Clock, MapPin, UserCheck, X } from 'lucide-react';
import { formatExactDate } from '../lib/dschang.ts';
import { ReportItem } from '../types.ts';

export function ReportDetailModal({
  report,
  onClose,
}: {
  report: ReportItem;
  onClose: () => void;
}) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200">
          <div>
            <div className="text-xs font-mono tabular-nums text-slate-500">
              {report.referenceCode} · {report.reportType} · {report.neighborhood}
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mt-1">{report.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {report.photoUrl && !imgError ? (
            <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
              <img
                src={report.photoUrl}
                alt={report.title}
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-64 object-cover"
              />
            </div>
          ) : (
            <div className="h-36 rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-1.5">
              <Camera className="w-5 h-5" />
              <span className="text-xs">No field photo attached to this report</span>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-200 text-sm">
            <div>
              <div className="text-xs text-slate-500">Current Status</div>
              <div
                className={`font-semibold mt-0.5 ${
                  report.status === 'Resolved'
                    ? 'text-emerald-700'
                    : report.status === 'In Progress'
                      ? 'text-blue-700'
                      : 'text-amber-700'
                }`}
              >
                {report.status}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Priority</div>
              <div className="font-semibold text-slate-900 mt-0.5">{report.priority}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Category</div>
              <div className="font-medium text-slate-900 mt-0.5">
                {report.categories.map((c) => c.name).join(', ') || 'General'}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Confirmations</div>
              <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                {report.upvotes} citizen{report.upvotes === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-1.5">Issue Description</h4>
            <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-800">Location & Asset</div>
                <div className="mt-0.5">
                  {report.neighborhood}
                  {report.binCode ? ` · Linked Bin ${report.binCode}` : ''}
                </div>
                {report.latitude != null && report.longitude != null && (
                  <div className="font-mono tabular-nums text-slate-500 mt-0.5">
                    {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-800">Municipal Assignment</div>
                <div className="mt-0.5">
                  {report.departmentName || 'Awaiting municipal triage'}
                </div>
                {report.assignedWorker && (
                  <div className="text-slate-500 mt-0.5">Officer: {report.assignedWorker}</div>
                )}
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-slate-900 mb-3">
              Status Tracking Timeline
            </h4>
            <div className="space-y-3">
              {report.timeline.map((step) => (
                <div
                  key={step.statusupdateId}
                  className="flex items-start gap-3 text-xs border-b border-slate-100 pb-3 last:border-b-0"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">
                      {step.oldstatus} → {step.newstatus}
                    </div>
                    {step.note && <p className="text-slate-600 mt-0.5">{step.note}</p>}
                    <div className="text-slate-400 mt-1 font-mono tabular-nums">
                      {formatExactDate(step.timestamp)} · Updated by {step.updatedByName}
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-3 text-xs">
                <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-slate-800">Report Submitted</div>
                  <div className="text-slate-500 mt-0.5 font-mono tabular-nums">
                    {formatExactDate(report.dateSubmitted)} · Reported by {report.citizenName}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
