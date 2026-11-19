import React, { useState } from 'react';
import { Heart, Home, MapPin } from 'lucide-react';
import { ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { useLanguage } from '../context/LanguageContext.tsx';

interface ListingCardProps {
  listing: ListingItem;
  layout?: 'grid' | 'list';
  isFavorited?: boolean;
  onToggleFavorite?: (listingId: number) => void;
  onSelect: (listingId: number) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  layout = 'grid',
  isFavorited = false,
  onToggleFavorite,
  onSelect,
}) => {
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);

  const imageUrl = listing.coverPhoto || listing.photos?.[0]?.url || '';
  const typeLabel = t(`type_${listing.propertyType}`);

  return (
    <article
      onClick={() => onSelect(listing.id)}
      className={`group bg-white border border-zinc-200 rounded-xl overflow-hidden cursor-pointer transition-all duration-150 hover:border-zinc-300 hover:-translate-y-0.5 ${
        layout === 'list' ? 'flex flex-col sm:flex-row' : 'flex flex-col'
      }`}
    >
      {/* Image container */}
      <div
        className={`relative bg-zinc-100 overflow-hidden shrink-0 ${
          layout === 'list' ? 'w-full sm:w-72 aspect-[4/3]' : 'w-full aspect-[4/3]'
        }`}
      >
        {!imgError && imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex flex-col items-center justify-center p-4 text-zinc-400">
            <Home className="w-8 h-8 mb-2" />
            <span className="text-xs text-center font-medium text-zinc-500 line-clamp-1">
              {listing.title}
            </span>
          </div>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(listing.id);
            }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 border border-zinc-200 flex items-center justify-center text-zinc-700 hover:text-rose-600 transition-colors cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 ${isFavorited ? 'fill-rose-600 text-rose-600' : ''}`}
            />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 mb-1.5">
            <span className="truncate">
              {typeLabel} · {listing.sector}, {listing.district}
            </span>
            {listing.distanceKm !== null && listing.distanceKm !== undefined && (
              <span className="font-mono tabular-nums shrink-0 text-emerald-800">
                {listing.distanceKm} km
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-[#0D5C43] transition-colors">
            {listing.title}
          </h3>

          {layout === 'list' && (
            <p className="mt-1.5 text-sm text-zinc-600 line-clamp-2">{listing.description}</p>
          )}
        </div>

        <div className="pt-3 border-t border-zinc-100 flex items-end justify-between gap-3">
          <div>
            <div className="text-base font-bold text-zinc-900 font-mono tabular-nums">
              {formatRwf(listing.priceRwf)}
              <span className="text-xs font-normal font-sans text-zinc-500">
                {' '}
                {t('perMonth')}
              </span>
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {listing.bedrooms} {t('bedrooms')} · {listing.bathrooms} {t('bathrooms')} ·{' '}
              {listing.furnished ? t('furnished') : t('unfurnished')}
            </div>
          </div>

          <div className="text-xs text-zinc-500 flex items-center gap-1 shrink-0 max-w-[140px]">
            <MapPin className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span className="truncate">{listing.streetLandmark}</span>
          </div>
        </div>
      </div>
    </article>
  );
};
