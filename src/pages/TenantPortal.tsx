import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Search, Trash2, TrendingDown } from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { ListingCard } from '../components/ListingCard.tsx';
import { VirtualTourModal } from '../components/VirtualTourModal.tsx';
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
  const [tab, setTab] = useState<'favorites' | 'alerts' | 'searches' | 'viewings'>('favorites');
  const [favorites, setFavorites] = useState<ListingItem[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  const [droppedCount, setDroppedCount] = useState(0);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [viewings, setViewings] = useState<any[]>([]);
  const [tourListing, setTourListing] = useState<ListingItem | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [favRes, alertRes, searchRes, viewRes] = await Promise.all([
        apiRequest<{ items: ListingItem[] }>('/api/tenant/favorites', { token }),
        apiRequest<{ items: any[]; droppedCount: number }>('/api/tenant/price-alerts', { token }),
        apiRequest<{ items: any[] }>('/api/tenant/saved-searches', { token }),
        apiRequest<{ items: any[] }>('/api/tenant/viewings', { token }),
      ]);
      setFavorites(favRes.items);
      setPriceAlerts(alertRes.items);
      setDroppedCount(alertRes.droppedCount || 0);
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

  const handleRemovePriceAlert = async (listingId: number) => {
    if (!token) return;
    await apiRequest(`/api/tenant/price-alerts/${listingId}`, { method: 'POST', token });
    setPriceAlerts((prev) => prev.filter((a) => a.listingId !== listingId));
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Saved & Activity</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your favorite rentals, price drop alerts, saved search alerts, and viewing requests.
          </p>
        </div>

        <div className="inline-flex flex-wrap bg-stone-100 dark:bg-zinc-800 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setTab('favorites')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
              tab === 'favorites'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Favorites ({favorites.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('alerts')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer inline-flex items-center gap-1.5 ${
              tab === 'alerts'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Price Alerts ({priceAlerts.length})
            {droppedCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-[#0A4D38] text-white rounded">
                {droppedCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab('searches')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
              tab === 'searches'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Saved Searches ({savedSearches.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('viewings')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer ${
              tab === 'viewings'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
          >
            Viewings & Inquiries ({viewings.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-44 bg-stone-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ) : tab === 'favorites' ? (
        favorites.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
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
                onOpenTour={(target) => setTourListing(target)}
                onSelect={onSelectListing}
              />
            ))}
          </div>
        )
      ) : tab === 'alerts' ? (
        priceAlerts.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No price drop alerts yet. Open any property and click &ldquo;Notify me of price drops&rdquo; to track rent changes.
          </div>
        ) : (
          <div className="space-y-3">
            {priceAlerts.map((a) => (
              <div
                key={a.id}
                className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <img
                    src={
                      a.listing?.coverPhoto ||
                      '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg'
                    }
                    alt={a.listing?.title || 'Listing'}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 bg-stone-100 dark:bg-zinc-800"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectListing(a.listingId)}
                        className="text-base font-bold text-zinc-900 dark:text-white hover:text-[#0A4D38] dark:hover:text-emerald-400 text-left truncate cursor-pointer"
                      >
                        {a.listing?.title}
                      </button>
                      {a.hasDropped && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A4D38] dark:text-emerald-300">
                          <TrendingDown className="w-3.5 h-3.5" /> Price Dropped -{formatRwf(a.savingsRwf)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
                      {a.listing?.sector}, {a.listing?.district} · Current:{' '}
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {formatRwf(a.listing?.priceRwf || 0)}
                      </span>{' '}
                      · Watched at {formatRwf(a.subscribedPriceRwf)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectListing(a.listingId)}
                    className="px-3.5 py-2 text-xs font-semibold bg-zinc-900 dark:bg-[#0A4D38] text-white rounded-lg cursor-pointer"
                  >
                    View Property
                  </button>
                  <button
                    type="button"
                    aria-label="Remove price alert"
                    onClick={() => handleRemovePriceAlert(a.listingId)}
                    className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 border border-stone-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'searches' ? (
        savedSearches.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No saved searches yet. Apply filters on the Browse page and click Save Search to get match alerts.
          </div>
        ) : (
          <div className="space-y-3">
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">{s.name}</h3>
                    {s.newMatchesCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0A4D38] dark:text-emerald-400">
                        <Bell className="w-3.5 h-3.5" /> {s.newMatchesCount} new match
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono">
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-zinc-900 dark:bg-[#0A4D38] text-white rounded-lg cursor-pointer"
                  >
                    <Search className="w-3.5 h-3.5" /> View Matches
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSearch(s.id)}
                    className="p-2 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 border border-stone-200 dark:border-zinc-700 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : viewings.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          You have not sent any viewing requests or landlord inquiries yet.
        </div>
      ) : (
        <div className="space-y-3">
          {viewings.map((v) => (
            <div
              key={v.id}
              onClick={() => v.listing && onSelectListing(v.listing.id)}
              className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5 cursor-pointer hover:border-stone-300 dark:hover:border-zinc-700"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                <span>
                  {v.requestType === 'viewing' ? 'Viewing Request' : 'Direct Message'}
                  {v.preferredDate ? ` · ${v.preferredDate} ${v.preferredTime || ''}` : ''}
                </span>
                <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-200">{v.status}</span>
              </div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                {v.listing?.title || `Listing #${v.listingId}`}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 mt-1">{v.message}</p>
            </div>
          ))}
        </div>
      )}

      {tourListing && (
        <VirtualTourModal
          listing={tourListing}
          onClose={() => setTourListing(null)}
          onOpenListing={onSelectListing}
        />
      )}
    </div>
  );
};
