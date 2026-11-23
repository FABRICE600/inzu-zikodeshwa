import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Search, ShieldAlert, Trash2, X } from 'lucide-react';
import { apiRequest } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';

interface AdminPanelProps {
  onSelectListing: (id: number) => void;
  onBackToHome: () => void;
  onSwitchAccount: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  onSelectListing,
  onBackToHome,
  onSwitchAccount,
}) => {
  const { user, token, logout } = useAuth();
  const [tab, setTab] = useState<'listings' | 'users' | 'reports'>('listings');
  const [stats, setStats] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reportsList, setReportsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminError, setAdminError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const loadAdmin = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    setLoading(true);
    setAdminError('');
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
    } catch (err: any) {
      setAdminError(err.message || 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const filteredListings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return listings.filter((item) => {
      if (approvalFilter !== 'all' && item.approvalStatus !== approvalFilter) return false;
      if (!q) return true;
      return (
        item.title?.toLowerCase().includes(q) ||
        item.district?.toLowerCase().includes(q) ||
        item.sector?.toLowerCase().includes(q) ||
        item.landlord?.fullName?.toLowerCase().includes(q)
      );
    });
  }, [listings, searchQuery, approvalFilter]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.phone?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [usersList, searchQuery]);

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16">
        <div className="bg-white dark:bg-[#161b19] border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 sm:p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-white">Administrator access required</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            You are currently signed in as{' '}
            <span className="font-semibold text-zinc-900 dark:text-white">{user?.fullName || 'Guest'}</span> (
            <span className="capitalize">{user?.role || 'guest'}</span>). Sign in with an
            administrator account to open the Admin Console.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={async () => {
                await logout();
                onSwitchAccount();
              }}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold bg-[#0A4D38] hover:bg-[#073828] text-white rounded-xl transition-colors cursor-pointer whitespace-nowrap interactive-press"
            >
              Sign In as Admin
            </button>
            <button
              type="button"
              onClick={onBackToHome}
              className="w-full sm:w-auto px-4 py-2.5 text-sm font-semibold border border-stone-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-stone-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-xl transition-colors cursor-pointer whitespace-nowrap interactive-press"
            >
              Back to Browse Rentals
            </button>
          </div>
        </div>
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
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Admin Console</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Approve rental listings, manage user accounts, and review safety reports.
        </p>
      </div>

      {adminError && (
        <div className="p-3 text-sm bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg">
          {adminError}
        </div>
      )}

      {/* KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Users</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono tabular-nums mt-1">
              {stats.totalUsers}
            </div>
          </div>
          <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Total Listings</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono tabular-nums mt-1">
              {stats.totalListings}
            </div>
          </div>
          <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Pending Approvals</div>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 font-mono tabular-nums mt-1">
              {stats.pendingListings}
            </div>
          </div>
          <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Open Reports</div>
            <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 font-mono tabular-nums mt-1">
              {stats.openReports}
            </div>
          </div>
          <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Revenue (Phase 1)</div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono tabular-nums mt-1">
              {formatRwf(stats.totalRevenueRwf)}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs + Live Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setTab('listings')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              tab === 'listings' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Listings Moderation ({listings.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('users')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              tab === 'users' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Users ({usersList.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              tab === 'reports' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Reports ({reportsList.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'listings' && (
            <div className="inline-flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-xl">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setApprovalFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium capitalize rounded-lg cursor-pointer transition-colors ${
                    approvalFilter === st ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          )}

          {tab !== 'reports' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus-within:border-[#0A4D38]">
              <Search className="w-3.5 h-3.5 text-zinc-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tab === 'listings' ? 'Filter listings...' : 'Filter users...'}
                className="text-xs bg-transparent outline-none w-44 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-44 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ) : tab === 'listings' ? (
        <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/70">
              <tr>
                <th className="py-3 px-4 font-semibold">Property</th>
                <th className="py-3 px-4 font-semibold">Landlord</th>
                <th className="py-3 px-4 font-semibold text-right">Price</th>
                <th className="py-3 px-4 font-semibold">Approval</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredListings.map((item) => (
                <tr key={item.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => onSelectListing(item.id)}
                      className="font-semibold text-zinc-900 dark:text-white hover:text-[#0A4D38] dark:hover:text-emerald-400 text-left cursor-pointer"
                    >
                      {item.title}
                    </button>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.sector}, {item.district}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-300">
                    {item.landlord?.fullName || '—'}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatRwf(item.priceRwf)}
                  </td>
                  <td className="py-3 px-4 text-xs font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                    {item.approvalStatus}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleApproval(item.id, 'approved')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#0A4D38] text-white rounded-md cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApproval(item.id, 'rejected')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-md cursor-pointer"
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
        <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/70">
              <tr>
                <th className="py-3 px-4 font-semibold">Name</th>
                <th className="py-3 px-4 font-semibold">Contact</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-900/40">
                  <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">{u.fullName}</td>
                  <td className="py-3 px-4 text-xs text-zinc-600 dark:text-zinc-300">
                    {u.email || u.phone || '—'}
                  </td>
                  <td className="py-3 px-4 text-xs capitalize text-zinc-700 dark:text-zinc-300">{u.role}</td>
                  <td className="py-3 px-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    {u.isSuspended ? 'Suspended' : 'Active'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.id !== user.id && (
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSuspendUser(u.id, !u.isSuspended)}
                          className="px-2.5 py-1 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          {u.isSuspended ? 'Unsuspend' : 'Suspend'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
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
            <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No reports have been submitted.
            </div>
          ) : (
            reportsList.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Reporter: {r.reporter?.fullName} · Status:{' '}
                    <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-200">{r.status}</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5">
                    {r.reason} —{' '}
                    <button
                      type="button"
                      onClick={() => r.listing && onSelectListing(r.listing.id)}
                      className="text-[#0A4D38] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      {r.listing?.title || `Listing #${r.listingId}`}
                    </button>
                  </div>
                  {r.details && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{r.details}</p>}
                </div>

                {r.status === 'open' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleReportStatus(r.id, 'resolved')}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#0A4D38] text-white rounded-lg cursor-pointer"
                    >
                      Mark Resolved
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReportStatus(r.id, 'dismissed')}
                      className="px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg cursor-pointer"
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
