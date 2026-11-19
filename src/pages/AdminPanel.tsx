import React, { useCallback, useEffect, useState } from 'react';
import { Check, ShieldAlert, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface AdminPanelProps {
  onSelectListing: (id: number) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onSelectListing }) => {
  const { user, token } = useAuth();
  const [tab, setTab] = useState<'listings' | 'users' | 'reports'>('listings');
  const [stats, setStats] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAdmin = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    try {
      const [ov, ls, us, rp] = await Promise.all([
        apiRequest<{ stats: any }>('/api/admin/overview', { token }),
        apiRequest<{ items: any[] }>('/api/admin/listings', { token }),
        apiRequest<{ items: any[] }>('/api/admin/users', { token }),
        apiRequest<{ items: any[] }>('/api/admin/reports', { token }),
      ]);
      setStats(ov.stats);
      setListings(ls.items);
      setUsersList(us.items);
      setReportsList(rp.items);
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto mb-3" />
        <p className="font-semibold text-zinc-900">Administrator access required.</p>
      </div>
    );
  }

  const handleApproval = async (id: number, approvalStatus: 'approved' | 'rejected') => {
    if (!token) return;
    await apiRequest(`/api/admin/listings/${id}/approval`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ approvalStatus }),
    });
    await loadAdmin();
  };

  const handleSuspendUser = async (id: number, isSuspended: boolean) => {
    if (!token) return;
    await apiRequest(`/api/admin/users/${id}/suspend`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ isSuspended }),
    });
    await loadAdmin();
  };

  const handleDeleteUser = async (id: number) => {
    if (!token) return;
    await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE', token });
    await loadAdmin();
  };

  const handleReportStatus = async (id: number, status: 'resolved' | 'dismissed') => {
    if (!token) return;
    await apiRequest(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status }),
    });
    await loadAdmin();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Admin Console</h1>
        <p className="text-sm text-zinc-500">
          Approve rental listings, manage user accounts, and review safety reports.
        </p>
      </div>

      {/* KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="text-xs text-zinc-500">Total Users</div>
            <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums mt-1">
              {stats.totalUsers}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="text-xs text-zinc-500">Total Listings</div>
            <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums mt-1">
              {stats.totalListings}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="text-xs text-zinc-500">Pending Approvals</div>
            <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
              {stats.pendingListings}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="text-xs text-zinc-500">Open Reports</div>
            <div className="text-2xl font-bold text-rose-700 font-mono tabular-nums mt-1">
              {stats.openReports}
            </div>
          </div>
          <div className="bg-white border border-zinc-200 rounded-xl p-4">
            <div className="text-xs text-zinc-500">Revenue (Phase 1)</div>
            <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums mt-1">
              {formatRwf(stats.totalRevenueRwf)}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="inline-flex bg-zinc-100 p-1 rounded-lg">
        <button
          type="button"
          onClick={() => setTab('listings')}
          className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'listings' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
          }`}
        >
          Listings Moderation ({listings.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('users')}
          className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'users' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
          }`}
        >
          Users ({usersList.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('reports')}
          className={`px-4 py-2 text-xs font-semibold rounded-md cursor-pointer ${
            tab === 'reports' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
          }`}
        >
          Reports ({reportsList.length})
        </button>
      </div>

      {loading ? (
        <div className="h-44 bg-zinc-200 rounded-xl animate-pulse" />
      ) : tab === 'listings' ? (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 bg-zinc-50">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-4 font-semibold">Landlord</th>
                <th className="py-3 px-4 font-semibold text-right">Price</th>
                <th className="py-3 px-4 font-semibold">Approval</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {listings.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/70">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onSelectListing(item.id)}
                      className="font-semibold text-zinc-900 hover:text-[#0D5C43] text-left cursor-pointer"
                    >
                      {item.title}
                    </button>
                    <div className="text-xs text-zinc-500">
                      {item.sector}, {item.district}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-600">
                    {item.landlord?.fullName || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold">
                    {formatRwf(item.priceRwf)}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold capitalize">
                    {item.approvalStatus}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApproval(item.id, 'approved')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#0D5C43] text-white rounded-md cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproval(item.id, 'rejected')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-rose-200 text-rose-700 rounded-md cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === 'users' ? (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 text-xs text-zinc-500 bg-zinc-50">
              <tr>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Contact</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {usersList.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/70">
                  <td className="py-3 px-4 font-semibold text-zinc-900">{u.fullName}</td>
                  <td className="py-3 px-4 text-xs text-zinc-600">
                    {u.email || u.phone || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs capitalize text-zinc-700">{u.role}</td>
                  <td className="py-3 px-4 text-xs font-semibold">
                    {u.isSuspended ? 'Suspended' : 'Active'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.id !== user.id && (
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSuspendUser(u.id, !u.isSuspended)}
                          className="px-2.5 py-1 text-xs font-medium border border-zinc-200 rounded-md hover:bg-zinc-50 cursor-pointer"
                        >
                          {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-rose-200 text-rose-700 rounded-md hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {reportsList.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center text-sm text-zinc-500">
              No reports have been submitted.
            </div>
          ) : (
            reportsList.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs text-zinc-500">
                    Reporter: {r.reporter?.fullName} · Status:{' '}
                    <span className="font-semibold capitalize text-zinc-800">{r.status}</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-900 mt-0.5">
                    {r.reason} —{' '}
                    <button
                      type="button"
                      onClick={() => r.listing && onSelectListing(r.listing.id)}
                      className="text-[#0D5C43] hover:underline cursor-pointer"
                    >
                      {r.listing?.title || `Listing #${r.listingId}`}
                    </button>
                  </div>
                  {r.details && <p className="text-sm text-zinc-600 mt-1">{r.details}</p>}
                </div>

                {r.status === 'open' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReportStatus(r.id, 'resolved')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0D5C43] text-white rounded-lg cursor-pointer"
                    >
                      Mark Resolved
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportStatus(r.id, 'dismissed')}
                      className="px-3 py-1.5 text-xs font-semibold border border-zinc-200 text-zinc-700 rounded-lg cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
