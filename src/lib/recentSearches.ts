import type { SearchFiltersState } from '../pages/HomeSearchPage.tsx';
import { RWANDA_LANDMARKS } from './rwandaData.ts';

export interface RecentSearchEntry {
  id: string;
  signature: string;
  title: string;
  locationLabel: string;
  criteriaSummary: string;
  filters: SearchFiltersState;
  savedAt: number;
}

const STORAGE_KEY = 'inzufinder_recent_searches_v1';
const MAX_RECENT_SEARCHES = 8;

const TYPE_LABELS: Record<string, string> = {
  house: 'House',
  apartment: 'Apartment',
  single_room: 'Single Room',
  shared_room: 'Shared Room',
  studio: 'Studio',
  hostel: 'Hostel',
  commercial: 'Ubucuruzi',
};

function formatShortRwf(val: string): string {
  const num = Number(val);
  if (Number.isNaN(num) || num <= 0) return val;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1).replace(/\.0$/, '')}M RWF`;
  if (num >= 1000) return `${Math.round(num / 1000)}k RWF`;
  return `${num} RWF`;
}

export function buildFilterSignature(filters: SearchFiltersState): string {
  return JSON.stringify({
    q: filters.q.trim().toLowerCase(),
    province: filters.province,
    district: filters.district,
    sector: filters.sector,
    neighborhood: filters.neighborhood.trim().toLowerCase(),
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    propertyType: filters.propertyType,
    bedrooms: filters.bedrooms,
    bathrooms: filters.bathrooms,
    furnished: filters.furnished,
    amenities: [...filters.amenities].sort(),
    landmarkId: filters.landmarkId,
    maxDistanceKm: filters.maxDistanceKm,
  });
}

export function hasActiveSearchCriteria(filters: SearchFiltersState): boolean {
  return Boolean(
    filters.q.trim() ||
      filters.province ||
      filters.district ||
      filters.sector ||
      filters.neighborhood.trim() ||
      filters.minPrice ||
      filters.maxPrice ||
      filters.propertyType ||
      filters.bedrooms ||
      filters.bathrooms ||
      filters.furnished ||
      filters.landmarkId ||
      filters.amenities.length > 0
  );
}

export function describeSearch(filters: SearchFiltersState): {
  title: string;
  locationLabel: string;
  criteriaSummary: string;
} {
  const locationParts = [filters.neighborhood.trim(), filters.sector, filters.district, filters.province].filter(
    Boolean
  );
  const landmark = filters.landmarkId
    ? RWANDA_LANDMARKS.find((l) => l.id === filters.landmarkId)
    : undefined;
  const locationLabel =
    locationParts.length > 0
      ? locationParts.slice(0, 2).join(', ')
      : landmark
      ? `Near ${landmark.name}`
      : 'All Rwanda';

  const criteria: string[] = [];
  if (filters.propertyType) {
    criteria.push(TYPE_LABELS[filters.propertyType] || filters.propertyType);
  }
  if (filters.bedrooms) criteria.push(`${filters.bedrooms}+ bed`);
  if (filters.bathrooms) criteria.push(`${filters.bathrooms}+ bath`);
  if (filters.minPrice && filters.maxPrice) {
    criteria.push(`${formatShortRwf(filters.minPrice)}–${formatShortRwf(filters.maxPrice)}`);
  } else if (filters.maxPrice) {
    criteria.push(`≤ ${formatShortRwf(filters.maxPrice)}`);
  } else if (filters.minPrice) {
    criteria.push(`${formatShortRwf(filters.minPrice)}+`);
  }
  if (filters.furnished === 'true') criteria.push('Furnished');
  if (filters.furnished === 'false') criteria.push('Unfurnished');
  if (filters.maxDistanceKm && landmark) criteria.push(`Within ${filters.maxDistanceKm} km`);
  if (filters.amenities.length > 0) {
    criteria.push(`${filters.amenities.length} amenities`);
  }

  const title = filters.q.trim()
    ? `"${filters.q.trim()}"`
    : criteria.length > 0
    ? criteria.slice(0, 2).join(' · ')
    : locationLabel;

  const criteriaSummary =
    criteria.length > 0 ? criteria.join(' · ') : filters.q.trim() ? 'Keyword search' : 'Location search';

  return { title, locationLabel, criteriaSummary };
}

export function loadRecentSearches(): RecentSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(filters: SearchFiltersState): RecentSearchEntry[] {
  const existing = loadRecentSearches();
  if (!hasActiveSearchCriteria(filters)) return existing;

  const signature = buildFilterSignature(filters);
  const { title, locationLabel, criteriaSummary } = describeSearch(filters);

  const entry: RecentSearchEntry = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    signature,
    title,
    locationLabel,
    criteriaSummary,
    filters: {
      ...filters,
      amenities: [...filters.amenities],
    },
    savedAt: Date.now(),
  };

  const next = [entry, ...existing.filter((item) => item.signature !== signature)].slice(
    0,
    MAX_RECENT_SEARCHES
  );

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function removeRecentSearch(id: string): RecentSearchEntry[] {
  const next = loadRecentSearches().filter((item) => item.id !== id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function clearRecentSearches(): RecentSearchEntry[] {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
  return [];
}
