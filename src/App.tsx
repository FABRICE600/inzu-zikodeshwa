import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { AppRoute, Navbar } from './components/Navbar.tsx';
import { HomeSearchPage, SearchFiltersState } from './pages/HomeSearchPage.tsx';
import { ListingDetailPage } from './pages/ListingDetailPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LandlordDashboard } from './pages/LandlordDashboard.tsx';
import { TenantPortal } from './pages/TenantPortal.tsx';
import { AdminPanel } from './pages/AdminPanel.tsx';
import { ListingItem } from './lib/api.ts';
import { formatRwf } from './lib/rwandaData.ts';

function parseSearchQueryString(qs: string): Partial<SearchFiltersState> | undefined {
  if (!qs) return undefined;
  const params = new URLSearchParams(qs);
  const next: Partial<SearchFiltersState> = {};
  const q = params.get('q');
  const district = params.get('district');
  const sector = params.get('sector');
  const propertyType = params.get('propertyType');
  const minPrice = params.get('minPrice');
  const maxPrice = params.get('maxPrice');
  const bedrooms = params.get('bedrooms');

  if (q !== null) next.q = q;
  if (district !== null) next.district = district;
  if (sector !== null) next.sector = sector;
  if (propertyType !== null) next.propertyType = propertyType;
  if (minPrice !== null) next.minPrice = minPrice;
  if (maxPrice !== null) next.maxPrice = maxPrice;
  if (bedrooms !== null) next.bedrooms = bedrooms;

  return Object.keys(next).length > 0 ? next : undefined;
}

function buildQueryString(filters: Partial<SearchFiltersState>): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.district) params.set('district', filters.district);
  if (filters.sector) params.set('sector', filters.sector);
  if (filters.propertyType) params.set('propertyType', filters.propertyType);
  if (filters.minPrice) params.set('minPrice', filters.minPrice);
  if (filters.maxPrice) params.set('maxPrice', filters.maxPrice);
  if (filters.bedrooms) params.set('bedrooms', filters.bedrooms);
  return params.toString();
}

function parseHashRoute(): AppRoute {
  const rawHash = window.location.hash.replace(/^#/, '');
  const [hashPath, hashQuery] = rawHash.split('?');

  if (hashPath.startsWith('listing/')) {
    const id = Number(hashPath.slice('listing/'.length));
    if (Number.isInteger(id) && id > 0) return { name: 'listing', id };
  }
  if (hashPath === 'auth') return { name: 'auth' };
  if (hashPath === 'profile') return { name: 'profile' };
  if (hashPath === 'saved') return { name: 'saved' };
  if (hashPath === 'landlord') return { name: 'landlord' };
  if (hashPath === 'admin') return { name: 'admin' };

  const query =
    parseSearchQueryString(hashQuery || '') ||
    parseSearchQueryString(window.location.search.replace(/^\?/, ''));
  return { name: 'home', query };
}

function setMetaTag(selector: string, content: string) {
  const el = document.querySelector<HTMLMetaElement>(selector);
  if (el) {
    el.setAttribute('content', content);
  }
}

function AppShell() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute());
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);
  const [searchFilters, setSearchFilters] = useState<Partial<SearchFiltersState> | null>(() => {
    const initial = parseHashRoute();
    return initial.name === 'home' && initial.query ? { ...initial.query } : null;
  });
  const [activeListingMeta, setActiveListingMeta] = useState<ListingItem | null>(null);

  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    if (next.name === 'listing') {
      setActiveListingMeta(null);
      window.location.hash = `listing/${next.id}`;
      setRecentlyViewedIds((prev) => [next.id, ...prev.filter((id) => id !== next.id)].slice(0, 6));
    } else if (next.name === 'home') {
      if (next.query) {
        setSearchFilters({ ...next.query });
        const qs = buildQueryString(next.query);
        window.location.hash = qs ? `?${qs}` : '';
      } else {
        setSearchFilters(null);
        window.location.hash = '';
      }
    } else {
      window.location.hash = next.name;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleNavbarSearch = useCallback(
    (params: { q: string; district: string }) => {
      const nextFilters: Partial<SearchFiltersState> = {
        q: params.q,
        district: params.district,
      };
      setSearchFilters({ ...nextFilters });
      navigate({ name: 'home', query: nextFilters });
    },
    [navigate]
  );

  useEffect(() => {
    const onHash = () => {
      const parsed = parseHashRoute();
      setRoute(parsed);
      if (parsed.name === 'home' && parsed.query) {
        setSearchFilters({ ...parsed.query });
      }
      if (parsed.name !== 'listing') {
        setActiveListingMeta(null);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Dynamically update document title and meta tags based on the active route
  useEffect(() => {
    let title = 'InzuFinder — Rwanda Rental Finder Platform';
    let description =
      'Browse houses, apartments, rooms, and student accommodation across Kigali and Rwanda in RWF.';

    if (route.name === 'home') {
      if (searchFilters?.q || searchFilters?.district) {
        const parts = [searchFilters.q, searchFilters.district].filter(Boolean).join(', ');
        title = `Search: ${parts} | InzuFinder`;
        description = `Rental properties matching ${parts} across Rwanda in RWF.`;
      } else {
        title = 'Browse Rentals | InzuFinder';
      }
    } else if (route.name === 'listing') {
      if (activeListingMeta && activeListingMeta.id === route.id) {
        title = `${activeListingMeta.title} — Listing | InzuFinder`;
        description = `${formatRwf(activeListingMeta.priceRwf)}/mo in ${activeListingMeta.sector}, ${activeListingMeta.district} — ${activeListingMeta.description.slice(0, 140)}`;
      } else {
        title = 'Listing | InzuFinder';
        description = 'View full rental property details, photos, amenities, and exact map location on InzuFinder.';
      }
    } else if (route.name === 'auth') {
      title = 'Sign In | InzuFinder';
      description = 'Sign in or create a Tenant or Landlord account on InzuFinder Rwanda.';
    } else if (route.name === 'profile') {
      title = 'Account & Profile | InzuFinder';
      description = 'Manage your InzuFinder profile, phone verification, and account settings.';
    } else if (route.name === 'saved') {
      title = 'Saved & Activity | InzuFinder';
      description = 'View your saved favorite rentals, search alerts, and viewing requests.';
    } else if (route.name === 'landlord') {
      title = 'Landlord Workspace | InzuFinder';
      description = 'Post and manage rental listings, photos, map pins, and viewing requests.';
    } else if (route.name === 'admin') {
      title = 'Admin Console | InzuFinder';
      description = 'Platform moderation, listing approvals, user management, and safety reports.';
    }

    document.title = title;
    setMetaTag('meta[name="description"]', description);
    setMetaTag('meta[property="og:title"]', title);
    setMetaTag('meta[property="og:description"]', description);
  }, [route, activeListingMeta, searchFilters]);

  const openListing = (id: number) => navigate({ name: 'listing', id });

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F5F3] dark:bg-[#0c0f0e] text-zinc-900 dark:text-zinc-100 transition-colors">
      <Navbar
        route={route}
        navigate={navigate}
        initialQuery={{ q: searchFilters?.q || '', district: searchFilters?.district || '' }}
        onSearch={handleNavbarSearch}
      />

      <div className="flex-1">
        {loading ? (
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="h-64 bg-stone-200 dark:bg-zinc-800 rounded-2xl animate-pulse" />
          </div>
        ) : route.name === 'home' ? (
          <HomeSearchPage
            onSelectListing={openListing}
            onRequireAuth={() => navigate({ name: 'auth' })}
            initialFilters={searchFilters}
            recentlyViewedIds={recentlyViewedIds}
          />
        ) : route.name === 'listing' ? (
          <ListingDetailPage
            listingId={route.id}
            onBack={() => navigate({ name: 'home' })}
            onSelectListing={openListing}
            onRequireAuth={() => navigate({ name: 'auth' })}
            onListingLoaded={setActiveListingMeta}
          />
        ) : route.name === 'auth' ? (
          <AuthPage onSuccess={() => navigate({ name: 'home' })} />
        ) : route.name === 'profile' ? (
          user ? (
            <ProfilePage onLoggedOut={() => navigate({ name: 'home' })} />
          ) : (
            <AuthPage onSuccess={() => navigate({ name: 'profile' })} />
          )
        ) : route.name === 'saved' ? (
          user ? (
            <TenantPortal
              onSelectListing={openListing}
              onRunSavedSearch={(f) => {
                setSearchFilters(f);
                navigate({ name: 'home', query: f });
              }}
            />
          ) : (
            <AuthPage onSuccess={() => navigate({ name: 'saved' })} />
          )
        ) : route.name === 'landlord' ? (
          user ? (
            <LandlordDashboard onSelectListing={openListing} />
          ) : (
            <AuthPage onSuccess={() => navigate({ name: 'landlord' })} />
          )
        ) : route.name === 'admin' ? (
          user ? (
            <AdminPanel
              onSelectListing={openListing}
              onBackToHome={() => navigate({ name: 'home' })}
              onSwitchAccount={() => navigate({ name: 'auth' })}
            />
          ) : (
            <AuthPage onSuccess={() => navigate({ name: 'admin' })} />
          )
        ) : null}
      </div>

      <footer className="border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">InzuFinder</span> — Rental Finder Platform for Rwanda (RWF)
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              Browse Rentals
            </button>
            <button
              type="button"
              onClick={() => navigate(user ? { name: 'landlord' } : { name: 'auth' })}
              className="hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              List Your Property
            </button>
            <button
              type="button"
              onClick={() => navigate(user ? { name: 'profile' } : { name: 'auth' })}
              className="hover:text-zinc-900 dark:hover:text-white cursor-pointer"
            >
              Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
