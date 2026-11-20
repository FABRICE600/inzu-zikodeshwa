import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Compass,
  Heart,
  Home,
  MapPin,
  Scale,
} from 'lucide-react';
import { ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { renderAmenityIcon, sortAmenitiesForDisplay } from '../lib/amenityIcons.tsx';
import { hasVirtualTour } from '../lib/virtualTour.ts';
import { useLanguage } from '../context/LanguageContext.tsx';

interface ListingCardProps {
  listing: ListingItem;
  layout?: 'grid' | 'list';
  isFavorited?: boolean;
  onToggleFavorite?: (listingId: number) => void;
  isCompared?: boolean;
  onToggleCompare?: (listing: ListingItem) => void;
  onOpenTour?: (listing: ListingItem) => void;
  onSelect: (listingId: number) => void;
}

export const ListingCard: React.FC<ListingCardProps> = ({
  listing,
  layout = 'grid',
  isFavorited = false,
  onToggleFavorite,
  isCompared = false,
  onToggleCompare,
  onOpenTour,
  onSelect,
}) => {
  const { t } = useLanguage();
  const [imgError, setImgError] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);

  const photoUrls = listing.photos?.length
    ? listing.photos.map((p) => p.url)
    : listing.coverPhoto
    ? [listing.coverPhoto]
    : [];
  const imageUrl = photoUrls[photoIdx] || listing.coverPhoto || '';
  const typeLabel = t(`type_${listing.propertyType}`);
  const tourAvailable = hasVirtualTour(listing);

  const sortedAmenities = sortAmenitiesForDisplay(listing.amenities || []);
  const visibleAmenities = sortedAmenities.slice(0, 4);
  const extraAmenitiesCount = Math.max(0, sortedAmenities.length - visibleAmenities.length);

  const cyclePhoto = (e: React.MouseEvent, delta: number) => {
    e.stopPropagation();
    if (photoUrls.length <= 1) return;
    setImgError(false);
    setPhotoIdx((prev) => (prev + delta + photoUrls.length) % photoUrls.length);
  };

  return (
    <article
      onClick={() => onSelect(listing.id)}
      className={`group bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-xl hover:shadow-zinc-900/8 dark:hover:shadow-black/40 hover:-translate-y-1 ${
        isCompared
          ? 'border-[#0A4D38] dark:border-emerald-500 ring-1 ring-[#0A4D38] dark:ring-emerald-500'
          : 'border-stone-200/90 dark:border-zinc-800 hover:border-[#0A4D38]/45 dark:hover:border-emerald-600/60'
      } ${layout === 'list' ? 'flex flex-col sm:flex-row' : 'flex flex-col'}`}
    >
      {/* Image container */}
      <div
        className={`relative bg-stone-100 dark:bg-zinc-800 overflow-hidden shrink-0 ${
          layout === 'list' ? 'w-full sm:w-72 aspect-[4/3]' : 'w-full aspect-[4/3]'
        }`}
      >
        {!imgError && imageUrl ? (
          <img
            src={imageUrl}
            alt={listing.title}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-100 to-stone-200 dark:from-zinc-800 dark:to-zinc-900 flex flex-col items-center justify-center p-4 text-zinc-400">
            <Home className="w-8 h-8 mb-2" />
            <span className="text-xs text-center font-medium text-zinc-500 dark:text-zinc-400 line-clamp-1">
              {listing.title}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />

        {onToggleCompare && (
          <button
            type="button"
            aria-label={isCompared ? 'Remove from comparison' : 'Add to comparison'}
            aria-pressed={isCompared}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCompare(listing);
            }}
            className={`absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-semibold border shadow-sm transition-all cursor-pointer whitespace-nowrap ${
              isCompared
                ? 'bg-[#0A4D38] text-white border-[#0A4D38]'
                : 'bg-white/95 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 border-stone-200/80 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5 shrink-0" />
            {isCompared ? 'Comparing' : 'Compare'}
          </button>
        )}

        {photoUrls.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => cyclePhoto(e, -1)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute left-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 shadow flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 transition-opacity cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => cyclePhoto(e, 1)}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/95 dark:bg-zinc-900/90 text-zinc-800 dark:text-zinc-100 shadow flex items-center justify-center hover:bg-white dark:hover:bg-zinc-800 transition-opacity cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="absolute bottom-3 left-3 text-[11px] font-mono tabular-nums font-medium text-white/95 drop-shadow">
              {photoIdx + 1} / {photoUrls.length}
            </span>
          </>
        )}

        {tourAvailable && (
          <button
            type="button"
            aria-label={`Launch 360 degree virtual tour for ${listing.title}`}
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenTour) {
                onOpenTour(listing);
              } else {
                onSelect(listing.id);
              }
            }}
            className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 px-2.5 h-8 rounded-lg bg-zinc-950/85 hover:bg-[#0A4D38] text-white border border-white/25 backdrop-blur-sm text-xs font-semibold shadow-md transition-colors cursor-pointer whitespace-nowrap interactive-press"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            360° View
          </button>
        )}

        {onToggleFavorite && (
          <button
            type="button"
            aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(listing.id);
            }}
            className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 dark:bg-zinc-900/90 border border-stone-200/80 dark:border-zinc-700 shadow-sm flex items-center justify-center text-zinc-700 dark:text-zinc-200 hover:text-rose-600 hover:scale-105 transition-all cursor-pointer"
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
          <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            <span className="truncate font-medium">
              {typeLabel} · {listing.sector}, {listing.district}
            </span>
            {listing.distanceKm !== null && listing.distanceKm !== undefined && (
              <span className="font-mono tabular-nums shrink-0 text-[#0A4D38] dark:text-emerald-400 font-semibold">
                {listing.distanceKm} km
              </span>
            )}
          </div>

          <h3 className="text-base font-semibold text-zinc-900 dark:text-white leading-snug line-clamp-2 group-hover:text-[#0A4D38] dark:group-hover:text-emerald-400 transition-colors">
            {listing.title}
          </h3>

          {layout === 'list' && (
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-300 line-clamp-2">{listing.description}</p>
          )}

          {/* Scannable Visual Amenity Icons (unboxed zero-pill layout) */}
          {visibleAmenities.length > 0 && (
            <div
              className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300"
              aria-label="Key amenities"
            >
              {visibleAmenities.map((amenity) => (
                <span
                  key={amenity}
                  title={t(`amenity_${amenity}`)}
                  className="inline-flex items-center gap-1 whitespace-nowrap"
                >
                  {renderAmenityIcon(amenity)}
                  <span className="truncate max-w-[100px]">{t(`amenity_${amenity}`)}</span>
                </span>
              ))}
              {extraAmenitiesCount > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-zinc-400 dark:text-zinc-500">
                  +{extraAmenitiesCount} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-stone-100 dark:border-zinc-800 flex items-end justify-between gap-3">
          <div>
            <div className="text-base font-bold text-zinc-900 dark:text-white font-mono tabular-nums">
              {formatRwf(listing.priceRwf)}
              <span className="text-xs font-normal font-sans text-zinc-500 dark:text-zinc-400">
                {' '}
                {t('perMonth')}
              </span>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {listing.bedrooms} {t('bedrooms')} · {listing.bathrooms} {t('bathrooms')} ·{' '}
              {listing.furnished ? t('furnished') : t('unfurnished')}
            </div>
          </div>

          <div className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 shrink-0 max-w-[145px]">
            <MapPin className="w-3.5 h-3.5 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
            <span className="truncate group-hover:hidden">{listing.streetLandmark}</span>
            <span className="hidden group-hover:inline-flex items-center gap-1 font-semibold text-[#0A4D38] dark:text-emerald-400 whitespace-nowrap">
              View Details <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
