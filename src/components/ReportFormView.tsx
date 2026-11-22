import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Compass,
  ThumbsUp,
  Upload,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  DSCHANG_NEIGHBORHOODS,
  compressImageFile,
  formatRelativeTime,
} from '../lib/dschang.ts';
import {
  BinItem,
  CategoryItem,
  DuplicateMatch,
  NotificationItem,
  ReportItem,
} from '../types.ts';
import { DschangLocationPickerMap } from './DschangMap.tsx';

interface ReportFormViewProps {
  categories: CategoryItem[];
  bins: BinItem[];
  onSubmitted: () => Promise<void>;
  onSelectReport: (report: ReportItem) => void;
}

export function ReportFormView({
  categories,
  bins,
  onSubmitted,
  onSelectReport,
}: ReportFormViewProps) {
  const { authUser, signInWithGoogle, getIdToken, refreshProfile } = useAuth();

  const [reportType, setReportType] = useState<'Complaint' | 'Collection Point Request'>('Complaint');
  const [categoryId, setCategoryId] = useState<number>(categories[0]?.categoryId || 1);
  const [neighborhood, setNeighborhood] = useState<string>(DSCHANG_NEIGHBORHOODS[0].name);
  const [latitude, setLatitude] = useState<number>(DSCHANG_NEIGHBORHOODS[0].lat);
  const [longitude, setLongitude] = useState<number>(DSCHANG_NEIGHBORHOODS[0].lng);
  const [binId, setBinId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'High' | 'Urgent'>('Normal');
  const [preferredChannel, setPreferredChannel] = useState<'In-App' | 'Email' | 'SMS'>('In-App');
  const [phoneInput, setPhoneInput] = useState(authUser?.phone || '');
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string | null>(null);

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [duplicateOfReportId, setDuplicateOfReportId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdReport, setCreatedReport] = useState<ReportItem | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const [myReports, setMyReports] = useState<ReportItem[]>([]);
  const [myNotifications, setMyNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.categoryId === categoryId)) {
      setCategoryId(categories[0].categoryId);
    }
  }, [categories, categoryId]);

  useEffect(() => {
    if (reportType === 'Collection Point Request') {
      const reqCat = categories.find((c) => c.name === 'New Collection Point');
      if (reqCat) setCategoryId(reqCat.categoryId);
    }
  }, [reportType, categories]);

  useEffect(() => {
    if (authUser?.phone && !phoneInput) {
      setPhoneInput(authUser.phone);
    }
  }, [authUser?.phone, phoneInput]);

  const loadMyActivity = async () => {
    const token = await getIdToken();
    if (!token) return;
    try {
      const res = await fetch('/api/my-reports', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyReports(data.reports || []);
        setMyNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load citizen activity:', err);
    }
  };

  useEffect(() => {
    if (authUser) {
      loadMyActivity();
    } else {
      setMyReports([]);
      setMyNotifications([]);
    }
  }, [authUser]);

  // Live duplicate report detection whenever neighborhood, category, or coordinates change
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/reports/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            neighborhood,
            categoryId,
            latitude,
            longitude,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setDuplicates(data.duplicates || []);
        }
      } catch {
        // Ignore transient network check errors
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [neighborhood, categoryId, latitude, longitude]);

  const handleNeighborhoodChange = (name: string) => {
    setNeighborhood(name);
    const match = DSCHANG_NEIGHBORHOODS.find((n) => n.name === name);
    if (match) {
      setLatitude(match.lat);
      setLongitude(match.lng);
    }
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation is not supported by your browser.');
      return;
    }
    setGpsStatus('Locating...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setGpsStatus('GPS coordinates captured.');
      },
      () => {
        setGpsStatus('Could not acquire GPS signal. Click the map to set location.');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    try {
      const compressed = await compressImageFile(file);
      setPhotoData(compressed);
      setPhotoFileName(file.name);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process image.');
    }
  };

  const handleConfirmExisting = async (dupReportId: number) => {
    if (!authUser) {
      await signInWithGoogle();
      return;
    }
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/reports/${dupReportId}/confirm`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      await onSubmitted();
      setDuplicates((prev) =>
        prev.map((d) =>
          d.reportId === dupReportId ? { ...d, upvotes: d.upvotes + 1 } : d,
        ),
      );
    }
  };

  const handleMarkNotifRead = async (notificationId: number) => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setMyNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === notificationId ? { ...n, isRead: true } : n,
        ),
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCreatedReport(null);

    if (!authUser) {
      await signInWithGoogle();
      return;
    }

    const token = await getIdToken();
    if (!token) {
      setErrorMsg('Please sign in to submit a report.');
      return;
    }

    setSubmitting(true);
    try {
      if (preferredChannel === 'SMS' && phoneInput.trim() && phoneInput.trim() !== authUser.phone) {
        await fetch('/api/me', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullname: authUser.fullname,
            phone: phoneInput.trim(),
          }),
        });
        await refreshProfile();
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          neighborhood,
          latitude,
          longitude,
          reportType,
          priority,
          categoryId,
          binId: binId ? Number(binId) : null,
          photoData,
          preferredChannel,
          duplicateOfReportId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Could not submit report.');
        return;
      }

      setCreatedReport(data.report);
      setTitle('');
      setDescription('');
      setPhotoData(null);
      setPhotoFileName(null);
      setDuplicateOfReportId(null);
      await onSubmitted();
      await loadMyActivity();
    } catch {
      setErrorMsg('Network error submitting report.');
    } finally {
      setSubmitting(false);
    }
  };

  const neighborhoodBins = bins.filter((b) => b.neighborhood === neighborhood);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Main Form */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-900">
            Submit a Citizen Waste Report
          </h2>
          <p className="text-sm text-slate-600">
            Log an overflowing bin, illegal dumping site, or request a new public collection point in Dschang.
          </p>
        </div>

        {createdReport && (
          <div className="border border-emerald-200 bg-emerald-50/70 rounded-lg p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-emerald-950">
                  Report {createdReport.referenceCode} submitted
                </div>
                <p className="text-emerald-900/80 text-xs mt-0.5">
                  Save your reference code to track municipal crew progress at any time.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectReport(createdReport)}
              className="text-xs font-semibold text-emerald-800 hover:underline whitespace-nowrap shrink-0"
            >
              View Report
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Report Type Switch */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Submission Type
            </span>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
              {(['Complaint', 'Collection Point Request'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setReportType(type)}
                  className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    reportType === type
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type === 'Complaint' ? 'Waste Complaint' : 'Request Collection Point'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="report-category"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Issue Category
              </label>
              <select
                id="report-category"
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                {categories.map((cat) => (
                  <option key={cat.categoryId} value={cat.categoryId}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="report-neighborhood"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Dschang Neighborhood
              </label>
              <select
                id="report-neighborhood"
                value={neighborhood}
                onChange={(e) => handleNeighborhoodChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                {DSCHANG_NEIGHBORHOODS.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duplicate Report Detection Alert */}
          {duplicates.length > 0 && (
            <div className="border border-amber-200 bg-amber-50/70 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-amber-950">
                    Possible duplicate report detected nearby
                  </div>
                  <p className="text-xs text-amber-900/80 mt-0.5">
                    To avoid duplicate dispatches, you can confirm an active report below instead of creating a new entry.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {duplicates.map((dup) => (
                  <div
                    key={dup.reportId}
                    className="bg-white border border-amber-200/80 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-slate-500">
                        {dup.referenceCode} · {dup.status}
                        {dup.distanceMeters !== null ? ` · ${dup.distanceMeters}m away` : ''}
                      </div>
                      <div className="font-semibold text-slate-900 truncate mt-0.5">
                        {dup.title}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmExisting(dup.reportId)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-950 font-semibold transition-colors"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        Confirm ({dup.upvotes})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDuplicateOfReportId(
                            duplicateOfReportId === dup.reportId ? null : dup.reportId,
                          )
                        }
                        className={`px-2.5 py-1.5 rounded-md border font-medium transition-colors ${
                          duplicateOfReportId === dup.reportId
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {duplicateOfReportId === dup.reportId ? 'Linked' : 'Link as Related'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Location Picker Map + GPS */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Pin Exact Location
              </span>
              <button
                type="button"
                onClick={handleUseGps}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-800 hover:text-emerald-950"
              >
                <Compass className="w-3.5 h-3.5" />
                Use My GPS Location
              </button>
            </div>
            {gpsStatus && <div className="text-xs text-slate-500">{gpsStatus}</div>}
            <DschangLocationPickerMap
              latitude={latitude}
              longitude={longitude}
              onChangeCoords={(lat, lng) => {
                setLatitude(lat);
                setLongitude(lng);
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="report-bin"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Nearest Public Dustbin (Optional)
              </label>
              <select
                id="report-bin"
                value={binId}
                onChange={(e) => setBinId(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                <option value="">No specific dustbin / Roadside</option>
                {(neighborhoodBins.length > 0 ? neighborhoodBins : bins).map((b) => (
                  <option key={b.binId} value={b.binId}>
                    {b.code} — {b.neighborhood} ({b.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="report-priority"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Urgency Level
              </label>
              <select
                id="report-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'Normal' | 'High' | 'Urgent')}
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                <option value="Normal">Normal</option>
                <option value="High">High — Blocking street or market</option>
                <option value="Urgent">Urgent — Health or drainage hazard</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="report-title"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Short Summary Title
            </label>
            <input
              id="report-title"
              type="text"
              required
              minLength={4}
              maxLength={150}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Overflowing bin behind Marché A textile stalls"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          <div>
            <label
              htmlFor="report-desc"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Detailed Description & Landmarks
            </label>
            <textarea
              id="report-desc"
              required
              minLength={8}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the waste condition, nearby landmarks, and access constraints for collection trucks..."
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
          </div>

          {/* Photo Upload */}
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Photo Evidence (Recommended)
            </span>
            <label className="flex items-center justify-between gap-4 border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 rounded-lg p-4 cursor-pointer transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                  {photoData ? <Camera className="w-5 h-5 text-emerald-700" /> : <Upload className="w-5 h-5" />}
                </div>
                <div className="text-xs">
                  <div className="font-semibold text-slate-800">
                    {photoFileName || 'Attach a field photograph'}
                  </div>
                  <div className="text-slate-500">
                    JPEG, PNG, or WebP · Automatically compressed for fast upload
                  </div>
                </div>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="sr-only"
              />
              <span className="text-xs font-semibold text-emerald-800">
                {photoData ? 'Replace' : 'Choose File'}
              </span>
            </label>
            {photoData && (
              <div className="mt-2 relative rounded-lg overflow-hidden border border-slate-200 h-40">
                <img
                  src={photoData}
                  alt="Report evidence preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPhotoData(null);
                    setPhotoFileName(null);
                  }}
                  className="absolute top-2 right-2 px-2.5 py-1 text-xs font-medium bg-slate-900/80 text-white rounded-md hover:bg-slate-900"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Notification Channel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label
                htmlFor="notif-channel"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Status Update Alerts
              </label>
              <select
                id="notif-channel"
                value={preferredChannel}
                onChange={(e) =>
                  setPreferredChannel(e.target.value as 'In-App' | 'Email' | 'SMS')
                }
                className="w-full px-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
              >
                <option value="In-App">In-App Notification Center</option>
                <option value="Email">Email Status Alerts</option>
                <option value="SMS">SMS Alert (Cameroon Mobile)</option>
              </select>
            </div>
            {preferredChannel === 'SMS' && (
              <div>
                <label
                  htmlFor="citizen-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Mobile Number for SMS Updates
                </label>
                <input
                  id="citizen-phone"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="+237 6XX XX XX XX"
                  className="w-full px-3 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-700"
                />
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {errorMsg}
            </div>
          )}

          {!authUser ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-slate-700">
                Sign in with your Google account so your report can be tracked and updated by Dschang municipal staff.
              </div>
              <button
                type="button"
                onClick={signInWithGoogle}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Sign In & Continue
              </button>
            </div>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 disabled:opacity-60 rounded-lg transition-colors"
            >
              {submitting ? 'Submitting Report...' : 'Submit Waste Report'}
            </button>
          )}
        </form>
      </div>

      {/* Right Column: My Reports & Notification Center */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-700" />
              Status Notifications
            </h3>
            {authUser && (
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {myNotifications.filter((n) => !n.isRead).length} unread
              </span>
            )}
          </div>

          {!authUser ? (
            <p className="text-xs text-slate-500">
              Sign in to view real-time status notifications for your submitted waste reports.
            </p>
          ) : myNotifications.length === 0 ? (
            <p className="text-xs text-slate-500">
              No notifications yet. You will receive updates here whenever a municipal officer assigns or resolves your report.
            </p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {myNotifications.map((notif) => (
                <div
                  key={notif.notificationId}
                  className={`border rounded-lg p-3 text-xs space-y-1.5 ${
                    notif.isRead
                      ? 'bg-white border-slate-200 text-slate-600'
                      : 'bg-emerald-50/50 border-emerald-200 text-slate-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-500">
                    <span>
                      {notif.referenceCode} · {notif.channel}
                    </span>
                    <span>{formatRelativeTime(notif.datesend)}</span>
                  </div>
                  <p className="leading-relaxed">{notif.message}</p>
                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkNotifRead(notif.notificationId)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                    >
                      <Check className="w-3 h-3" />
                      Mark as read
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-slate-900">
            My Submitted Reports
          </h3>
          {!authUser ? (
            <p className="text-xs text-slate-500">
              Sign in to access your personal history of waste complaints and collection point requests.
            </p>
          ) : myReports.length === 0 ? (
            <p className="text-xs text-slate-500">
              You have not submitted any reports yet.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {myReports.map((rep) => (
                <button
                  key={rep.reportId}
                  type="button"
                  onClick={() => onSelectReport(rep)}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 hover:bg-slate-50/80 transition-colors rounded-md px-1"
                >
                  <div className="flex items-center justify-between text-xs font-mono text-slate-500">
                    <span>
                      {rep.referenceCode} · {rep.neighborhood}
                    </span>
                    <span
                      className={`font-sans font-semibold ${
                        rep.status === 'Resolved'
                          ? 'text-emerald-700'
                          : rep.status === 'In Progress'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {rep.status}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 mt-1 truncate">
                    {rep.title}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
