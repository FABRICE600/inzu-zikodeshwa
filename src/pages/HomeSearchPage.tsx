import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Building2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  GraduationCap,
  Home,
  LayoutGrid,
  List,
  Map as MapIcon,
  MapPin,
  Scale,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import {
  RecentSearchEntry,
  clearRecentSearches,
  hasActiveSearchCriteria,
  loadRecentSearches,
  removeRecentSearch,
  saveRecentSearch,
} from '../lib/recentSearches.ts';
import {
  AMENITIES_LIST,
  formatRwf,
  PROPERTY_TYPES,
  RWANDA_LANDMARKS,
  RWANDA_PROVINCES,
} from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Lang, useLanguage } from '../context/LanguageContext.tsx';
import { ListingCard } from '../components/ListingCard.tsx';
import { LeafletMap } from '../components/LeafletMap.tsx';
import { CompareModal } from '../components/CompareModal.tsx';
import { VirtualTourModal } from '../components/VirtualTourModal.tsx';

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

  const [comparedListings, setComparedListings] = useState<ListingItem[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareNotice, setCompareNotice] = useState('');
  const [tourListing, setTourListing] = useState<ListingItem | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearchEntry[]>(() =>
    loadRecentSearches()
  );

  useEffect(() => {
    const merged = { ...DEFAULT_FILTERS, ...(initialFilters || {}) };
    setFilters(merged);
    setAppliedFilters(merged);
    setPage(1);
  }, [initialFilters]);

  useEffect(() => {
    if (hasActiveSearchCriteria(appliedFilters)) {
      setRecentSearches(saveRecentSearch(appliedFilters));
    }
  }, [appliedFilters]);

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
      params.set('limit', viewMode === 'map' ? '50' : '9');

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

  const handleApplyRecentSearch = (entry: RecentSearchEntry) => {
    const next: SearchFiltersState = {
      ...DEFAULT_FILTERS,
      ...entry.filters,
      amenities: [...(entry.filters.amenities || [])],
    };
    setFilters(next);
    setAppliedFilters(next);
    setPage(1);
    document.getElementById('listings-viewport')?.scrollIntoView({ behavior: 'smooth' });
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

  const handleToggleCompare = (listing: ListingItem) => {
    setCompareNotice('');
    setComparedListings((prev) => {
      const exists = prev.some((item) => item.id === listing.id);
      if (exists) {
        return prev.filter((item) => item.id !== listing.id);
      }
      if (prev.length >= 3) {
        setCompareNotice('You can compare up to 3 properties at once. Remove one to add another.');
        setTimeout(() => setCompareNotice(''), 3000);
        return prev;
      }
      return [...prev, listing];
    });
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
      <section className="relative overflow-hidden bg-zinc-950 text-white border-b border-zinc-800/70">
        <img
          src="/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg"
          alt="Kigali residential hills and modern apartments"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/55 to-[#0A4D38]/35" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <p className="text-xs font-semibold tracking-wide text-emerald-200/95">
              Kigali · Huye · Musanze · Rubavu · All Rwanda
            </p>
            {/* Language Switcher */}
            <div className="inline-flex items-center bg-zinc-950/75 border border-white/15 rounded-xl p-1 backdrop-blur-sm">
              {(['en', 'rw', 'fr'] as Lang[]).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    lang === code ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-200 hover:text-white'
                  }`}
                >
                  {code === 'en' ? 'English' : code === 'rw' ? 'Kinyarwanda' : 'Français'}
                </button>
              ))}
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-2xl [text-wrap:balance] leading-[1.12]">
            {t('heroTitle')}
          </h1>
          <p className="mt-3.5 text-base text-zinc-200/95 max-w-xl leading-relaxed">
            {t('heroSubtitle')}
          </p>

          {/* Primary Search Strip */}
          <form
            onSubmit={handleApplyFilters}
            className="mt-8 bg-white dark:bg-[#161b19] text-zinc-900 dark:text-zinc-100 p-2 rounded-2xl shadow-2xl border border-white/25 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-12 gap-2"
          >
            <div className="md:col-span-5 flex items-center gap-2 px-3 py-2 border border-stone-200 dark:border-zinc-700 rounded-xl bg-stone-50/80 dark:bg-zinc-900/80 focus-within:bg-white dark:focus-within:bg-zinc-900 focus-within:border-[#0A4D38]">
              <Search className="w-4 h-4 text-zinc-400 shrink-0" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder={t('searchPlaceholder')}
                className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400 dark:text-zinc-100"
              />
            </div>

            <select
              value={filters.district}
              onChange={(e) =>
                setFilters({ ...filters, district: e.target.value, sector: '' })
              }
              className="md:col-span-3 px-3 py-2.5 text-sm border border-stone-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:border-[#0A4D38]"
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
              className="md:col-span-2 px-3 py-2.5 text-sm border border-stone-200 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none focus:border-[#0A4D38] font-mono tabular-nums"
            />

            <button
              type="submit"
              className="md:col-span-2 px-5 py-2.5 bg-[#0A4D38] hover:bg-[#073828] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer whitespace-nowrap interactive-press shadow-sm"
            >
              {t('searchBtn')}
            </button>
          </form>

          {/* Hero Quick Explore Shortcuts */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode('map');
                document.getElementById('listings-viewport')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap interactive-press"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-300" /> Explore Density Map
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...DEFAULT_FILTERS, propertyType: 'house' };
                setFilters(next);
                setAppliedFilters(next);
                setPage(1);
                document.getElementById('listings-viewport')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap interactive-press"
            >
              <Home className="w-3.5 h-3.5" /> Browse All Houses
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...DEFAULT_FILTERS, propertyType: 'hostel' };
                setFilters(next);
                setAppliedFilters(next);
                setPage(1);
                document.getElementById('listings-viewport')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap interactive-press"
            >
              <GraduationCap className="w-3.5 h-3.5" /> Student Stays
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...DEFAULT_FILTERS, propertyType: 'commercial' };
                setFilters(next);
                setAppliedFilters(next);
                setPage(1);
                document.getElementById('listings-viewport')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white border border-white/20 rounded-xl backdrop-blur-sm transition-colors cursor-pointer whitespace-nowrap interactive-press"
            >
              <Building2 className="w-3.5 h-3.5" /> Ubucuruzi (Commercial)
            </button>
          </div>
        </div>
      </section>

      {/* Main Content & Filter Controls */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Toolbar row */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                showAdvanced
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                  : 'bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
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
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer whitespace-nowrap"
            >
              <BookmarkPlus className="w-4 h-4" />
              {t('saveSearch')}
            </button>

            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2 font-mono tabular-nums">
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
              className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 outline-none"
            >
              <option value="newest">{t('sortNewest')}</option>
              <option value="cheapest">{t('sortCheapest')}</option>
              <option value="expensive">{t('sortExpensive')}</option>
              {filters.landmarkId && <option value="nearest">{t('sortNearest')}</option>}
            </select>

            <div className="inline-flex items-center bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                {t('gridView')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                {t('listView')}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-300'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                {t('mapView')}
              </button>
            </div>
          </div>
        </div>

        {/* Interactive Property Type Strip */}
        <div className="mt-4 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" role="group" aria-label="Property type filter">
          <button
            type="button"
            onClick={() => {
              const next = { ...filters, propertyType: '' };
              setFilters(next);
              setAppliedFilters(next);
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 interactive-press ${
              !appliedFilters.propertyType
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-sm'
                : 'bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            All Types
          </button>
          {PROPERTY_TYPES.map((pt) => {
            const active = appliedFilters.propertyType === pt;
            return (
              <button
                key={pt}
                type="button"
                onClick={() => {
                  const next = { ...filters, propertyType: active ? '' : pt };
                  setFilters(next);
                  setAppliedFilters(next);
                  setPage(1);
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap shrink-0 interactive-press ${
                  active
                    ? 'bg-[#0A4D38] text-white border-[#0A4D38] shadow-sm'
                    : 'bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
              >
                {t(`type_${pt}`)}
              </button>
            );
          })}
        </div>

        {/* Interactive Rwanda Districts Quick Explorer (All 13 Districts) */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1" role="group" aria-label="Quick district selector">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1 whitespace-nowrap shrink-0 inline-flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[#0A4D38] dark:text-emerald-400" /> Districts:
          </span>
          <button
            type="button"
            onClick={() => {
              const next = { ...filters, province: '', district: '', sector: '' };
              setFilters(next);
              setAppliedFilters(next);
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 interactive-press ${
              !appliedFilters.district
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100'
                : 'bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
            }`}
          >
            All Rwanda
          </button>
          {Object.values(RWANDA_PROVINCES)
            .flatMap((d) => Object.keys(d))
            .map((d) => {
              const active = appliedFilters.district === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const next = {
                      ...filters,
                      province: '',
                      district: active ? '' : d,
                      sector: '',
                    };
                    setFilters(next);
                    setAppliedFilters(next);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap shrink-0 interactive-press ${
                    active
                      ? 'bg-[#0A4D38] text-white border-[#0A4D38]'
                      : 'bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {d}
                </button>
              );
            })}
        </div>

        {/* Quick Price Range Presets Strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Price range presets">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mr-1">Price (RWF):</span>
            {[
              { label: 'All', min: '', max: '' },
              { label: '< 50k', min: '', max: '50000' },
              { label: '50k – 100k', min: '50000', max: '100000' },
              { label: '100k – 250k', min: '100000', max: '250000' },
              { label: '250k – 600k', min: '250000', max: '600000' },
              { label: '600k+', min: '600000', max: '' },
            ].map((preset) => {
              const active =
                appliedFilters.minPrice === preset.min && appliedFilters.maxPrice === preset.max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    const next = { ...filters, minPrice: preset.min, maxPrice: preset.max };
                    setFilters(next);
                    setAppliedFilters(next);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer whitespace-nowrap font-mono tabular-nums interactive-press ${
                    active
                      ? 'bg-[#0A4D38] text-white border-[#0A4D38]'
                      : 'bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {(appliedFilters.q ||
            appliedFilters.district ||
            appliedFilters.sector ||
            appliedFilters.propertyType ||
            appliedFilters.minPrice ||
            appliedFilters.maxPrice ||
            appliedFilters.bedrooms ||
            appliedFilters.bathrooms ||
            appliedFilters.furnished ||
            appliedFilters.landmarkId ||
            appliedFilters.amenities.length > 0) && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" /> Reset All Filters
            </button>
          )}
        </div>

        {/* Collapsible Advanced Filters Panel */}
        {showAdvanced && (
          <form
            onSubmit={handleApplyFilters}
            className="mt-5 p-5 bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Province</label>
                <select
                  value={filters.province}
                  onChange={(e) =>
                    setFilters({ ...filters, province: e.target.value, district: '', sector: '' })
                  }
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Sector</label>
                <select
                  value={filters.sector}
                  onChange={(e) => setFilters({ ...filters, sector: e.target.value })}
                  disabled={!filters.district}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/60"
                >
                  <option value="">{filters.district ? 'All Sectors' : 'Select a district first'}</option>
                  {availableSectors.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Neighborhood / Cell
                </label>
                <input
                  type="text"
                  value={filters.neighborhood}
                  onChange={(e) => setFilters({ ...filters, neighborhood: e.target.value })}
                  placeholder="e.g. Rugando, Kisimenti"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Property Type
                </label>
                <select
                  value={filters.propertyType}
                  onChange={(e) => setFilters({ ...filters, propertyType: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
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
                <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>Min Price (RWF)</span>
                  <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                    {filters.minPrice ? `${Number(filters.minPrice).toLocaleString()} RWF` : '0 RWF'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1500000}
                  step={10000}
                  value={filters.minPrice ? Math.min(1500000, Number(filters.minPrice)) : 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilters({ ...filters, minPrice: val > 0 ? String(val) : '' });
                  }}
                  className="w-full accent-[#0A4D38] cursor-pointer mb-1.5"
                />
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono tabular-nums"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  <span>Max Price (RWF)</span>
                  <span className="font-mono tabular-nums text-zinc-900 dark:text-zinc-100">
                    {filters.maxPrice ? `${Number(filters.maxPrice).toLocaleString()} RWF` : 'No limit'}
                  </span>
                </div>
                <input
                  type="range"
                  min={50000}
                  max={2000000}
                  step={10000}
                  value={filters.maxPrice ? Math.min(2000000, Number(filters.maxPrice)) : 2000000}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFilters({ ...filters, maxPrice: val < 2000000 ? String(val) : '' });
                  }}
                  className="w-full accent-[#0A4D38] cursor-pointer mb-1.5"
                />
                <input
                  type="number"
                  min={0}
                  step={10000}
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  placeholder="No limit"
                  className="w-full px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Min {t('bedrooms')}
                </label>
                <select
                  value={filters.bedrooms}
                  onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Min {t('bathrooms')}
                </label>
                <select
                  value={filters.bathrooms}
                  onChange={(e) => setFilters({ ...filters, bathrooms: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Furnishing</label>
                <select
                  value={filters.furnished}
                  onChange={(e) => setFilters({ ...filters, furnished: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="">{t('any')}</option>
                  <option value="true">{t('furnished')}</option>
                  <option value="false">{t('unfurnished')}</option>
                </select>
              </div>
            </div>

            {/* Distance from University or Landmark */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
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
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
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
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Max Distance (km)
                </label>
                <select
                  value={filters.maxDistanceKm}
                  onChange={(e) => setFilters({ ...filters, maxDistanceKm: e.target.value })}
                  disabled={!filters.landmarkId}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:bg-zinc-100 dark:disabled:bg-zinc-800/60"
                >
                  <option value="">{filters.landmarkId ? 'Any distance' : 'Select a landmark first'}</option>
                  <option value="1">Within 1 km</option>
                  <option value="2">Within 2 km</option>
                  <option value="5">Within 5 km</option>
                  <option value="10">Within 10 km</option>
                </select>
              </div>
            </div>

            {/* Amenities */}
            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">{t('amenities')}</div>
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
                          ? 'bg-[#0A4D38] text-white border-[#0A4D38]'
                          : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800'
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
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                {t('clearFilters')}
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-semibold bg-[#0A4D38] hover:bg-[#094431] text-white rounded-lg cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </form>
        )}

        {/* Recent Searches Section */}
        {recentSearches.length > 0 && (
          <section
            aria-label="Recent searches"
            className="mt-5 p-4 bg-white dark:bg-[#161b19] border border-stone-200/90 dark:border-zinc-800 rounded-2xl shadow-xs"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Recent Searches
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRecentSearches(clearRecentSearches())}
                className="text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer whitespace-nowrap"
              >
                Clear all
              </button>
            </div>

            <div className="flex items-stretch gap-2.5 overflow-x-auto no-scrollbar pb-1">
              {recentSearches.map((entry) => (
                <div
                  key={entry.id}
                  className="group relative flex items-start gap-2.5 min-w-[210px] max-w-[260px] shrink-0 bg-stone-50 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-800 hover:border-[#0A4D38]/50 dark:hover:border-emerald-500/50 rounded-xl p-3 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyRecentSearch(entry)}
                    className="flex-1 min-w-0 text-left cursor-pointer"
                  >
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate pr-4">
                      {entry.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-[#0A4D38] dark:text-emerald-400 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{entry.locationLabel}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {entry.criteriaSummary}
                    </div>
                  </button>

                  <button
                    type="button"
                    aria-label={`Remove recent search ${entry.title}`}
                    onClick={() => setRecentSearches(removeRecentSearch(entry.id))}
                    className="p-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Listings Viewport */}
        <div id="listings-viewport" className="mt-6">
          {error && (
            <div className="p-4 mb-6 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-xl text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden animate-pulse"
                >
                  <div className="aspect-[4/3] bg-zinc-200 dark:bg-zinc-800" />
                  <div className="p-5 space-y-3">
                    <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2" />
                    <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-4/5" />
                    <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-2xl">
              <p className="text-base font-semibold text-zinc-800 dark:text-zinc-100">{t('noResults')}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Try adjusting your price range, district, or amenities filter.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 bg-zinc-900 dark:bg-zinc-100 rounded-lg hover:bg-zinc-800 dark:hover:bg-white cursor-pointer interactive-press"
              >
                {t('clearFilters')}
              </button>
            </div>
          ) : viewMode === 'map' ? (
            <div className="space-y-5">
              <LeafletMap
                mode="browse"
                listings={listings}
                onSelectListing={onSelectListing}
                className="h-[520px] w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden"
              />
              <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                <span>
                  Click any price marker or cluster on the map, or select a property card below.
                </span>
                <span className="font-mono tabular-nums font-medium text-zinc-700 dark:text-zinc-300">
                  Showing {listings.length} mapped rentals
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.slice(0, 6).map((item) => (
                  <button
                    key={`map-card-${item.id}`}
                    type="button"
                    onClick={() => onSelectListing(item.id)}
                    className="text-left bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 hover:border-[#0A4D38]/50 dark:hover:border-emerald-500/50 hover:shadow-md rounded-xl p-3.5 flex items-center gap-3 transition-all cursor-pointer interactive-press"
                  >
                    <img
                      src={item.coverPhoto || item.photos?.[0]?.url || '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg'}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover shrink-0 bg-zinc-100 dark:bg-zinc-800"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {item.sector}, {item.district}
                      </div>
                      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {item.title}
                      </div>
                      <div className="text-xs font-bold text-[#0A4D38] dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                        {formatRwf(item.priceRwf)} / mo
                      </div>
                    </div>
                  </button>
                ))}
              </div>
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
                  isCompared={comparedListings.some((c) => c.id === item.id)}
                  onToggleCompare={handleToggleCompare}
                  onOpenTour={(target) => setTourListing(target)}
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
                className="inline-flex items-center gap-1 px-3.5 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400 font-mono tabular-nums">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 px-3.5 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#161b19] text-zinc-700 dark:text-zinc-200 disabled:opacity-40 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Recently Viewed Listings */}
        {recentlyViewed.length > 0 && (
          <section className="mt-14 pt-8 border-t border-stone-200 dark:border-zinc-800">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-5">{t('recentlyViewed')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {recentlyViewed.map((item) => (
                <ListingCard
                  key={`recent-${item.id}`}
                  listing={item}
                  isFavorited={favoriteIds.includes(item.id)}
                  onToggleFavorite={handleToggleFavorite}
                  isCompared={comparedListings.some((c) => c.id === item.id)}
                  onToggleCompare={handleToggleCompare}
                  onOpenTour={(target) => setTourListing(target)}
                  onSelect={onSelectListing}
                />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Sticky Property Comparison Dock */}
      {comparedListings.length > 0 && (
        <div
          role="region"
          aria-label="Property comparison bar"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-4xl bg-zinc-900 text-white rounded-2xl shadow-2xl border border-zinc-700 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar min-w-0">
            <Scale className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="flex items-center gap-2">
              {comparedListings.map((item) => (
                <div
                  key={`dock-${item.id}`}
                  className="inline-flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg pl-1.5 pr-2 py-1 max-w-[170px] shrink-0"
                >
                  <img
                    src={
                      item.coverPhoto ||
                      item.photos?.[0]?.url ||
                      '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg'
                    }
                    alt={item.title}
                    className="w-7 h-7 rounded object-cover shrink-0"
                  />
                  <span className="text-xs font-medium truncate">{item.title}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title}`}
                    onClick={() =>
                      setComparedListings((prev) => prev.filter((p) => p.id !== item.id))
                    }
                    className="text-zinc-400 hover:text-white cursor-pointer shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {compareNotice && (
              <span className="text-[11px] text-amber-300 whitespace-nowrap">{compareNotice}</span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setComparedListings([])}
              className="px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white cursor-pointer whitespace-nowrap"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              className="px-4 py-2 text-xs font-semibold bg-[#0A4D38] hover:bg-[#0f7454] text-white rounded-lg cursor-pointer whitespace-nowrap interactive-press"
            >
              Compare ({comparedListings.length}/3)
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal */}
      {compareOpen && comparedListings.length > 0 && (
        <CompareModal
          listings={comparedListings}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => {
            setComparedListings((prev) => {
              const next = prev.filter((item) => item.id !== id);
              if (next.length === 0) setCompareOpen(false);
              return next;
            });
          }}
          onClearAll={() => {
            setComparedListings([]);
            setCompareOpen(false);
          }}
          onSelectListing={onSelectListing}
        />
      )}

      {/* Save Search Modal */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161b19] rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{t('saveSearch')}</h3>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Alert Name
                </label>
                <input
                  type="text"
                  required
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. 2-Bed in Kimihurura under 400k RWF"
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              {saveNotice && (
                <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                  {saveNotice}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-[#0A4D38] text-white rounded-lg cursor-pointer"
                >
                  Save & Notify Me
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 360° Interactive Virtual Tour Modal */}
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
