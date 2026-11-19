import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Search, Trash2 } from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ListingCard } from '../components/ListingCard.tsx';
import { SearchFiltersState } from './HomeSearchPage.tsx';

interface TenantPortalProps {
  onSelectListing: (id: number) => void;
  onRunSavedSearch: (filters: Partial<SearchFiltersState>) => void;
}

export const TenantPortal: React.FC<TenantPortalProps> = ({
  onSelectListing,
  onRunSavedSearch,
}) => {
  const { token } = useAuth();
  const [tab, setTab] = useState<'favorites' | 'searches' | 'viewings'>('favorites');
  const [favorites, setFavorites] = useState<ListingItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [viewings, setViewings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [favRes, searchRes, viewRes] = await Promise.all([
        apiRequest<{ items: ListingItem[] }>('/api/tenant/favorites', { token }),
        apiRequest<{ items: any[] }>('/api/tenant/saved-searches', { token }),
        apiRequest<{ items: any[] }>('/api/tenant/viewings', { token }),
      ]);
      setFavorites(favRes.items);
      setSavedSearches(searchRes.items);
      setViewings(viewRes.items);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleUnfavorite = async (listingId: number) => {
    if (!token) return;
    await apiRequest(`/api/tenant/favorites/${listingId}`, { method: 'POST', token });
    setFavorites((prev) => prev.filter((item) => item.id !== listingId));
  };

  const handleDeleteSearch = async (id: number) => {
    if (!token) return;
    await apiRequest(`/api/tenant/saved-searches/${id}`, { method: 'DELETE', token });
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Saved & Activity</h1>
          <p className="text-sm text-zinc-500">
            Your favorite rentals, saved search alerts, and viewing requests.
          </p>
        </div>

        <div className="inline-flex bg-zinc-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setTab('favorites')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'favorites' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
            }`}
          >
            Favorites ({favorites.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('searches')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'searches' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
            }`}
          >
            Saved Searches ({savedSearches.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('viewings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
              tab === 'viewings' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
            }`}
          >
            Viewings & Inquiries ({viewings.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-44 bg-zinc-200 rounded-xl animate-pulse" />
      ) : tab === 'favorites' ? (
        favorites.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-500">
            You have no saved favorite listings yet. Tap the heart icon on any property to save it here.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                isFavorited
                onToggleFavorite={handleUnfavorite}
                onSelect={onSelectListing}
              />
            ))}
          </div>
        )
      ) : tab === 'searches' ? (
        savedSearches.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-500">
            No saved searches yet. Apply filters on the Browse page and click Save Search to get match alerts.
          </div>
        ) : (
          <div className="space-y-3">
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900">{s.name}</h3>
                    {s.newMatchesCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D5C43]">
                        <Bell className="w-3.5 h-3.5" /> {s.newMatchesCount} new match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 font-mono">
                    {s.totalMatches} total matching properties ·{' '}
                    {s.filters?.district || 'All districts'}
                    {s.filters?.maxPrice ? ` · ≤ ${s.filters.maxPrice} RWF` : ''}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onRunSavedSearch({
                        q: s.filters?.q || '',
                        district: s.filters?.district || '',
                        sector: s.filters?.sector || '',
                        propertyType: s.filters?.propertyType || '',
                        minPrice: s.filters?.minPrice ? String(s.filters.minPrice) : '',
                        maxPrice: s.filters?.maxPrice ? String(s.filters.maxPrice) : '',
                        bedrooms: s.filters?.bedrooms ? String(s.filters.bedrooms) : '',
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" /> View Matches
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSearch(s.id)}
                    className="p-2 text-zinc-500 hover:text-rose-600 border border-zinc-200 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : viewings.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center text-sm text-zinc-500">
          You have not sent any viewing requests or landlord inquiries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {viewings.map((v) => (
            <div
              key={v.id}
              onClick={() => v.listing && onSelectListing(v.listing.id)}
              className="bg-white border border-zinc-200 rounded-xl p-5 cursor-pointer hover:border-zinc-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 mb-1">
                <span>
                  {v.requestType === 'viewing' ? 'Viewing Request' : 'Direct Message'}
                  {v.preferredDate ? ` · ${v.preferredDate} ${v.preferredTime || ''}` : ''}
                </span>
                <span className="font-semibold capitalize text-zinc-800">{v.status}</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900">
                {v.listing?.title || `Listing #${v.listingId}`}
              </h3>
              <p className="text-sm text-zinc-600 mt-1">{v.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
