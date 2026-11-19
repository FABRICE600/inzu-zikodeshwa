import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LanguageProvider } from './context/LanguageContext.tsx';
import { AppRoute, Navbar } from './components/Navbar.tsx';
import { HomeSearchPage, SearchFiltersState } from './pages/HomeSearchPage.tsx';
import { ListingDetailPage } from './pages/ListingDetailPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LandlordDashboard } from './pages/LandlordDashboard.tsx';
import { TenantPortal } from './pages/TenantPortal.tsx';
import { AdminPanel } from './pages/AdminPanel.tsx';

function parseHashRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash.startsWith('listing/')) {
    const id = Number(hash.slice('listing/'.length));
    if (Number.isInteger(id) && id > 0) return { name: 'listing', id };
  }
  if (hash === 'auth') return { name: 'auth' };
  if (hash === 'profile') return { name: 'profile' };
  if (hash === 'saved') return { name: 'saved' };
  if (hash === 'landlord') return { name: 'landlord' };
  if (hash === 'admin') return { name: 'admin' };
  return { name: 'home' };
}

function AppShell() {
  const { user, loading } = useAuth();
  const [route, setRoute] = useState<AppRoute>(() => parseHashRoute());
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<number[]>([]);
  const [savedSearchFilters, setSavedSearchFilters] = useState<Partial<SearchFiltersState> | null>(
    null
  );

  const navigate = useCallback((next: AppRoute) => {
    setRoute(next);
    if (next.name === 'listing') {
      window.location.hash = `listing/${next.id}`;
      setRecentlyViewedIds((prev) => [next.id, ...prev.filter((id) => id !== next.id)].slice(0, 6));
    } else if (next.name === 'home') {
      window.location.hash = '';
    } else {
      window.location.hash = next.name;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(parseHashRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const openListing = (id: number) => navigate({ name: 'listing', id });

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAFA]">
      <Navbar route={route} navigate={navigate} />

      <div className="flex-1">
        {loading ? (
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="h-64 bg-zinc-200 rounded-xl animate-pulse" />
          </div>
        ) : route.name === 'home' ? (
          <HomeSearchPage
            onSelectListing={openListing}
            onRequireAuth={() => navigate({ name: 'auth' })}
            initialFilters={savedSearchFilters}
            recentlyViewedIds={recentlyViewedIds}
          />
        ) : route.name === 'listing' ? (
          <ListingDetailPage
            listingId={route.id}
            onBack={() => navigate({ name: 'home' })}
            onSelectListing={openListing}
            onRequireAuth={() => navigate({ name: 'auth' })}
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
                setSavedSearchFilters(f);
                navigate({ name: 'home' });
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
            <AdminPanel onSelectListing={openListing} />
          ) : (
            <AuthPage onSuccess={() => navigate({ name: 'admin' })} />
          )
        ) : null}
      </div>

      <footer className="border-t border-zinc-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <div>
            <span className="font-semibold text-zinc-800">InzuFinder</span> — Rental Finder Platform for Rwanda (RWF)
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => navigate({ name: 'home' })}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Browse Rentals
            </button>
            <button
              type="button"
              onClick={() => navigate(user ? { name: 'landlord' } : { name: 'auth' })}
              className="hover:text-zinc-900 cursor-pointer"
            >
              List Your Property
            </button>
            <button
              type="button"
              onClick={() => navigate(user ? { name: 'profile' } : { name: 'auth' })}
              className="hover:text-zinc-900 cursor-pointer"
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
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  );
}
