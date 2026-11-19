import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Flag,
  Heart,
  Home,
  MapPin,
  MessageSquare,
  Phone,
  Share2,
  X,
  ZoomIn,
} from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import { formatRwf } from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { LeafletMap } from '../components/LeafletMap.tsx';
import { ListingCard } from '../components/ListingCard.tsx';

interface ListingDetailPageProps {
  listingId: number;
  onBack: () => void;
  onSelectListing: (id: number) => void;
  onRequireAuth: () => void;
}

export const ListingDetailPage: React.FC<ListingDetailPageProps> = ({
  listingId,
  onBack,
  onSelectListing,
  onRequireAuth,
}) => {
  const { user, token } = useAuth();
  const { t } = useLanguage();

  const [listing, setListing] = useState<ListingItem | null>(null);
  const [similar, setSimilar] = useState<ListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
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
    apiRequest<{ listing: ListingItem; similar: ListingItem[] }>(`/api/listings/${listingId}`, {
      token,
    })
      .then((res) => {
        setListing(res.listing);
        setSimilar(res.similar);
      })
      .catch((err) => setError(err.message || 'Listing not found.'))
      .finally(() => setLoading(false));
  }, [listingId, token]);

  useEffect(() => {
    if (!token) return;
    apiRequest<{ ids: number[] }>('/api/tenant/favorites', { token })
      .then((res) => setIsFavorited(res.ids.includes(listingId)))
      .catch(() => {});
  }, [token, listingId]);

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

  const copyLink = () => {
    navigator.clipboard?.writeText(shareUrl);
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
        className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 mb-6 cursor-pointer"
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
              className="relative aspect-[16/10] bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 cursor-zoom-in group"
            >
              {activePhoto ? (
                <img
                  src={activePhoto}
                  alt={listing.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                  <Home className="w-12 h-12" />
                </div>
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
                      idx === activePhotoIndex ? 'border-[#0D5C43]' : 'border-transparent opacity-70 hover:opacity-100'
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
          <div className="border-b border-zinc-200 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500 mb-2">
              <span>
                {t(`type_${listing.propertyType}`)} · {listing.province} · {listing.district} ·{' '}
                {listing.sector}
              </span>
              <span className="font-mono tabular-nums">
                {listing.viewsCount} views · Status: {t(listing.status)}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 [text-wrap:balance]">
              {listing.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-600 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#0D5C43] shrink-0" />
              {listing.streetLandmark}
              {listing.cell ? ` (${listing.cell})` : ''}
            </p>
          </div>

          {/* Key Specs Table Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white border border-zinc-200 rounded-xl p-5">
            <div>
              <div className="text-xs text-zinc-500">{t('bedrooms')}</div>
              <div className="text-lg font-bold text-zinc-900 font-mono tabular-nums mt-0.5">
                {listing.bedrooms}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">{t('bathrooms')}</div>
              <div className="text-lg font-bold text-zinc-900 font-mono tabular-nums mt-0.5">
                {listing.bathrooms}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">{t('size')}</div>
              <div className="text-lg font-bold text-zinc-900 font-mono tabular-nums mt-0.5">
                {listing.sizeSqm ? `${listing.sizeSqm} m²` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">{t('availableFrom')}</div>
              <div className="text-sm font-semibold text-zinc-900 font-mono tabular-nums mt-1">
                {listing.availableFrom}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-lg font-bold text-zinc-900 mb-3">About this property</h2>
            <p className="text-sm sm:text-base text-zinc-700 leading-relaxed whitespace-pre-line">
              {listing.description}
            </p>
          </div>

          {/* Amenities & Rules */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-zinc-200">
            <div>
              <h2 className="text-base font-bold text-zinc-900 mb-3">{t('amenities')}</h2>
              {listing.amenities.length === 0 ? (
                <p className="text-sm text-zinc-500">Standard utilities</p>
              ) : (
                <ul className="grid grid-cols-2 gap-2 text-sm text-zinc-700">
                  {listing.amenities.map((a) => (
                    <li key={a} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-[#0D5C43] shrink-0" />
                      <span>{t(`amenity_${a}`)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="text-base font-bold text-zinc-900 mb-3">{t('rules')}</h2>
              {listing.rules.length === 0 ? (
                <p className="text-sm text-zinc-500">Standard tenancy rules apply.</p>
              ) : (
                <ul className="space-y-2 text-sm text-zinc-700">
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
          <div className="pt-4 border-t border-zinc-200">
            <h2 className="text-base font-bold text-zinc-900 mb-3">{t('location')}</h2>
            <LeafletMap
              mode="detail"
              selectedPosition={{ lat: listing.latitude, lng: listing.longitude }}
              className="h-72 w-full rounded-xl border border-zinc-200 overflow-hidden"
            />
          </div>
        </div>

        {/* Right column: Contiguous Pricing, Landlord Contact & Actions */}
        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
          <div className="bg-white border border-zinc-200 rounded-xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-bold text-zinc-900 font-mono tabular-nums">
                  {formatRwf(listing.priceRwf)}
                  <span className="text-xs font-normal font-sans text-zinc-500">
                    {' '}
                    {t('perMonth')}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1 font-mono tabular-nums">
                  {t('deposit')}: {formatRwf(listing.depositRwf)} ·{' '}
                  {listing.furnished ? t('furnished') : t('unfurnished')}
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleFavorite}
                aria-label="Favorite listing"
                className="p-2.5 border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
              >
                <Heart
                  className={`w-5 h-5 ${isFavorited ? 'fill-rose-600 text-rose-600' : 'text-zinc-600'}`}
                />
              </button>
            </div>

            {/* Landlord Profile Preview */}
            {listing.landlord && (
              <div className="pt-4 border-t border-zinc-100 flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-zinc-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-zinc-700">
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
                  <div className="text-sm font-semibold text-zinc-900 truncate">
                    {listing.landlord.fullName}
                  </div>
                  <div className="text-xs text-zinc-500">
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
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold border border-zinc-200 rounded-lg text-zinc-800 hover:bg-zinc-50"
                >
                  <Phone className="w-4 h-4" />
                  {t('call')}
                </a>
              ) : (
                <span className="inline-flex items-center justify-center px-3 py-2.5 text-xs text-zinc-400 border border-zinc-100 rounded-lg">
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
                  className="inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold bg-[#0D5C43] hover:bg-[#094431] text-white rounded-lg"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('whatsapp')}
                </a>
              ) : (
                <span className="inline-flex items-center justify-center px-3 py-2.5 text-xs text-zinc-400 border border-zinc-100 rounded-lg">
                  No WhatsApp
                </span>
              )}
            </div>

            {/* Request Viewing / In-App Message Form */}
            <form onSubmit={handleSubmitInquiry} className="pt-4 border-t border-zinc-100 space-y-3">
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRequestType('viewing')}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    requestType === 'viewing' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
                  }`}
                >
                  {t('requestViewing')}
                </button>
                <button
                  type="button"
                  onClick={() => setRequestType('message')}
                  className={`py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                    requestType === 'message' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
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
                    className="px-2.5 py-2 text-xs border border-zinc-200 rounded-lg"
                  />
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="px-2.5 py-2 text-xs border border-zinc-200 rounded-lg"
                  />
                </div>
              )}

              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about water, deposit terms, or preferred visit time..."
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg resize-none"
              />

              {inquiryFeedback && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  {inquiryFeedback}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingInquiry}
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                {requestType === 'viewing' ? t('requestViewing') : 'Send Message'}
              </button>
            </form>

            {/* Share & Report */}
            <div className="pt-4 border-t border-zinc-100 flex items-center justify-between text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${listing.title} - ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-zinc-900"
                >
                  <Share2 className="w-3.5 h-3.5" /> WhatsApp
                </a>
                <span>·</span>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-zinc-900"
                >
                  Facebook
                </a>
                <span>·</span>
                <button
                  type="button"
                  onClick={copyLink}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <button
                type="button"
                onClick={() => (user ? setReportOpen(true) : onRequireAuth())}
                className="inline-flex items-center gap-1 text-zinc-500 hover:text-rose-600 cursor-pointer"
              >
                <Flag className="w-3.5 h-3.5" /> {t('report')}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Similar Listings */}
      {similar.length > 0 && (
        <section className="mt-14 pt-8 border-t border-zinc-200">
          <h2 className="text-xl font-bold text-zinc-900 mb-5">{t('similarListings')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {similar.map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
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
            onClick={() => setZoomOpen(false)}
            className="absolute top-4 right-4 p-2 text-white bg-white/10 rounded-full hover:bg-white/20 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
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
          <div className="bg-white rounded-xl border border-zinc-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-900">Report Listing</h3>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmitReport} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Reason</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  <option>Suspected scam or fake photos</option>
                  <option>Property already rented</option>
                  <option>Incorrect price or location</option>
                  <option>Harassment or offensive content</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Details</label>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide additional context for moderators..."
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                />
              </div>
              {reportDone && (
                <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                  {reportDone}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReportOpen(false)}
                  className="px-4 py-2 text-sm text-zinc-600 cursor-pointer"
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
    </div>
  );
};
