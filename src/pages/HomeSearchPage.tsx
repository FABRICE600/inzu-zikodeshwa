import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  Map as MapIcon,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import {
  AMENITIES_LIST,
  PROPERTY_TYPES,
  RWANDA_LANDMARKS,
  RWANDA_PROVINCES,
} from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Lang, useLanguage } from '../context/LanguageContext.tsx';
import { ListingCard } from '../components/ListingCard.tsx';
import { LeafletMap } from '../components/LeafletMap.tsx';

export interface SearchFiltersState {
  q: string;
  province: string;
  district: string;
  sector: string;
  neighborhood: string;
  minPrice: string;
  maxPrice: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  furnished: string;
  amenities: string[];
  landmarkId: string;
  maxDistanceKm: string;
  sort: 'newest' | 'cheapest' | 'expensive' | 'nearest';
}

export const DEFAULT_FILTERS: SearchFiltersState = {
  q: '',
  province: '',
  district: '',
  sector: '',
  neighborhood: '',
  minPrice: '',
  maxPrice: '',
  propertyType: '',
  bedrooms: '',
  bathrooms: '',
  furnished: '',
  amenities: [],
  landmarkId: '',
  maxDistanceKm: '',
  sort: 'newest',
};

interface HomeSearchPageProps {
  onSelectListing: (id: number) => void;
  onRequireAuth: () => void;
  initialFilters?: Partial<SearchFiltersState> | null;
  recentlyViewedIds: number[];
}

export const HomeSearchPage: React.FC<HomeSearchPageProps> = ({
  onSelectListing,
  onRequireAuth,
  initialFilters,
  recentlyViewedIds,
}) => {
  const { user, token } = useAuth();
  const { lang, setLang, t } = useLanguage();

  const [filters, setFilters] = useState<SearchFiltersState>({
    ...DEFAULT_FILTERS,
    ...(initialFilters || {}),
  });
  const [appliedFilters, setAppliedFilters] = useState<SearchFiltersState>({
    ...DEFAULT_FILTERS,
    ...(initialFilters || {}),
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'map'>('grid');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);

  const [listings, setListings] = useState<ListingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<ListingItem[]>([]);

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNotice, setSaveNotice] = useState('');

  useEffect(() => {
    if (initialFilters) {
      const merged = { ...DEFAULT_FILTERS, ...initialFilters };
      setFilters(merged);
      setAppliedFilters(merged);
      setPage(1);
    }
  }, [initialFilters]);

  const allDistricts = useMemo(() => {
    if (filters.province && RWANDA_PROVINCES[filters.province]) {
      return Object.keys(RWANDA_PROVINCES[filters.province]);
    }
    return Object.values(RWANDA_PROVINCES).flatMap((d) => Object.keys(d));
  }, [filters.province]);

  const availableSectors = useMemo(() => {
    if (!filters.district) return [];
    for (const districtsMap of Object.values(RWANDA_PROVINCES)) {
      if (districtsMap[filters.district]) return districtsMap[filters.district];
    }
    return [];
  }, [filters.district]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (appliedFilters.q) params.set('q', appliedFilters.q);
      if (appliedFilters.province) params.set('province', appliedFilters.province);
      if (appliedFilters.district) params.set('district', appliedFilters.district);
      if (appliedFilters.sector) params.set('sector', appliedFilters.sector);
      if (appliedFilters.neighborhood) params.set('neighborhood', appliedFilters.neighborhood);
      if (appliedFilters.minPrice) params.set('minPrice', appliedFilters.minPrice);
      if (appliedFilters.maxPrice) params.set('maxPrice', appliedFilters.maxPrice);
      if (appliedFilters.propertyType) params.set('propertyType', appliedFilters.propertyType);
      if (appliedFilters.bedrooms) params.set('bedrooms', appliedFilters.bedrooms);
      if (appliedFilters.bathrooms) params.set('bathrooms', appliedFilters.bathrooms);
      if (appliedFilters.furnished) params.set('furnished', appliedFilters.furnished);
      if (appliedFilters.amenities.length > 0) {
        params.set('amenities', appliedFilters.amenities.join(','));
      }
      if (appliedFilters.landmarkId) params.set('landmarkId', appliedFilters.landmarkId);
      if (appliedFilters.maxDistanceKm) params.set('maxDistanceKm', appliedFilters.maxDistanceKm);
      params.set('sort', appliedFilters.sort);
      params.set('page', String(page));
      params.set('limit', viewMode === 'map' ? '40' : '9');

      const data = await apiRequest<{
        items: ListingItem[];
        total: number;
        totalPages: number;
      }>(`/api/listings?${params.toString()}`);

      setListings(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message || 'Could not load rentals.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, page, viewMode]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    if (!token) {
      setFavoriteIds([]);
      return;
    }
    apiRequest<{ ids: number[] }>('/api/tenant/favorites', { token })
      .then((res) => setFavoriteIds(res.ids))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (recentlyViewedIds.length === 0) {
      setRecentlyViewed([]);
      return;
    }
    Promise.all(
      recentlyViewedIds.slice(0, 3).map((id) =>
        apiRequest<{ listing: ListingItem }>(`/api/listings/${id}`)
          .then((r) => r.listing)
          .catch(() => null)
      )
    ).then((items) => setRecentlyViewed(items.filter((x): x is ListingItem => Boolean(x))));
  }, [recentlyViewedIds]);

  const handleApplyFilters = (e?: React.FormEvent) => {
    e?.preventDefault();
    setPage(1);
    setAppliedFilters(filters);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const toggleAmenity = (amenity: string) => {
    setFilters((prev) => {
      const exists = prev.amenities.includes(amenity);
      return {
        ...prev,
        amenities: exists ? prev.amenities.filter((a) => a !== amenity) : [...prev.amenities, amenity],
      };
    });
  };

  const handleToggleFavorite = async (listingId: number) => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    try {
      const res = await apiRequest<{ favorited: boolean }>(`/api/tenant/favorites/${listingId}`, {
        method: 'POST',
        token,
      });
      setFavoriteIds((prev) =>
        res.favorited ? [...prev, listingId] : prev.filter((id) => id !== listingId)
      );
    } catch {
      // ignore
    }
  };

  const handleSaveSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    if (!saveName.trim()) return;
    try {
      await apiRequest('/api/tenant/saved-searches', {
        method: 'POST',
        token,
        body: JSON.stringify({
          name: saveName.trim(),
          filters: {
            ...appliedFilters,
            minPrice: appliedFilters.minPrice ? Number(appliedFilters.minPrice) : undefined,
            maxPrice: appliedFilters.maxPrice ? Number(appliedFilters.maxPrice) : undefined,
            bedrooms: appliedFilters.bedrooms ? Number(appliedFilters.bedrooms) : undefined,
          },
          notifyEnabled: true,
        }),
      });
      setSaveNotice('Search saved. New matching listings will notify you in your Saved tab.');
      setSaveName('');
      setTimeout(() => {
        setSaveModalOpen(false);
        setSaveNotice('');
      }, 1500);
    } catch (err: any) {
      setSaveNotice(err.message || 'Could not save search.');
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-zinc-900 text-white">
        <img
          src="/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg"
          alt="Kigali residential hills and modern apartments"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/85 via-zinc-950/50 to-zinc-950/40" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <p className="text-xs font-medium tracking-wide text-zinc-200">
              Kigali · Huye · Musanze · Rubavu · All Rwanda
            </p>
            {/* Language Switcher */}
            <div className="inline-flex items-center bg-zinc-950/70 border border-white/15 rounded-lg p-1">
              {(['en', 'rw', 'fr'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    lang === code ? 'bg-white text-zinc-900' : 'text-zinc-200 hover:text-white'
                  }`}
                >
                  {code === 'en' ? 'English' : code === 'rw' ? 'Kinyarwanda' : 'Français'}
                </button>
              ))}
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-2xl [text-wrap:balance] leading-tight">
            {t('heroTitle')}
          </h1>
          <p className="mt-3 text-base text-zinc-200 max-w-xl leading-relaxed">
            {t('heroSubtitle')}
          </p>

          {/* Primary Search Strip */}
          <form
            onSubmit={handleApplyFilters}
            className="mt-8 bg-white text-zinc-900 p-2 rounded-xl shadow-lg grid grid-cols-1 md:grid-cols-12 gap-2"
          >
            <div className="md:col-span-5 flex items-center gap-2 px-3 py-2 border border-zinc-200 rounded-lg bg-zinc-50/70">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder={t('searchPlaceholder')}
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
              />
            </div>

            <select
              value={filters.district}
              onChange={(e) =>
                setFilters({ ...filters, district: e.target.value, sector: '' })
              }
              className="md:col-span-3 px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white outline-none focus:border-[#0D5C43]"
            >
              <option value="">{t('allDistricts')}</option>
              {allDistricts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <input
              type="number"
              min={0}
              step={10000}
              value={filters.maxPrice}
              onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
              placeholder={t('anyPrice')}
              className="md:col-span-2 px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white outline-none focus:border-[#0D5C43] font-mono tabular-nums"
            />

            <button
              type="submit"
              className="md:col-span-2 px-5 py-2.5 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              {t('searchBtn')}
            </button>
          </form>
        </div>
      </section>

      {/* Main Content & Filter Controls */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Toolbar row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                showAdvanced
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {t('filters')}
            </button>

            <button
              type="button"
              onClick={() => {
                if (!user) {
                  onRequireAuth();
                } else {
                  setSaveModalOpen(true);
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookmarkPlus className="w-4 h-4" />
              {t('saveSearch')}
            </button>

            <span className="text-sm text-zinc-500 ml-2 font-mono tabular-nums">
              {total} {total === 1 ? 'property' : 'properties'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={appliedFilters.sort}
              onChange={(e) => {
                const nextSort = e.target.value as SearchFiltersState['sort'];
                setFilters((f) => ({ ...f, sort: nextSort }));
                setAppliedFilters((f) => ({ ...f, sort: nextSort }));
              }}
              className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white text-zinc-700 outline-none"
            >
              <option value="newest">{t('sortNewest')}</option>
              <option value="cheapest">{t('sortCheapest')}</option>
              <option value="expensive">{t('sortExpensive')}</option>
              {filters.landmarkId && <option value="nearest">{t('sortNearest')}</option>}
            </select>

            <div className="inline-flex items-center bg-zinc-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {t('gridView')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                {t('listView')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'map' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t('mapView')}
              </button>
            </div>
          </div>
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvanced && (
          <form
            onSubmit={handleApplyFilters}
            className="mt-5 p-5 bg-white border border-zinc-200 rounded-xl space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Province</label>
                <select
                  value={filters.province}
                  onChange={(e) =>
                    setFilters({ ...filters, province: e.target.value, district: '', sector: '' })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="">All Provinces</option>
                  {Object.keys(RWANDA_PROVINCES).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Sector</label>
                <select
                  value={filters.sector}
                  onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                  disabled={!filters.district}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white disabled:bg-zinc-100"
                >
                  <option value="">All Sectors</option>
                  {availableSectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Neighborhood / Cell
                </label>
                <input
                  type="text"
                  value={filters.neighborhood}
                  onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                  placeholder="e.g. Rugando, Kisimenti"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Property Type
                </label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="">{t('allTypes')}</option>
                  {PROPERTY_TYPES.map((pt) => (
                    <option key={pt} value={pt}>
                      {t(`type_${pt}`)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Min Price (RWF)
                </label>
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Min {t('bedrooms')}
                </label>
                <select
                  value={filters.bedrooms}
                  onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="">{t('any')}</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Min {t('bathrooms')}
                </label>
                <select
                  value={filters.bathrooms}
                  onChange={(e) => setFilters({ ...filters, bathrooms: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="">{t('any')}</option>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}+
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Furnishing</label>
                <select
                  value={filters.furnished}
                  onChange={(e) => setFilters({ ...filters, furnished: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="">{t('any')}</option>
                  <option value="true">{t('furnished')}</option>
                  <option value="false">{t('unfurnished')}</option>
                </select>
              </div>
            </div>

            {/* Distance from University or Landmark */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  {t('nearLandmark')}
                </label>
                <select
                  value={filters.landmarkId}
                  onChange={(e) =>
                    setFilters({
                      ...filters,
                      landmarkId: e.target.value,
                      sort: e.target.value ? 'nearest' : filters.sort,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option value="">Select university or landmark...</option>
                  {RWANDA_LANDMARKS.map((lm) => (
                    <option key={lm.id} value={lm.id}>
                      {lm.name} ({lm.district})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Max Distance (km)
                </label>
                <select
                  value={filters.maxDistanceKm}
                  onChange={(e) => setFilters({ ...filters, maxDistanceKm: e.target.value })}
                  disabled={!filters.landmarkId}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white disabled:bg-zinc-100"
                >
                  <option value="">Any distance</option>
                  <option value="1">Within 1 km</option>
                  <option value="2">Within 2 km</option>
                  <option value="5">Within 5 km</option>
                  <option value="10">Within 10 km</option>
                </select>
              </div>
            </div>

            {/* Amenities */}
            <div className="pt-3 border-t border-zinc-100">
              <div className="text-xs font-medium text-zinc-600 mb-2">{t('amenities')}</div>
              <div className="flex flex-wrap gap-2">
                {AMENITIES_LIST.map((amenity) => {
                  const active = filters.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() => toggleAmenity(amenity)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#0D5C43] text-white border-[#0D5C43]'
                          : 'bg-zinc-50 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {t(`amenity_${amenity}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 cursor-pointer"
              >
                {t('clearFilters')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold bg-[#0D5C43] hover:bg-[#094431] text-white rounded-lg cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </form>
        )}

        {/* Listings Viewport */}
        <div className="mt-6">
          {error && (
            <div className="p-4 mb-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white border border-zinc-200 rounded-xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-zinc-200" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-zinc-200 rounded w-1/2" />
                    <div className="h-5 bg-zinc-200 rounded w-4/5" />
                    <div className="h-4 bg-zinc-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="py-16 text-center bg-white border border-zinc-200 rounded-xl">
              <p className="text-base font-semibold text-zinc-800">{t('noResults')}</p>
              <p className="text-sm text-zinc-500 mt-1">
                Try adjusting your price range, district, or amenities filter.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 cursor-pointer"
              >
                {t('clearFilters')}
              </button>
            </div>
          ) : viewMode === 'map' ? (
            <div className="space-y-4">
              <LeafletMap
                mode="browse"
                listings={listings}
                onSelectListing={onSelectListing}
                className="h-[520px] w-full rounded-xl border border-zinc-200 overflow-hidden"
              />
              <p className="text-xs text-zinc-500">
                Click any price marker on the map to inspect the property and open full details.
              </p>
            </div>
          ) : (
            <div
              className={
                viewMode === 'list'
                  ? 'space-y-4'
                  : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              }
            >
              {listings.map((item) => (
                <ListingCard
                  key={item.id}
                  listing={item}
                  layout={viewMode}
                  isFavorited={favoriteIds.includes(item.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onSelect={onSelectListing}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {viewMode !== 'map' && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-sm font-medium border border-zinc-200 rounded-lg bg-white text-zinc-700 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-zinc-600 font-mono tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-sm font-medium border border-zinc-200 rounded-lg bg-white text-zinc-700 disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Recently Viewed Listings */}
        {recentlyViewed.length > 0 && (
          <section className="mt-14 pt-8 border-t border-zinc-200">
            <h2 className="text-xl font-bold text-zinc-900 mb-5">{t('recentlyViewed')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentlyViewed.map((item) => (
                <ListingCard
                  key={`recent-${item.id}`}
                  listing={item}
                  isFavorited={favoriteIds.includes(item.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onSelect={onSelectListing}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Save Search Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-zinc-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">{t('saveSearch')}</h3>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Alert Name
                </label>
                <input
                  type="text"
                  required
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. 2-Bed in Kimihurura under 400k RWF"
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg"
                />
              </div>
              {saveNotice && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  {saveNotice}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="px-4 py-2 text-sm text-zinc-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-[#0D5C43] text-white rounded-lg cursor-pointer"
                >
                  Save & Notify Me
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
