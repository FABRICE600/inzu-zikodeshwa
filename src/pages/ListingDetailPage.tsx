import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellRing,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  Flag,
  Heart,
  Home,
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  TrendingDown,
  X,
  ZoomIn,
} from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { hasVirtualTour } from '../lib/virtualTour.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { LeafletMap } from '../components/LeafletMap.tsx';
import { ListingCard } from '../components/ListingCard.tsx';
import { VirtualTourModal } from '../components/VirtualTourModal.tsx';

interface ListingDetailPageProps {
  listingId: number;
  onBack: () => void;
  onSelectListing: (id: number) => void;
  onRequireAuth: () => void;
  onListingLoaded?: (listing: ListingItem) => void;
}

export const ListingDetailPage: React.FC<ListingDetailPageProps> = ({
  listingId,
  onBack,
  onSelectListing,
  onRequireAuth,
  onListingLoaded,
}) => {
  const { user, token } = useAuth();
  const { t } = useLanguage();

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [similar, setSimilar] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [tourListing, setTourListing] = useState<ListingItem | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [priceAlert, setPriceAlert] = useState<{
    subscribed: boolean;
    subscribedPriceRwf?: number;
    hasDropped?: boolean;
    savingsRwf?: number;
  } | null>(null);
  const [togglingPriceAlert, setTogglingPriceAlert] = useState(false);
  const [priceAlertFeedback, setPriceAlertFeedback] = useState('');
  const [copied, setCopied] = useState(false);

  // Viewing request / In-app message state
  const [requestType, setRequestType] = useState<'viewing' | 'message'>('viewing');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('10:00');
  const [message, setMessage] = useState('');
  const [inquiryFeedback, setInquiryFeedback] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);

  // Report modal state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Suspected scam or fake photos');
  const [reportDetails, setReportDetails] = useState('');
  const [reportDone, setReportDone] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    setActivePhotoIndex(0);
    setInquiryFeedback('');
    setPriceAlertFeedback('');
    apiRequest<{ listing: ListingItem; similar: ListingItem[] }>(`/api/listings/${listingId}`, {
      token,
    })
      .then((res) => {
        setListing(res.listing);
        setSimilar(res.similar);
        onListingLoaded?.(res.listing);
      })
      .catch((err) => setError(err.message || 'Listing not found.'))
      .finally(() => setLoading(false));
  }, [listingId, token]);

  useEffect(() => {
    if (!token) {
      setIsFavorited(false);
      setPriceAlert(null);
      return;
    }
    apiRequest<{ ids: number[] }>('/api/tenant/favorites', { token })
      .then((res) => setIsFavorited(res.ids.includes(listingId)))
      .catch(() => {});

    apiRequest<{
      subscribed: boolean;
      alert: { subscribedPriceRwf: number; hasDropped: boolean; savingsRwf: number } | null;
    }>(`/api/tenant/price-alerts/${listingId}`, { token })
      .then((res) =>
        setPriceAlert({
          subscribed: res.subscribed,
          subscribedPriceRwf: res.alert?.subscribedPriceRwf,
          hasDropped: res.alert?.hasDropped,
          savingsRwf: res.alert?.savingsRwf,
        })
      )
      .catch(() => {});
  }, [token, listingId]);

  useEffect(() => {
    if (!zoomOpen || !listing?.photos?.length) return;
    const photoCount = listing.photos.length;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomOpen(false);
      if (e.key === 'ArrowRight' && photoCount > 1) {
        setActivePhotoIndex((i) => (i + 1) % photoCount);
      }
      if (e.key === 'ArrowLeft' && photoCount > 1) {
        setActivePhotoIndex((i) => (i - 1 + photoCount) % photoCount);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen, listing?.photos?.length]);

  const handleToggleFavorite = async () => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    const res = await apiRequest<{ favorited: boolean }>(`/api/tenant/favorites/${listingId}`, {
      method: 'POST',
      token,
    });
    setIsFavorited(res.favorited);
  };

  const handleTogglePriceAlert = async () => {
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    setTogglingPriceAlert(true);
    setPriceAlertFeedback('');
    try {
      const res = await apiRequest<{
        subscribed: boolean;
        alert: { subscribedPriceRwf: number; hasDropped: boolean; savingsRwf: number } | null;
      }>(`/api/tenant/price-alerts/${listingId}`, {
        method: 'POST',
        token,
      });
      setPriceAlert({
        subscribed: res.subscribed,
        subscribedPriceRwf: res.alert?.subscribedPriceRwf,
        hasDropped: res.alert?.hasDropped,
        savingsRwf: res.alert?.savingsRwf,
      });
      setPriceAlertFeedback(
        res.subscribed
          ? `Price alert saved! We will notify you in Saved & Activity if rent drops below ${formatRwf(
              res.alert?.subscribedPriceRwf || listing?.priceRwf || 0
            )}.`
          : 'Price drop alert removed.'
      );
    } catch (err: any) {
      setPriceAlertFeedback(err.message || 'Could not update price alert.');
    } finally {
      setTogglingPriceAlert(false);
    }
  };

  const handleAcknowledgePriceDrop = async () => {
    if (!token) return;
    try {
      await apiRequest(`/api/tenant/price-alerts/${listingId}/ack`, {
        method: 'PATCH',
        token,
      });
      setPriceAlert((prev) =>
        prev
          ? {
              ...prev,
              subscribedPriceRwf: listing?.priceRwf || prev.subscribedPriceRwf,
              hasDropped: false,
              savingsRwf: 0,
            }
          : prev
      );
    } catch {
      // ignore
    }
  };

  const handleSubmitInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    setSubmittingInquiry(true);
    setInquiryFeedback('');
    try {
      await apiRequest('/api/tenant/viewings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          listingId,
          requestType,
          preferredDate: requestType === 'viewing' ? preferredDate : '',
          preferredTime: requestType === 'viewing' ? preferredTime : '',
          message:
            message.trim() ||
            (requestType === 'viewing'
              ? 'Hello, I would like to schedule a viewing for this property.'
              : 'Hello, is this property still available?'),
        }),
      });
      setMessage('');
      setInquiryFeedback('Your request has been sent to the landlord. Track status in Saved.');
    } catch (err: any) {
      setInquiryFeedback(err.message || 'Could not send request.');
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !token) {
      onRequireAuth();
      return;
    }
    try {
      await apiRequest('/api/tenant/reports', {
        method: 'POST',
        token,
        body: JSON.stringify({
          listingId,
          reason: reportReason,
          details: reportDetails,
        }),
      });
      setReportDone('Report submitted for moderator review.');
      setTimeout(() => {
        setReportOpen(false);
        setReportDone('');
        setReportDetails('');
      }, 1500);
    } catch (err: any) {
      setReportDone(err.message || 'Could not submit report.');
    }
  };

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/#listing/${listingId}` : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="h-96 bg-zinc-200 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-lg font-semibold text-zinc-900">{error || 'Listing unavailable'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-zinc-900 text-white text-sm rounded-lg cursor-pointer"
        >
          Back to Search
        </button>
      </div>
    );
  }

  const photos = listing.photos?.length ? listing.photos : [];
  const activePhoto = photos[activePhotoIndex]?.url || listing.coverPhoto;
  const whatsappClean = (listing.landlord?.whatsapp || listing.landlord?.phone || '').replace(/[^\d]/g, '');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white mb-6 cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Listings
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Gallery + Full Details + Map */}
        <div className="lg:col-span-8 space-y-8">
          {/* Gallery */}
          <div className="space-y-3">
            <div
              onClick={() => activePhoto && setZoomOpen(true)}
              className="relative aspect-[16/10] bg-stone-100 dark:bg-zinc-800 rounded-2xl overflow-hidden border border-stone-200 dark:border-zinc-800 cursor-zoom-in group"
            >
              {activePhoto ? (
                <img
                  src={activePhoto}
                  alt={listing.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.01]"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  <Home className="w-12 h-12" />
                </div>
              )}
              {hasVirtualTour(listing) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTourListing(listing);
                  }}
                  className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 px-3.5 min-h-[40px] bg-zinc-950/85 hover:bg-[#0A4D38] text-white border border-white/25 backdrop-blur-sm text-xs font-semibold rounded-xl shadow-lg transition-colors cursor-pointer whitespace-nowrap interactive-press"
                >
                  <Compass className="w-4 h-4 text-emerald-300 shrink-0" />
                  360° View
                </button>
              )}
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIndex((i) => (i - 1 + photos.length) % photos.length);
                    }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/90 hover:bg-white text-zinc-900 rounded-full shadow-md transition-all cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActivePhotoIndex((i) => (i + 1) % photos.length);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/90 hover:bg-white text-zinc-900 rounded-full shadow-md transition-all cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <span className="absolute bottom-3 left-3 px-2.5 py-1 bg-zinc-900/80 text-white text-xs font-mono tabular-nums rounded-lg">
                    {activePhotoIndex + 1} / {photos.length}
                  </span>
                </>
              )}
              {activePhoto && (
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/80 text-white text-xs font-medium rounded-lg">
                  <ZoomIn className="w-3.5 h-3.5" /> Zoom
                </span>
              )}
            </div>

            {photos.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {photos.map((p, idx) => (
                  <button
                    key={p.id || idx}
                    type="button"
                    onClick={() => setActivePhotoIndex(idx)}
                    className={`w-20 h-16 rounded-lg overflow-hidden border-2 shrink-0 cursor-pointer ${
                      idx === activePhotoIndex ? 'border-[#0A4D38]' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={p.url}
                      alt={`Photo ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Title & Metadata */}
          <div className="border-b border-stone-200 dark:border-zinc-800 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-2">
              <span>
                {t(`type_${listing.propertyType}`)} · {listing.province} · {listing.district} ·{' '}
                {listing.sector}
              </span>
              <span className="font-mono tabular-nums">
                {listing.viewsCount} views · Status: {t(listing.status)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white [text-wrap:balance]">
              {listing.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
                {listing.streetLandmark}
                {listing.cell ? ` (${listing.cell})` : ''}
              </p>
              <button
                type="button"
                onClick={() =>
                  document.getElementById('listing-location-map')?.scrollIntoView({ behavior: 'smooth' })
                }
                className="text-xs font-semibold text-[#0A4D38] dark:text-emerald-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                View on Map
              </button>
            </div>
          </div>

          {/* Key Specs Table Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-xl p-5">
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('bedrooms')}</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono tabular-nums mt-0.5">
                {listing.bedrooms}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('bathrooms')}</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono tabular-nums mt-0.5">
                {listing.bathrooms}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('size')}</div>
              <div className="text-lg font-bold text-zinc-900 dark:text-white font-mono tabular-nums mt-0.5">
                {listing.sizeSqm ? `${listing.sizeSqm} m²` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">{t('availableFrom')}</div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-white font-mono tabular-nums mt-1">
                {listing.availableFrom}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-3">About this property</h2>
            <p className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* Amenities & Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-stone-200 dark:border-zinc-800">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-3">{t('amenities')}</h2>
              {listing.amenities.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Standard utilities</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {listing.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
                      <span>{t(`amenity_${a}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-3">{t('rules')}</h2>
              {listing.rules.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Standard tenancy rules apply.</p>
              ) : (
                <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                  {listing.rules.map((r) => (
                    <li key={r} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      <span>{t(`rule_${r}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Exact Location Map */}
          <div id="listing-location-map" className="pt-4 border-t border-stone-200 dark:border-zinc-800">
            <h2 className="text-base font-bold text-zinc-900 dark:text-white mb-3">{t('location')}</h2>
            <LeafletMap
              mode="detail"
              selectedPosition={{ lat: listing.latitude, lng: listing.longitude }}
              className="h-72 w-full rounded-2xl border border-stone-200 dark:border-zinc-800 overflow-hidden"
            />
          </div>
        </div>

        {/* Right column: Contiguous Pricing, Landlord Contact & Actions */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
          <div className="bg-white dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-zinc-900 dark:text-white font-mono tabular-nums">
                  {formatRwf(listing.priceRwf)}
                  <span className="text-xs font-normal font-sans text-zinc-500 dark:text-zinc-400">
                    {' '}
                    {t('perMonth')}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-mono tabular-nums">
                  {t('deposit')}: {formatRwf(listing.depositRwf)} ·{' '}
                  {listing.furnished ? t('furnished') : t('unfurnished')}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label="Favorite listing"
                className="p-2.5 border border-stone-200 dark:border-zinc-700 rounded-xl hover:bg-stone-50 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <Heart
                  className={`w-5 h-5 ${isFavorited ? 'fill-rose-600 text-rose-600' : 'text-zinc-600 dark:text-zinc-300'}`}
                />
              </button>
            </div>

            {/* Price Drop Alert Banner (when subscribed listing decreased in price) */}
            {priceAlert?.hasDropped && (
              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0A4D38] dark:text-emerald-300">
                  <TrendingDown className="w-4 h-4 shrink-0" />
                  Price Dropped by {formatRwf(priceAlert.savingsRwf || 0)}!
                </div>
                <p className="text-xs text-emerald-900 dark:text-emerald-200/90">
                  Monthly rent decreased from{' '}
                  <span className="font-mono line-through">
                    {formatRwf(priceAlert.subscribedPriceRwf || 0)}
                  </span>{' '}
                  to <span className="font-mono font-semibold">{formatRwf(listing.priceRwf)}</span>.
                </p>
                <button
                  type="button"
                  onClick={handleAcknowledgePriceDrop}
                  className="text-xs font-semibold text-[#0A4D38] dark:text-emerald-300 underline cursor-pointer"
                >
                  Update alert baseline to current price
                </button>
              </div>
            )}

            {/* Notify Me of Price Drops Button */}
            <div className="space-y-1.5">
              <button
                type="button"
                disabled={togglingPriceAlert}
                aria-pressed={Boolean(priceAlert?.subscribed)}
                onClick={handleTogglePriceAlert}
                className={`w-full py-2.5 px-4 rounded-xl border text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer interactive-press disabled:opacity-60 ${
                  priceAlert?.subscribed
                    ? 'border-[#0A4D38] bg-[#0A4D38] text-white hover:bg-[#073828]'
                    : 'border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {priceAlert?.subscribed ? (
                  <>
                    <BellRing className="w-4 h-4 text-emerald-300 shrink-0" />
                    Watching for price drops ({formatRwf(priceAlert.subscribedPriceRwf || listing.priceRwf)})
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 text-[#0A4D38] dark:text-emerald-400 shrink-0" />
                    Notify me of price drops
                  </>
                )}
              </button>
              {priceAlertFeedback && (
                <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-3 py-2 rounded-lg">
                  {priceAlertFeedback}
                </p>
              )}
            </div>

            {hasVirtualTour(listing) && (
              <button
                type="button"
                onClick={() => setTourListing(listing)}
                className="w-full py-2.5 px-4 rounded-xl border border-[#0A4D38]/25 dark:border-emerald-700/60 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/50 text-[#0A4D38] dark:text-emerald-300 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer interactive-press"
              >
                <Compass className="w-4 h-4 shrink-0" />
                Launch 360° Virtual Tour
              </button>
            )}

            {/* Landlord Profile Preview */}
            {listing.landlord && (
              <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-stone-200 dark:bg-zinc-700 overflow-hidden shrink-0 flex items-center justify-center font-bold text-zinc-700 dark:text-zinc-200">
                  {listing.landlord.photoUrl ? (
                    <img
                      src={listing.landlord.photoUrl}
                      alt={listing.landlord.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    listing.landlord.fullName.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
                    {listing.landlord.fullName}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Landlord {listing.landlord.phoneVerified ? '· Phone Verified' : ''}
                  </div>
                </div>
              </div>
            )}

            {/* Direct Call & WhatsApp Buttons */}
            <div className="grid grid-cols-2 gap-2.5">
              {listing.landlord?.phone ? (
                <a
                  href={`tel:${listing.landlord.phone}`}
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold border border-stone-200 dark:border-zinc-700 rounded-xl text-zinc-800 dark:text-zinc-200 hover:bg-stone-50 dark:hover:bg-zinc-800"
                >
                  <Phone className="w-4 h-4" />
                  {t('call')}
                </a>
              ) : (
                <span className="inline-flex items-center justify-center px-3 py-2.5 text-xs text-zinc-400 border border-stone-100 dark:border-zinc-800 rounded-xl">
                  No Phone Listed
                </span>
              )}

              {whatsappClean ? (
                <a
                  href={`https://wa.me/${whatsappClean}?text=${encodeURIComponent(
                    `Hello, I saw your rental "${listing.title}" on InzuFinder.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold bg-[#0A4D38] hover:bg-[#073828] text-white rounded-xl"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('whatsapp')}
                </a>
              ) : (
                <span className="inline-flex items-center justify-center px-3 py-2.5 text-xs text-zinc-400 border border-stone-100 dark:border-zinc-800 rounded-xl">
                  No WhatsApp
                </span>
              )}
            </div>

            {/* Request Viewing / In-App Message Form */}
            <form onSubmit={handleSubmitInquiry} className="pt-4 border-t border-stone-100 dark:border-zinc-800 space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 bg-stone-100 dark:bg-zinc-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRequestType('viewing')}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    requestType === 'viewing'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {t('requestViewing')}
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('message')}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    requestType === 'message'
                      ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  Message Landlord
                </button>
              </div>

              {requestType === 'viewing' && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    required
                    value={preferredDate}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-stone-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-stone-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  />
                </div>
              )}

              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about water, deposit terms, or preferred visit time..."
                className="w-full px-3 py-2 text-sm border border-stone-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 resize-none"
              />

              {inquiryFeedback && (
                <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                  {inquiryFeedback}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingInquiry}
                className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-sm font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {requestType === 'viewing' ? t('requestViewing') : 'Send Message'}
              </button>
            </form>

            {/* Share & Report */}
            <div className="pt-4 border-t border-stone-100 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${listing.title} - ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
                >
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <span>·</span>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-900 dark:hover:text-white"
                >
                  Facebook
                </a>
                <span>·</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => (user ? setReportOpen(true) : onRequireAuth())}
                className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400 hover:text-rose-600 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" /> {t('report')}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Similar Listings */}
      {similar.length > 0 && (
        <section className="mt-14 pt-8 border-t border-stone-200 dark:border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-5">{t('similarListings')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {similar.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                onOpenTour={(target) => setTourListing(target)}
                onSelect={onSelectListing}
              />
            ))}
          </div>
        </section>
      )}

      {/* Photo Zoom Lightbox */}
      {zoomOpen && activePhoto && (
        <div
          onClick={() => setZoomOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close photo zoom"
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center text-white bg-white/15 rounded-full hover:bg-white/25 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex((i) => (i - 1 + photos.length) % photos.length);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white bg-white/15 rounded-full hover:bg-white/25 cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePhotoIndex((i) => (i + 1) % photos.length);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center text-white bg-white/15 rounded-full hover:bg-white/25 cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
          <img
            src={activePhoto}
            alt={listing.title}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-[88vh] object-contain rounded-lg"
          />
        </div>
      )}

      {/* Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#161b19] rounded-xl border border-zinc-200 dark:border-zinc-800 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Report Listing</h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option>Suspected scam or fake photos</option>
                  <option>Property already rented</option>
                  <option>Incorrect price or location</option>
                  <option>Harassment or offensive content</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Details</label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide additional context for moderators..."
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
              {reportDone && (
                <p className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 p-2.5 rounded-lg">
                  {reportDone}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold bg-rose-600 text-white rounded-lg cursor-pointer"
                >
                  Submit Report
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
          onOpenListing={
            tourListing.id !== listing.id ? (id) => onSelectListing(id) : undefined
          }
        />
      )}
    </div>
  );
};
