import React, { useEffect, useMemo, useState } from 'react';
import { Menu, Moon, Search, Sun, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { useTheme } from '../context/ThemeContext.tsx';
import { RWANDA_PROVINCES } from '../lib/rwandaData.ts';

export type AppRoute =
  | { name: 'home'; query?: { q?: string; district?: string; sector?: string; propertyType?: string; maxPrice?: string; minPrice?: string; bedrooms?: string } }
  | { name: 'listing'; id: number }
  | { name: 'auth' }
  | { name: 'profile' }
  | { name: 'saved' }
  | { name: 'landlord'; editId?: number }
  | { name: 'admin' };

interface NavbarProps {
  route: AppRoute;
  navigate: (r: AppRoute) => void;
  initialQuery?: { q?: string; district?: string };
  onSearch: (params: { q: string; district: string }) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  route,
  navigate,
  initialQuery,
  onSearch,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queryText, setQueryText] = useState(initialQuery?.q || '');
  const [district, setDistrict] = useState(initialQuery?.district || '');

  useEffect(() => {
    setQueryText(initialQuery?.q || '');
    setDistrict(initialQuery?.district || '');
  }, [initialQuery?.q, initialQuery?.district]);

  const allDistricts = useMemo(
    () => Object.values(RWANDA_PROVINCES).flatMap((d) => Object.keys(d)),
    []
  );

  const linkClass = (active: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 cursor-pointer ${
      active
        ? 'text-zinc-900 dark:text-white border-[#0A4D38] dark:border-emerald-400'
        : 'text-zinc-600 dark:text-zinc-300 border-transparent hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-600'
    }`;

  const go = (r: AppRoute) => {
    setMobileOpen(false);
    navigate(r);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMobileOpen(false);
    onSearch({ q: queryText.trim(), district });
  };

  const handleClearQuery = () => {
    setQueryText('');
    onSearch({ q: '', district });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-stone-200/90 dark:border-zinc-800 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 lg:gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => go({ name: 'home' })}
          className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white font-display whitespace-nowrap shrink-0 cursor-pointer hover:text-[#0A4D38] dark:hover:text-emerald-400 transition-colors rounded"
        >
          InzuFinder
        </button>

        {/* Persistent Search Bar (Desktop & Tablet) */}
        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Search rentals"
          className="hidden sm:flex flex-1 max-w-md items-center bg-stone-50 dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700 rounded-xl focus-within:border-[#0A4D38] dark:focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-zinc-800 focus-within:ring-2 focus-within:ring-[#0A4D38]/15 transition-all overflow-hidden"
        >
          <Search className="w-4 h-4 text-zinc-400 ml-3 shrink-0" />
          <input
            type="search"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label="Search keyword"
            className="w-full min-w-0 px-2.5 py-2 text-sm bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none"
          />
          {queryText && (
            <button
              type="button"
              onClick={handleClearQuery}
              aria-label="Clear search text"
              className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            aria-label="Filter by district"
            className="hidden lg:block max-w-[130px] px-2.5 py-2 text-xs font-medium text-zinc-700 dark:text-zinc-200 bg-transparent dark:bg-zinc-800 border-l border-stone-200 dark:border-zinc-700 outline-none cursor-pointer hover:text-zinc-900 dark:hover:text-white"
          >
            <option value="">{t('allDistricts')}</option>
            {allDistricts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-semibold bg-zinc-900 dark:bg-[#0A4D38] hover:bg-[#0A4D38] dark:hover:bg-[#0d664a] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer interactive-press"
          >
            {t('searchBtn')}
          </button>
        </form>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 shrink-0">
          <button
            type="button"
            onClick={() => go({ name: 'home' })}
            className={linkClass(route.name === 'home' || route.name === 'listing')}
          >
            {t('browse')}
          </button>
          <button
            type="button"
            onClick={() => go(user ? { name: 'saved' } : { name: 'auth' })}
            className={linkClass(route.name === 'saved')}
          >
            {t('saved')}
          </button>
          <button
            type="button"
            onClick={() => go(user ? { name: 'landlord' } : { name: 'auth' })}
            className={linkClass(route.name === 'landlord')}
          >
            {t('landlord')}
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => go({ name: 'admin' })}
              className={linkClass(route.name === 'admin')}
            >
              {t('admin')}
            </button>
          )}
        </nav>

        {/* Zone 3: Theme Toggle + Primary action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 text-zinc-700 dark:text-amber-300 hover:bg-stone-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer interactive-press"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => go(user ? { name: 'profile' } : { name: 'auth' })}
            className="px-4 py-2 text-sm font-semibold text-white bg-[#0A4D38] hover:bg-[#073828] rounded-xl shadow-sm transition-all whitespace-nowrap shrink-0 cursor-pointer interactive-press"
          >
            {user ? user.fullName.split(' ')[0] : t('signIn')}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden p-2 text-zinc-700 dark:text-zinc-200 hover:bg-stone-100 dark:hover:bg-zinc-800 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation & persistent mobile search bar */}
      {mobileOpen && (
        <div className="md:hidden border-t border-stone-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex flex-col gap-2">
          <form onSubmit={handleSubmit} className="sm:hidden flex gap-1.5 pb-2 border-b border-stone-100 dark:border-zinc-800">
            <input
              type="search"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="flex-1 min-w-0 px-3 py-2 text-sm border border-stone-200 dark:border-zinc-700 rounded-lg bg-stone-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:border-[#0A4D38]"
            />
            <button
              type="submit"
              className="px-3.5 py-2 text-xs font-semibold bg-[#0A4D38] text-white rounded-lg whitespace-nowrap cursor-pointer"
            >
              {t('searchBtn')}
            </button>
          </form>

          <button
            type="button"
            onClick={() => go({ name: 'home' })}
            className="text-left px-3 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
          >
            {t('browse')}
          </button>
          <button
            type="button"
            onClick={() => go(user ? { name: 'saved' } : { name: 'auth' })}
            className="text-left px-3 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
          >
            {t('saved')}
          </button>
          <button
            type="button"
            onClick={() => go(user ? { name: 'landlord' } : { name: 'auth' })}
            className="text-left px-3 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
          >
            {t('landlord')}
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => go({ name: 'admin' })}
              className="text-left px-3 py-2.5 text-sm font-medium text-zinc-800 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800 rounded-lg cursor-pointer"
            >
              {t('admin')}
            </button>
          )}
        </div>
      )}
    </header>
  );
};
