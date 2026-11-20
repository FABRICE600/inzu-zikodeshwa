import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Home,
  Plus,
  Trash2,
} from 'lucide-react';
import { apiRequest, ListingItem, UserProfile } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { CreateListingWizard } from '../components/CreateListingWizard.tsx';

interface LandlordDashboardProps {
  onSelectListing: (id: number) => void;
}

const FALLBACK_PHOTO = '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg';

export const LandlordDashboard: React.FC<LandlordDashboardProps> = ({ onSelectListing }) => {
  const { user, token, setUser } = useAuth();
  const { t } = useLanguage();

  const [tab, setTab] = useState<'listings' | 'form' | 'requests'>('listings');
  const [editingListing, setEditingListing] = useState<ListingItem | null>(null);
  const [myListings, setMyListings] = useState<ListingItem[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [listRes, reqRes] = await Promise.all([
        apiRequest<{ items: ListingItem[] }>('/api/listings?mine=true&limit=50', { token }),
        apiRequest<{ items: any[] }>('/api/tenant/viewings', { token }),
      ]);
      setMyListings(listRes.items);
      setRequests(reqRes.items.filter((r) => r.landlordId === user?.id));
    } catch (err: any) {
      setError(err.message || 'Could not load landlord data.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpgradeRole = async () => {
    if (!token || !user) return;
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          fullName: user.fullName,
          phone: user.phone || '',
          whatsapp: user.whatsapp || '',
          bio: user.bio || '',
          role: 'landlord',
        }),
      });
      setUser(res.user);
      setNotice('Your account is now enabled as a Landlord.');
    } catch (err: any) {
      setError(err.message || 'Could not switch role.');
    }
  };

  if (user && user.role === 'tenant') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-8 space-y-4">
          <Home className="w-10 h-10 text-[#0D5C43] dark:text-emerald-400 mx-auto" />
          <h1 className="text-xl font-bold text-zinc-900 dark:text-white">Post Properties as a Landlord</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Your account is currently registered as a Tenant. Switch to a Landlord account to create and manage rental listings.
          </p>
          <button
            type="button"
            onClick={handleUpgradeRole}
            className="px-5 py-2.5 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Enable Landlord Account
          </button>
        </div>
      </div>
    );
  }

  const handleStatusChange = async (id: number, nextStatus: 'available' | 'rented' | 'hidden') => {
    if (!token) return;
    await apiRequest(`/api/listings/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadData();
  };

  const handleDuplicate = async (id: number) => {
    if (!token) return;
    await apiRequest(`/api/listings/${id}/duplicate`, { method: 'POST', token });
    setNotice('Listing duplicated as paused draft.');
    await loadData();
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await apiRequest(`/api/listings/${id}`, { method: 'DELETE', token });
    await loadData();
  };

  const handleViewingDecision = async (id: number, decision: 'confirmed' | 'declined') => {
    if (!token) return;
    await apiRequest(`/api/tenant/viewings/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status: decision }),
    });
    await loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Landlord Workspace</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Manage rental listings, drafts, photos, map locations, and tenant viewing requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('listings')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'listings' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              My Listings ({myListings.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('requests')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'requests' ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-600 dark:text-zinc-300'
              }`}
            >
              Viewing Requests ({requests.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingListing(null);
              setNotice('');
              setError('');
              setTab('form');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> New Listing
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 text-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg">
          {notice}
        </div>
      )}

      {tab === 'listings' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-40 bg-zinc-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
          ) : myListings.length === 0 ? (
            <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center">
              <p className="font-semibold text-zinc-900 dark:text-white">You have not posted any properties yet.</p>
              <button
                type="button"
                onClick={() => {
                  setEditingListing(null);
                  setTab('form');
                }}
                className="mt-4 px-4 py-2 bg-[#0D5C43] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Create Your First Listing
              </button>
            </div>
          ) : (
            myListings.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <img
                    src={item.coverPhoto || FALLBACK_PHOTO}
                    alt={item.title}
                    className="w-28 h-20 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t(`type_${item.propertyType}`)} · {item.sector}, {item.district} · Approval:{' '}
                      <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                        {item.approvalStatus}
                      </span>{' '}
                      · Status:{' '}
                      <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-200">
                        {item.status === 'hidden' ? 'Draft / Paused' : item.status}
                      </span>
                    </div>
                    <h3
                      onClick={() => onSelectListing(item.id)}
                      className="text-base font-bold text-zinc-900 dark:text-white hover:text-[#0D5C43] dark:hover:text-emerald-400 cursor-pointer truncate mt-0.5"
                    >
                      {item.title}
                    </h3>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#0D5C43] dark:text-emerald-400 mt-1">
                      {formatRwf(item.priceRwf)} / mo · {item.viewsCount} views
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingListing(item);
                      setTab('form');
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>

                  {item.status === 'available' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, 'hidden')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, 'available')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Republish
                    </button>
                  )}

                  {item.status !== 'rented' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, 'rented')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark Rented
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDuplicate(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No viewing requests or inquiries received yet.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.requestType === 'viewing' ? 'Viewing Request' : 'Direct Message'} ·{' '}
                    <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-200">{r.status}</span>
                    {r.preferredDate ? ` · Requested: ${r.preferredDate} ${r.preferredTime || ''}` : ''}
                  </div>
                  <div className="text-sm font-bold text-zinc-900 dark:text-white">
                    {r.tenant?.fullName} ({r.tenant?.phone || 'No phone'}) —{' '}
                    <span className="font-normal text-zinc-600 dark:text-zinc-400">{r.listing?.title}</span>
                  </div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{r.message}</p>
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleViewingDecision(r.id, 'confirmed')}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#0D5C43] text-white rounded-lg cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewingDecision(r.id, 'declined')}
                      className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'form' && token && (
        <CreateListingWizard
          key={editingListing?.id ?? 'new'}
          token={token}
          initialListing={editingListing}
          onSaved={async (_listing, mode) => {
            await loadData();
            if (mode === 'publish') {
              setNotice(
                editingListing
                  ? 'Listing updated successfully.'
                  : 'Listing submitted and queued for admin approval.'
              );
              setEditingListing(null);
              setTab('listings');
            }
          }}
          onCancel={() => {
            setEditingListing(null);
            setTab('listings');
          }}
        />
      )}
    </div>
  );
};
