import React, { useCallback, useEffect, useState } from 'react';
import { Check, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { DSCHANG_NEIGHBORHOODS, formatRelativeTime } from '../lib/dschang.ts';
import {
  AdminUserItem,
  BinItem,
  DepartmentItem,
  PermissionItem,
  ReportItem,
  RoleItem,
  RolePermissionItem,
} from '../types.ts';

interface OperationsViewProps {
  onDataChanged: () => Promise<void>;
  onSelectReport: (report: ReportItem) => void;
}

export function OperationsView({ onDataChanged, onSelectReport }: OperationsViewProps) {
  const { authUser, signInWithGoogle, getIdToken } = useAuth();

  const [subTab, setSubTab] = useState<'triage' | 'bins' | 'rbac'>('triage');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [reports, setReports] = useState<ReportItem[]>([]);
  const [bins, setBins] = useState<BinItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [permissions, setPermissions] = useState<PermissionItem[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermissionItem[]>([]);

  const [queueFilter, setQueueFilter] = useState<
    'All' | 'Pending' | 'In Progress' | 'Resolved' | 'Collection Point Request'
  >('All');

  // Selected report for triage & assignment
  const [editingReport, setEditingReport] = useState<ReportItem | null>(null);
  const [editStatus, setEditStatus] = useState('Pending');
  const [editPriority, setEditPriority] = useState('Normal');
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [editWorker, setEditWorker] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // New bin registration
  const [newBinCode, setNewBinCode] = useState('');
  const [newBinHood, setNewBinHood] = useState(DSCHANG_NEIGHBORHOODS[0].name);
  const [newBinType, setNewBinType] = useState('General');
  const [newBinStatus, setNewBinStatus] = useState('Empty');
  const [newBinCap, setNewBinCap] = useState(10);

  // New department
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptEmail, setNewDeptEmail] = useState('');

  const isStaffOrAdmin =
    authUser?.rolename === 'Admin' || authUser?.rolename === 'Staff';
  const isAdmin = authUser?.rolename === 'Admin';

  const loadAdminData = useCallback(async () => {
    if (!isStaffOrAdmin) return;
    const token = await getIdToken();
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load municipal operations.');
        return;
      }
      setReports(data.reports || []);
      setBins(data.bins || []);
      setDepartments(data.departments || []);
      setUsers(data.users || []);
      setRoles(data.roles || []);
      setPermissions(data.permissions || []);
      setRolePermissions(data.rolePermissions || []);
    } catch {
      setErrorMsg('Network error loading municipal operations.');
    } finally {
      setLoading(false);
    }
  }, [getIdToken, isStaffOrAdmin]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const startEditingReport = (r: ReportItem) => {
    setEditingReport(r);
    setEditStatus(r.status);
    setEditPriority(r.priority);
    setEditDeptId(r.departmentId ? String(r.departmentId) : '');
    setEditWorker(r.assignedWorker || '');
    setEditNote('');
    setSuccessMsg(null);
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    const token = await getIdToken();
    if (!token) return;

    setSavingEdit(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/reports/${editingReport.reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: editStatus,
          priority: editPriority,
          departmentId: editDeptId ? Number(editDeptId) : null,
          assignedWorker: editWorker.trim() || null,
          note: editNote.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to save assignment.');
        return;
      }
      setSuccessMsg(
        `Updated ${editingReport.referenceCode} and sent status alert to ${editingReport.citizenName}.`,
      );
      setEditingReport(data.report);
      await loadAdminData();
      await onDataChanged();
    } catch {
      setErrorMsg('Network error saving report update.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleUpdateBin = async (bin: BinItem, nextStatus: string, nextCap: number) => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/admin/bins/${bin.binId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: nextStatus, capacityPct: nextCap }),
    });
    if (res.ok) {
      await loadAdminData();
      await onDataChanged();
      setSuccessMsg(`Updated ${bin.code} status to ${nextStatus}.`);
    }
  };

  const handleCreateBin = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getIdToken();
    if (!token) return;
    const hoodCoords =
      DSCHANG_NEIGHBORHOODS.find((n) => n.name === newBinHood) ||
      DSCHANG_NEIGHBORHOODS[0];

    const res = await fetch('/api/admin/bins', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        code: newBinCode,
        neighborhood: newBinHood,
        latitude: hoodCoords.lat,
        longitude: hoodCoords.lng,
        type: newBinType,
        status: newBinStatus,
        capacityPct: newBinCap,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || 'Failed to register bin.');
      return;
    }
    setNewBinCode('');
    setSuccessMsg(`Registered public bin ${data.bin.code} in ${data.bin.neighborhood}.`);
    await loadAdminData();
    await onDataChanged();
  };

  const handleRoleUpdate = async (
    targetUserId: number,
    roleId: number,
    departmentId: number | null,
  ) => {
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch(`/api/admin/users/${targetUserId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ roleId, departmentId }),
    });
    if (res.ok) {
      setSuccessMsg('Updated user role and department assignment.');
      await loadAdminData();
    }
  };

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getIdToken();
    if (!token) return;
    const res = await fetch('/api/admin/departments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: newDeptName,
        contactEmail: newDeptEmail || null,
        description: 'Municipal sanitation unit',
      }),
    });
    if (res.ok) {
      setNewDeptName('');
      setNewDeptEmail('');
      setSuccessMsg('Created municipal department.');
      await loadAdminData();
      await onDataChanged();
    }
  };

  if (!authUser) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 max-w-xl mx-auto text-center space-y-4">
        <Shield className="w-8 h-8 text-emerald-800 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          Municipal Operations Sign-In Required
        </h2>
        <p className="text-sm text-slate-600">
          Administrative triage, crew assignment, public bin management, and RBAC controls are restricted to authorized Dschang Municipal Council staff and administrators.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
        >
          Sign In with Google
        </button>
      </div>
    );
  }

  if (!isStaffOrAdmin) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 max-w-xl mx-auto text-center space-y-3">
        <Shield className="w-8 h-8 text-amber-700 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">
          Citizen Account Active ({authUser.rolename})
        </h2>
        <p className="text-sm text-slate-600">
          Your account (<span className="font-mono">{authUser.email}</span>) currently holds the{' '}
          <span className="font-semibold">Citizen</span> role. Municipal administrators can grant Staff or Admin permissions under Departments & Roles.
        </p>
      </div>
    );
  }

  const filteredReports = reports.filter((r) => {
    if (queueFilter === 'All') return true;
    if (queueFilter === 'Collection Point Request') {
      return r.reportType === 'Collection Point Request';
    }
    return r.status === queueFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Municipal Sanitation Operations
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Signed in as {authUser.fullname} · Role: <span className="font-semibold text-emerald-800">{authUser.rolename}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setSubTab('triage')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'triage'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Reports Triage ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('bins')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'bins'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Public Dustbins ({bins.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('rbac')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'rbac'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Departments & Roles
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="text-xs text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-700" />
          {successMsg}
        </div>
      )}

      {loading && reports.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-sm text-slate-500">
          Loading municipal queue...
        </div>
      ) : null}

      {/* SUB-TAB 1: REPORTS TRIAGE & ASSIGNMENT */}
      {subTab === 'triage' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    'All',
                    'Pending',
                    'In Progress',
                    'Resolved',
                    'Collection Point Request',
                  ] as const
                ).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setQueueFilter(f)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      queueFilter === f
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:text-slate-900'
                    }`}
                  >
                    {f === 'Collection Point Request' ? 'Point Requests' : f}
                  </button>
                ))}
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                {filteredReports.length} items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Ref</th>
                    <th className="py-2.5 px-4 font-semibold">Issue & Neighborhood</th>
                    <th className="py-2.5 px-4 font-semibold">Assigned Team</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredReports.map((rep) => (
                    <tr
                      key={rep.reportId}
                      onClick={() => startEditingReport(rep)}
                      className={`cursor-pointer transition-colors ${
                        editingReport?.reportId === rep.reportId
                          ? 'bg-emerald-50/60'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {rep.referenceCode}
                        {rep.duplicateOfReportId && (
                          <div className="text-[10px] text-amber-700 font-sans">
                            Linked dup #{rep.duplicateOfReportId}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-semibold text-slate-900 truncate">
                          {rep.title}
                        </div>
                        <div className="text-slate-500 mt-0.5">
                          {rep.neighborhood} · {rep.priority} · {formatRelativeTime(rep.dateSubmitted)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{rep.departmentName || 'Unassigned'}</div>
                        {rep.assignedWorker && (
                          <div className="text-slate-500">{rep.assignedWorker}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            rep.status === 'Resolved'
                              ? 'text-emerald-700'
                              : rep.status === 'In Progress'
                                ? 'text-blue-700'
                                : 'text-amber-700'
                          }`}
                        >
                          {rep.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(rep);
                          }}
                          className="text-emerald-800 font-medium hover:underline mr-3"
                        >
                          Inspect
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditingReport(rep);
                          }}
                          className="text-slate-700 font-semibold hover:underline"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Assignment Drawer */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
            {!editingReport ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                Select any report from the municipal queue to assign a department, dispatch a sanitation worker, or update status.
              </div>
            ) : (
              <form onSubmit={handleSaveTriage} className="space-y-4">
                <div className="pb-3 border-b border-slate-100">
                  <div className="text-xs font-mono text-slate-500">
                    {editingReport.referenceCode} · {editingReport.neighborhood}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {editingReport.title}
                  </h3>
                  <div className="text-xs text-slate-500 mt-1">
                    Reporter: {editingReport.citizenName}
                    {editingReport.citizenEmail ? ` (${editingReport.citizenEmail})` : ''}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Report Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Department
                  </label>
                  <select
                    value={editDeptId}
                    onChange={(e) => setEditDeptId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sanitation Worker / Crew
                  </label>
                  <input
                    type="text"
                    value={editWorker}
                    onChange={(e) => setEditWorker(e.target.value)}
                    placeholder="e.g. M. Kamdem Pierre / Truck 2"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status Update Note (Sent to Citizen)
                  </label>
                  <textarea
                    rows={2}
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="e.g. Compactor crew dispatched for 08:00 clearance."
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
                >
                  {savingEdit ? 'Saving Update...' : 'Save Status & Notify Citizen'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 2: PUBLIC DUSTBINS REGISTRY */}
      {subTab === 'bins' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-emerald-700" />
                Dschang Public Dustbins Inventory
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Code</th>
                    <th className="py-2.5 px-4 font-semibold">Neighborhood</th>
                    <th className="py-2.5 px-4 font-semibold">Type</th>
                    <th className="py-2.5 px-4 font-semibold">Fill %</th>
                    <th className="py-2.5 px-4 font-semibold">Condition</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bins.map((bin) => (
                    <tr key={bin.binId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono tabular-nums font-semibold text-slate-900">
                        {bin.code}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <div>{bin.neighborhood}</div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {bin.latitude.toFixed(4)}, {bin.longitude.toFixed(4)}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{bin.type}</td>
                      <td className="py-3 px-4 font-mono tabular-nums text-slate-800">
                        {bin.capacityPct}%
                      </td>
                      <td className="py-3 px-4 font-semibold">
                        <span
                          className={
                            bin.status === 'Overflowing' || bin.status === 'Damaged'
                              ? 'text-red-700'
                              : bin.status === 'Full'
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                          }
                        >
                          {bin.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => handleUpdateBin(bin, 'Empty', 0)}
                          className="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded border border-emerald-200"
                        >
                          Mark Emptied
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateBin(bin, 'Damaged', bin.capacityPct)}
                          className="px-2 py-1 text-[11px] font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded border border-slate-200"
                        >
                          Flag Damaged
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form
            onSubmit={handleCreateBin}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-4 h-4 text-emerald-700" />
              Register Public Bin
            </h3>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bin Code
              </label>
              <input
                type="text"
                required
                value={newBinCode}
                onChange={(e) => setNewBinCode(e.target.value)}
                placeholder="e.g. BIN-FOR-09"
                className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Neighborhood
              </label>
              <select
                value={newBinHood}
                onChange={(e) => setNewBinHood(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                {DSCHANG_NEIGHBORHOODS.map((n) => (
                  <option key={n.name} value={n.name}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bin Type
                </label>
                <select
                  value={newBinType}
                  onChange={(e) => setNewBinType(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="General">General</option>
                  <option value="Market">Market</option>
                  <option value="Recyclable">Recyclable</option>
                  <option value="Organic">Organic</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Fill %
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={newBinCap}
                  onChange={(e) => setNewBinCap(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Status
              </label>
              <select
                value={newBinStatus}
                onChange={(e) => setNewBinStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="Empty">Empty</option>
                <option value="Half Full">Half Full</option>
                <option value="Full">Full</option>
                <option value="Overflowing">Overflowing</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 text-xs font-semibold text-white bg-emerald-800 hover:bg-emerald-900 rounded-lg transition-colors"
            >
              Add Public Bin
            </button>
          </form>
        </div>
      )}

      {/* SUB-TAB 3: DEPARTMENTS, USERS & RBAC */}
      {subTab === 'rbac' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" />
                  Registered Users & Role Assignments
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">User</th>
                      <th className="py-2.5 px-4 font-semibold">Role</th>
                      <th className="py-2.5 px-4 font-semibold">Department</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.userId}>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{u.fullname}</div>
                          <div className="text-slate-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          {isAdmin ? (
                            <select
                              aria-label={`Role for ${u.fullname}`}
                              value={u.roleId}
                              onChange={(e) =>
                                handleRoleUpdate(
                                  u.userId,
                                  Number(e.target.value),
                                  u.departmentId,
                                )
                              }
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
                            >
                              {roles.map((r) => (
                                <option key={r.roleId} value={r.roleId}>
                                  {r.rolename}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-semibold text-slate-800">
                              {u.rolename}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {isAdmin ? (
                            <select
                              aria-label={`Department for ${u.fullname}`}
                              value={u.departmentId || ''}
                              onChange={(e) =>
                                handleRoleUpdate(
                                  u.userId,
                                  u.roleId,
                                  e.target.value ? Number(e.target.value) : null,
                                )
                              }
                              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs"
                            >
                              <option value="">None</option>
                              {departments.map((d) => (
                                <option key={d.departmentId} value={d.departmentId}>
                                  {d.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-slate-600">
                              {u.departmentName || 'None'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  Municipal Departments
                </h3>
                <div className="divide-y divide-slate-100">
                  {departments.map((d) => (
                    <div key={d.departmentId} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                      <div className="font-semibold text-slate-900">{d.name}</div>
                      {d.contactEmail && (
                        <div className="font-mono text-slate-500 mt-0.5">
                          {d.contactEmail}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {isAdmin && (
                  <form
                    onSubmit={handleCreateDepartment}
                    className="pt-3 border-t border-slate-100 space-y-2.5"
                  >
                    <input
                      type="text"
                      required
                      value={newDeptName}
                      onChange={(e) => setNewDeptName(e.target.value)}
                      placeholder="New unit name..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="email"
                      value={newDeptEmail}
                      onChange={(e) => setNewDeptEmail(e.target.value)}
                      placeholder="Contact email..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <button
                      type="submit"
                      className="w-full py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                    >
                      Add Department
                    </button>
                  </form>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-bold text-slate-900">
                  RBAC Permissions Matrix
                </h3>
                <div className="space-y-2.5 text-xs">
                  {roles.map((role) => {
                    const permIds = rolePermissions
                      .filter((rp) => rp.roleId === role.roleId)
                      .map((rp) => rp.permissionId);
                    const permNames = permissions
                      .filter((p) => permIds.includes(p.permissionId))
                      .map((p) => p.permissionname);
                    return (
                      <div key={role.roleId} className="border-b border-slate-100 pb-2 last:border-b-0">
                        <div className="font-semibold text-slate-900">{role.rolename}</div>
                        <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                          {permNames.join(' · ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
