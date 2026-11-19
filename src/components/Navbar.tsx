import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';

export type AppRoute =
  | { name: 'home' }
  | { name: 'listing'; id: number }
  | { name: 'auth' }
  | { name: 'profile' }
  | { name: 'saved' }
  | { name: 'landlord'; editId?: number }
  | { name: 'admin' };

interface NavbarProps {
  route: AppRoute;
  navigate: (r: AppRoute) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ route, navigate }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (active: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
      active
        ? 'text-zinc-900 border-[#0D5C43]'
        : 'text-zinc-600 border-transparent hover:text-zinc-900 hover:border-zinc-300'
    }`;

  const go = (r: AppRoute) => {
    setMobileOpen(false);
    navigate(r);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <button
          type="button"
          onClick={() => go({ name: 'home' })}
          className="text-xl font-bold tracking-tight text-zinc-900 font-display whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#0D5C43] rounded"
        >
          InzuFinder
        </button>

        {/* Zone 2: 4 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6">
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

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => go(user ? { name: 'profile' } : { name: 'auth' })}
            className="px-4 py-2 text-sm font-medium text-white bg-[#0D5C43] hover:bg-[#094431] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {user ? user.fullName.split(' ')[0] : t('signIn')}
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
            className="md:hidden p-2 text-zinc-700 hover:bg-zinc-100 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-200 bg-white px-4 py-3 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => go({ name: 'home' })}
            className="text-left px-3 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-lg"
          >
            {t('browse')}
          </button>
          <button
            type="button"
            onClick={() => go(user ? { name: 'saved' } : { name: 'auth' })}
            className="text-left px-3 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-lg"
          >
            {t('saved')}
          </button>
          <button
            type="button"
            onClick={() => go(user ? { name: 'landlord' } : { name: 'auth' })}
            className="text-left px-3 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-lg"
          >
            {t('landlord')}
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => go({ name: 'admin' })}
              className="text-left px-3 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 rounded-lg"
            >
              {t('admin')}
            </button>
          )}
        </div>
      )}
    </header>
  );
};
