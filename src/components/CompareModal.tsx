import React, { useEffect } from 'react';
import { ArrowUpRight, Check, Minus, Scale, Trash2, X } from 'lucide-react';
import { ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { renderAmenityIcon, sortAmenitiesForDisplay } from '../lib/amenityIcons.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';

interface CompareModalProps {
  listings: ListingItem[];
  onClose: () => void;
  onRemove: (id: number) => void;
  onClearAll: () => void;
  onSelectListing: (id: number) => void;
}

export const CompareModal: React.FC<CompareModalProps> = ({
  listings,
  onClose,
  onRemove,
  onClearAll,
  onSelectListing,
}) => {
  const { t } = useLanguage();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const minPrice =
    listings.length > 1 ? Math.min(...listings.map((item) => item.priceRwf)) : null;

  const allAmenities = sortAmenitiesForDisplay(
    Array.from(new Set(listings.flatMap((l) => l.amenities || [])))
  );

  const emptySlots = Math.max(0, 3 - listings.length);

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Compare properties side by side"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/80 dark:bg-zinc-900/70">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-[#0D5C43] dark:text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
                Compare Properties ({listings.length}/3)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Side-by-side comparison of rent, location, dimensions, and amenities.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-rose-700 dark:hover:text-rose-400 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </button>
            <button
              type="button"
              aria-label="Close comparison"
              onClick={onClose}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <table className="w-full min-w-[680px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 align-top">
                <th className="w-44 py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Property
                </th>
                {listings.map((item) => {
                  const photo =
                    item.coverPhoto ||
                    item.photos?.[0]?.url ||
                    '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg';
                  return (
                    <th key={item.id} className="py-3 px-3 w-1/4 align-top">
                      <div className="space-y-2.5">
                        <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                          <img
                            src={photo}
                            alt={item.title}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            aria-label={`Remove ${item.title} from comparison`}
                            onClick={() => onRemove(item.id)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 dark:bg-zinc-900/95 text-zinc-700 dark:text-zinc-200 hover:text-rose-600 shadow flex items-center justify-center cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onSelectListing(item.id);
                          }}
                          className="text-left text-sm font-bold text-zinc-900 dark:text-white hover:text-[#0D5C43] dark:hover:text-emerald-400 line-clamp-2 cursor-pointer"
                        >
                          {item.title}
                        </button>
                      </div>
                    </th>
                  );
                })}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <th key={`empty-${idx}`} className="py-3 px-3 w-1/4 align-top">
                    <div className="aspect-[4/3] rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/70 dark:bg-zinc-900/50 flex flex-col items-center justify-center p-4 text-center">
                      <Scale className="w-6 h-6 text-zinc-300 dark:text-zinc-600 mb-1.5" />
                      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        Select another property to compare
                      </span>
                      <button
                        type="button"
                        onClick={onClose}
                        className="mt-2 text-xs font-semibold text-[#0D5C43] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Browse Listings
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
              <tr>
                <td className="py-3.5 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Monthly Rent
                </td>
                {listings.map((item) => {
                  const isCheapest = minPrice !== null && item.priceRwf === minPrice;
                  return (
                    <td key={item.id} className="py-3.5 px-3 font-mono tabular-nums">
                      <div className="font-bold text-zinc-900 dark:text-white">
                        {formatRwf(item.priceRwf)}
                        <span className="text-xs font-normal font-sans text-zinc-500 dark:text-zinc-400">
                          {' '}
                          {t('perMonth')}
                        </span>
                      </div>
                      {isCheapest && (
                        <span className="text-[11px] font-sans font-semibold text-[#0D5C43] dark:text-emerald-400">
                          Lowest price selected
                        </span>
                      )}
                    </td>
                  );
                })}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-rent-${idx}`} className="py-3.5 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {t('deposit')}
                </td>
                {listings.map((item) => (
                  <td key={item.id} className="py-3 px-3 font-mono tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatRwf(item.depositRwf)}
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-dep-${idx}`} className="py-3 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Property Type
                </td>
                {listings.map((item) => (
                  <td key={item.id} className="py-3 px-3 font-medium text-zinc-800 dark:text-zinc-200">
                    {t(`type_${item.propertyType}`)}
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-type-${idx}`} className="py-3 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Location
                </td>
                {listings.map((item) => (
                  <td key={item.id} className="py-3 px-3 text-zinc-700 dark:text-zinc-300">
                    <div className="font-medium text-zinc-900 dark:text-white">
                      {item.sector}, {item.district}
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.streetLandmark}</div>
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-loc-${idx}`} className="py-3 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Rooms & Size
                </td>
                {listings.map((item) => (
                  <td key={item.id} className="py-3 px-3 text-zinc-700 dark:text-zinc-300 font-mono tabular-nums text-xs">
                    {item.bedrooms} bed · {item.bathrooms} bath
                    {item.sizeSqm ? ` · ${item.sizeSqm} m²` : ''}
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-dim-${idx}`} className="py-3 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  Furnishing
                </td>
                {listings.map((item) => (
                  <td key={item.id} className="py-3 px-3 text-zinc-700 dark:text-zinc-300">
                    {item.furnished ? t('furnished') : t('unfurnished')}
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-furn-${idx}`} className="py-3 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 pr-4 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                  {t('availableFrom')}
                </td>
                {listings.map((item) => (
                  <td key={item.id} className="py-3 px-3 font-mono tabular-nums text-xs text-zinc-700 dark:text-zinc-300">
                    {item.availableFrom}
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-avail-${idx}`} className="py-3 px-3 text-zinc-300 dark:text-zinc-600">
                    —
                  </td>
                ))}
              </tr>

              {/* Amenities Comparison Matrix */}
              {allAmenities.map((amenity) => (
                <tr key={amenity}>
                  <td className="py-2.5 pr-4 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-2">
                      {renderAmenityIcon(amenity)}
                      {t(`amenity_${amenity}`)}
                    </span>
                  </td>
                  {listings.map((item) => {
                    const has = (item.amenities || []).includes(amenity);
                    return (
                      <td key={`${item.id}-${amenity}`} className="py-2.5 px-3">
                        {has ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D5C43] dark:text-emerald-400">
                            <Check className="w-4 h-4" /> Included
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs text-zinc-400 dark:text-zinc-600">
                            <Minus className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                  {Array.from({ length: emptySlots }).map((_, idx) => (
                    <td key={`empty-${amenity}-${idx}`} className="py-2.5 px-3 text-zinc-300 dark:text-zinc-600">
                      —
                    </td>
                  ))}
                </tr>
              ))}

              {/* Action Row */}
              <tr>
                <td className="py-4 pr-4 text-xs font-semibold text-zinc-500">
                  Details
                </td>
                {listings.map((item) => (
                  <td key={`action-${item.id}`} className="py-4 px-3">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectListing(item.id);
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-[#0D5C43] hover:bg-[#094431] text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap interactive-press"
                    >
                      Open Listing <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                ))}
                {Array.from({ length: emptySlots }).map((_, idx) => (
                  <td key={`empty-action-${idx}`} className="py-4 px-3" />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
