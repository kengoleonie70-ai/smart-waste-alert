import React, { useCallback, useEffect, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { Layers, MapPin, Trash2 } from 'lucide-react';
import { DSCHANG_CENTER, formatRelativeTime } from '../lib/dschang.ts';
import { BinItem, ReportItem } from '../types.ts';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

function MapStatusMonitor() {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
        Interactive Google Map tiles could not be loaded. Coordinate selection and report tables remain active.
      </div>
    );
  }
  return null;
}

function MapPanner({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (map && target) {
      map.panTo(target);
    }
  }, [map, target]);
  return null;
}

function getReportPinColors(status: string) {
  if (status === 'Resolved') {
    return { background: '#16A34A', borderColor: '#14532D', glyphColor: '#FFFFFF' };
  }
  if (status === 'In Progress') {
    return { background: '#2563EB', borderColor: '#1E3A8A', glyphColor: '#FFFFFF' };
  }
  return { background: '#D97706', borderColor: '#78350F', glyphColor: '#FFFFFF' };
}

function getBinPinColors(status: string) {
  if (status === 'Overflowing' || status === 'Damaged') {
    return { background: '#DC2626', borderColor: '#7F1D1D', glyphColor: '#FFFFFF' };
  }
  if (status === 'Full') {
    return { background: '#EA580C', borderColor: '#7C2D12', glyphColor: '#FFFFFF' };
  }
  if (status === 'Half Full') {
    return { background: '#0F766E', borderColor: '#134E4A', glyphColor: '#FFFFFF' };
  }
  return { background: '#0F6B46', borderColor: '#064E3B', glyphColor: '#FFFFFF' };
}

type AdvancedMarkerRefType = ReturnType<typeof useAdvancedMarkerRef>[1];

function ReportMarker({
  report,
  isSelected,
  onSelect,
}: {
  report: ReportItem;
  isSelected: boolean;
  onSelect: (report: ReportItem, marker: AdvancedMarkerRefType) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  if (report.latitude == null || report.longitude == null) return null;
  const colors = getReportPinColors(report.status);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: report.latitude, lng: report.longitude }}
      title={`${report.referenceCode} — ${report.title}`}
      onClick={() => onSelect(report, marker)}
    >
      <Pin
        background={colors.background}
        borderColor={colors.borderColor}
        glyphColor={colors.glyphColor}
        scale={isSelected ? 1.25 : 1}
      >
        <span className="text-[10px] font-bold">
          {report.reportType === 'Collection Point Request' ? '+' : '!'}
        </span>
      </Pin>
    </AdvancedMarker>
  );
}

function BinMarker({
  bin,
  isSelected,
  onSelect,
}: {
  bin: BinItem;
  isSelected: boolean;
  onSelect: (bin: BinItem, marker: AdvancedMarkerRefType) => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const colors = getBinPinColors(bin.status);

  return (
    <AdvancedMarker
      ref={markerRef}
      position={{ lat: bin.latitude, lng: bin.longitude }}
      title={`${bin.code} (${bin.status})`}
      onClick={() => onSelect(bin, marker)}
    >
      <div
        className={`flex items-center justify-center w-7 h-7 rounded-md border-2 shadow-sm transition-transform ${
          isSelected ? 'scale-125' : ''
        }`}
        style={{
          backgroundColor: colors.background,
          borderColor: colors.borderColor,
          color: colors.glyphColor,
        }}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </div>
    </AdvancedMarker>
  );
}

interface ExplorerMapProps {
  reports: ReportItem[];
  bins: BinItem[];
  onInspectReport: (report: ReportItem) => void;
  focusCoords?: { lat: number; lng: number } | null;
}

export function DschangExplorerMap({
  reports,
  bins,
  onInspectReport,
  focusCoords = null,
}: ExplorerMapProps) {
  const [showReports, setShowReports] = useState(true);
  const [showBins, setShowBins] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'In Progress' | 'Resolved'>('All');
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [selectedBin, setSelectedBin] = useState<BinItem | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<AdvancedMarkerRefType>(null);

  const filteredReports = reports.filter(
    (r) =>
      r.latitude != null &&
      r.longitude != null &&
      (statusFilter === 'All' || r.status === statusFilter),
  );

  const handleSelectReport = useCallback(
    (report: ReportItem, marker: AdvancedMarkerRefType) => {
      setSelectedBin(null);
      setSelectedReport(report);
      setActiveAnchor(marker);
    },
    [],
  );

  const handleSelectBin = useCallback(
    (bin: BinItem, marker: AdvancedMarkerRefType) => {
      setSelectedReport(null);
      setSelectedBin(bin);
      setActiveAnchor(marker);
    },
    [],
  );

  if (!MAPS_API_KEY) {
    return (
      <div className="border border-slate-200 bg-white rounded-xl p-6 text-sm text-slate-600">
        Google Maps API key is not configured in this environment. Set <code className="font-mono">VITE_GOOGLE_MAPS_API_KEY</code> to render live Dschang street maps.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 mr-2">
            <Layers className="w-3.5 h-3.5 text-emerald-700" />
            Layers
          </span>
          <button
            type="button"
            onClick={() => setShowReports((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              showReports
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            Citizen Reports ({filteredReports.length})
          </button>
          <button
            type="button"
            onClick={() => setShowBins((v) => !v)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 ${
              showBins
                ? 'bg-emerald-800 text-white border-emerald-800'
                : 'bg-white text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            Public Dustbins ({bins.length})
          </button>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(['All', 'Pending', 'In Progress', 'Resolved'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === st
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <MapStatusMonitor />

      <div className="relative w-full h-[540px]">
        <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']} language="en" region="CM">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={DSCHANG_CENTER}
            defaultZoom={14}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onClick={() => {
              setSelectedReport(null);
              setSelectedBin(null);
              setActiveAnchor(null);
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <MapPanner target={focusCoords} />

            {showReports &&
              filteredReports.map((report) => (
                <ReportMarker
                  key={`rep-${report.reportId}`}
                  report={report}
                  isSelected={selectedReport?.reportId === report.reportId}
                  onSelect={handleSelectReport}
                />
              ))}

            {showBins &&
              bins.map((bin) => (
                <BinMarker
                  key={`bin-${bin.binId}`}
                  bin={bin}
                  isSelected={selectedBin?.binId === bin.binId}
                  onSelect={handleSelectBin}
                />
              ))}

            {selectedReport && activeAnchor && (
              <InfoWindow
                anchor={activeAnchor}
                maxWidth={290}
                onCloseClick={() => {
                  setSelectedReport(null);
                  setActiveAnchor(null);
                }}
              >
                <div className="p-1 text-slate-900 space-y-2">
                  <div className="text-[11px] font-mono text-slate-500">
                    {selectedReport.referenceCode} · {selectedReport.neighborhood}
                  </div>
                  <h4 className="text-sm font-semibold leading-snug">{selectedReport.title}</h4>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {selectedReport.description}
                  </p>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                    <span className="font-medium text-slate-800">
                      Status: {selectedReport.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectReport(selectedReport)}
                      className="text-emerald-800 font-semibold hover:underline"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </InfoWindow>
            )}

            {selectedBin && activeAnchor && (
              <InfoWindow
                anchor={activeAnchor}
                maxWidth={260}
                onCloseClick={() => {
                  setSelectedBin(null);
                  setActiveAnchor(null);
                }}
              >
                <div className="p-1 text-slate-900 space-y-1.5">
                  <div className="text-[11px] font-mono text-slate-500">
                    {selectedBin.code} · {selectedBin.type} Bin
                  </div>
                  <h4 className="text-sm font-semibold">{selectedBin.neighborhood}</h4>
                  <div className="text-xs text-slate-700">
                    Condition: <span className="font-semibold">{selectedBin.status}</span> · Fill:{' '}
                    <span className="font-mono tabular-nums">{selectedBin.capacityPct}%</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Updated {formatRelativeTime(selectedBin.updatedAt)}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>
      </div>

      <div className="flex flex-wrap items-center gap-6 px-5 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-600">
        <span className="font-medium text-slate-800">Map Legend:</span>
        <span>Amber Pin: Pending Report</span>
        <span>Blue Pin: In Progress</span>
        <span>Green Pin: Resolved</span>
        <span>Red Square: Overflowing / Damaged Bin</span>
        <span>Teal/Green Square: Operational Bin</span>
      </div>
    </div>
  );
}

interface PickerMapProps {
  latitude: number;
  longitude: number;
  onChangeCoords: (lat: number, lng: number) => void;
}

export function DschangLocationPickerMap({
  latitude,
  longitude,
  onChangeCoords,
}: PickerMapProps) {
  if (!MAPS_API_KEY) {
    return (
      <div className="h-[260px] flex items-center justify-center border border-slate-200 rounded-lg bg-slate-50 text-xs text-slate-500 px-4 text-center">
        Interactive map picker requires VITE_GOOGLE_MAPS_API_KEY. Enter coordinates manually below.
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
          <MapPin className="w-3.5 h-3.5 text-emerald-700" />
          Click on the Dschang map to set exact issue coordinates
        </span>
        <span className="font-mono tabular-nums text-slate-500">
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
      </div>
      <div className="w-full h-[280px]">
        <APIProvider apiKey={MAPS_API_KEY} libraries={['marker']} language="en" region="CM">
          <GoogleMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: latitude, lng: longitude }}
            defaultZoom={15}
            gestureHandling="greedy"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            onClick={(ev) => {
              const latLng = ev.detail?.latLng;
              if (latLng) {
                onChangeCoords(
                  Number(latLng.lat.toFixed(6)),
                  Number(latLng.lng.toFixed(6)),
                );
              }
            }}
            style={{ width: '100%', height: '100%' }}
          >
            <MapPanner target={{ lat: latitude, lng: longitude }} />
            <AdvancedMarker position={{ lat: latitude, lng: longitude }} title="Selected Report Location">
              <Pin background="#0F6B46" borderColor="#064E3B" glyphColor="#FFFFFF" />
            </AdvancedMarker>
          </GoogleMap>
        </APIProvider>
      </div>
    </div>
  );
}
