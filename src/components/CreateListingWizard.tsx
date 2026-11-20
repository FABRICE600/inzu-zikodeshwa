import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MapPin,
  Save,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest, ListingItem } from '../lib/api.ts';
import {
  AMENITIES_LIST,
  formatRwf,
  PROPERTY_TYPES,
  RENTAL_RULES,
  RWANDA_PROVINCES,
} from '../lib/rwandaData.ts';
import { useLanguage } from '../context/LanguageContext.tsx';
import { LeafletMap } from './LeafletMap.tsx';

export interface PhotoDraft {
  url: string;
  isCover: boolean;
}

interface CreateListingWizardProps {
  token: string;
  initialListing?: ListingItem | null;
  onSaved: (listing: ListingItem, mode: 'draft' | 'publish') => void;
  onCancel: () => void;
}

const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Gasabo: { lat: -1.9441, lng: 30.0956 },
  Kicukiro: { lat: -1.9781, lng: 30.1045 },
  Nyarugenge: { lat: -1.9536, lng: 30.0606 },
  Huye: { lat: -2.5969, lng: 29.7394 },
  Muhanga: { lat: -2.0744, lng: 29.7567 },
  Nyanza: { lat: -2.3519, lng: 29.7509 },
  Musanze: { lat: -1.4998, lng: 29.6349 },
  Gicumbi: { lat: -1.5763, lng: 30.0675 },
  Rubavu: { lat: -1.6771, lng: 29.266 },
  Rusizi: { lat: -2.4846, lng: 28.9075 },
  Rwamagana: { lat: -1.9487, lng: 30.4347 },
  Kayonza: { lat: -1.8943, lng: 30.5172 },
  Bugesera: { lat: -2.1449, lng: 30.0928 },
};

const STEPS = [
  { id: 1, label: '01. Basics & Pricing' },
  { id: 2, label: '02. Location & Map' },
  { id: 3, label: '03. Media & Features' },
  { id: 4, label: '04. Review & Save' },
] as const;

export const CreateListingWizard: React.FC<CreateListingWizardProps> = ({
  token,
  initialListing,
  onSaved,
  onCancel,
}) => {
  const { t } = useLanguage();

  const [step, setStep] = useState<number>(1);
  const [draftId, setDraftId] = useState<number | null>(initialListing?.id ?? null);

  // Step 1: Basics & Pricing
  const [title, setTitle] = useState(initialListing?.title || '');
  const [propertyType, setPropertyType] = useState<ListingItem['propertyType']>(
    initialListing?.propertyType || 'apartment'
  );
  const [description, setDescription] = useState(initialListing?.description || '');
  const [priceRwf, setPriceRwf] = useState(
    initialListing ? String(initialListing.priceRwf) : '250000'
  );
  const [depositRwf, setDepositRwf] = useState(
    initialListing ? String(initialListing.depositRwf) : '250000'
  );
  const [bedrooms, setBedrooms] = useState(
    initialListing ? String(initialListing.bedrooms) : '2'
  );
  const [bathrooms, setBathrooms] = useState(
    initialListing ? String(initialListing.bathrooms) : '1'
  );
  const [sizeSqm, setSizeSqm] = useState(
    initialListing?.sizeSqm ? String(initialListing.sizeSqm) : '65'
  );
  const [furnished, setFurnished] = useState(initialListing?.furnished ?? false);
  const [availableFrom, setAvailableFrom] = useState(
    initialListing?.availableFrom || new Date().toISOString().slice(0, 10)
  );

  // Step 2: Location & Map
  const [province, setProvince] = useState(initialListing?.province || 'Kigali City');
  const [district, setDistrict] = useState(initialListing?.district || 'Gasabo');
  const [sector, setSector] = useState(initialListing?.sector || 'Kimihurura');
  const [cell, setCell] = useState(initialListing?.cell || '');
  const [streetLandmark, setStreetLandmark] = useState(initialListing?.streetLandmark || '');
  const [coords, setCoords] = useState({
    lat: initialListing?.latitude ?? -1.9536,
    lng: initialListing?.longitude ?? 30.0928,
  });

  // Step 3: Media & Features
  const [photos, setPhotos] = useState<PhotoDraft[]>(
    initialListing?.photos?.length
      ? initialListing.photos.map((p) => ({ url: p.url, isCover: p.isCover }))
      : []
  );
  const [amenities, setAmenities] = useState<string[]>(
    initialListing?.amenities || ['water', 'electricity', 'internal_toilet', 'tiles']
  );
  const [rules, setRules] = useState<string[]>(initialListing?.rules || []);
  const [status, setStatus] = useState<'available' | 'rented' | 'hidden'>(
    initialListing?.status || 'available'
  );

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [draftNotice, setDraftNotice] = useState('');

  const districtsForProvince = useMemo(
    () => Object.keys(RWANDA_PROVINCES[province] || {}),
    [province]
  );

  const sectorsForDistrict = useMemo(
    () => RWANDA_PROVINCES[province]?.[district] || [],
    [province, district]
  );

  const validateStep = (targetStep: number): string | null => {
    if (targetStep === 1) {
      if (title.trim().length < 5) return 'Please enter a listing title (at least 5 characters).';
      if (description.trim().length < 15) return 'Please write a short description (at least 15 characters).';
      if (!priceRwf || Number(priceRwf) < 5000) return 'Monthly rent must be at least 5,000 RWF.';
    }
    if (targetStep === 2) {
      if (!district || !sector) return 'Please select a district and sector.';
      if (streetLandmark.trim().length < 2) return 'Please enter a street name or nearby landmark.';
    }
    if (targetStep === 3) {
      if (photos.length < 1) return 'Please upload at least 1 property photo before continuing.';
    }
    return null;
  };

  const handleNext = () => {
    setError('');
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => Math.min(4, s + 1));
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 15) {
      setError('Maximum 15 photos allowed per listing.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append('photos', file));
      const res = await apiRequest<{ urls: string[] }>('/api/listings/upload', {
        method: 'POST',
        token,
        body: form,
      });
      setPhotos((prev) => [
        ...prev,
        ...res.urls.map((url, idx) => ({ url, isCover: prev.length === 0 && idx === 0 })),
      ]);
    } catch (err: any) {
      setError(err.message || 'Photo upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    const copy = [...photos];
    const [moved] = copy.splice(index, 1);
    copy.splice(nextIndex, 0, moved);
    setPhotos(copy);
  };

  const setCoverPhoto = (index: number) => {
    setPhotos((prev) => prev.map((p, idx) => ({ ...p, isCover: idx === index })));
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      if (!filtered.some((p) => p.isCover) && filtered.length > 0) {
        filtered[0].isCover = true;
      }
      return filtered;
    });
  };

  const buildPayload = (isDraft: boolean) => ({
    ...(isDraft ? { isDraft: true } : {}),
    title: title.trim(),
    description: description.trim(),
    propertyType,
    priceRwf: Number(priceRwf) || 0,
    depositRwf: Number(depositRwf) || 0,
    bedrooms: Number(bedrooms) || 0,
    bathrooms: Number(bathrooms) || 0,
    sizeSqm: sizeSqm ? Number(sizeSqm) : null,
    furnished,
    province,
    district,
    sector,
    cell: cell.trim(),
    streetLandmark: streetLandmark.trim(),
    latitude: coords.lat,
    longitude: coords.lng,
    amenities,
    rules,
    availableFrom,
    status: isDraft ? 'hidden' : status,
    photos,
  });

  const handleSaveDraft = async () => {
    setError('');
    setDraftNotice('');
    if (title.trim().length < 2) {
      setError('Enter a listing title (at least 2 characters) to save your draft.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(true);
      const res = draftId
        ? await apiRequest<{ listing: ListingItem }>(`/api/listings/${draftId}`, {
            method: 'PUT',
            token,
            body: JSON.stringify(payload),
          })
        : await apiRequest<{ listing: ListingItem }>('/api/listings', {
            method: 'POST',
            token,
            body: JSON.stringify(payload),
          });

      setDraftId(res.listing.id);
      setDraftNotice(`Draft #${res.listing.id} saved to your Landlord Workspace.`);
      onSaved(res.listing, 'draft');
    } catch (err: any) {
      setError(err.message || 'Could not save draft.');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    for (const s of [1, 2, 3]) {
      const err = validateStep(s);
      if (err) {
        setStep(s);
        setError(err);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(false);
      const res = draftId
        ? await apiRequest<{ listing: ListingItem }>(`/api/listings/${draftId}`, {
            method: 'PUT',
            token,
            body: JSON.stringify(payload),
          })
        : await apiRequest<{ listing: ListingItem }>('/api/listings', {
            method: 'POST',
            token,
            body: JSON.stringify(payload),
          });

      onSaved(res.listing, 'publish');
    } catch (err: any) {
      setError(err.message || 'Could not publish listing.');
    } finally {
      setSubmitting(false);
    }
  };

  const coverPhoto = photos.find((p) => p.isCover)?.url || photos[0]?.url || '';

  return (
    <div className="bg-white dark:bg-[#161b19] border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
      {/* Wizard Header & Persistent Save Draft */}
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-900/60">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            {initialListing ? `Edit Listing #${initialListing.id}` : 'Create Listing Wizard'}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {draftId ? `Saved as draft #${draftId}` : 'Complete the 4 steps or save a draft anytime.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            Save Draft
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Step Navigation Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161b19]">
        {STEPS.map((item) => {
          const active = step === item.id;
          const completed = step > item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setError('');
                if (item.id <= step) {
                  setStep(item.id);
                  return;
                }
                for (let s = step; s < item.id; s++) {
                  const err = validateStep(s);
                  if (err) {
                    setStep(s);
                    setError(err);
                    return;
                  }
                }
                setStep(item.id);
              }}
              className={`px-4 py-3 text-left text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center justify-between ${
                active
                  ? 'border-[#0D5C43] dark:border-emerald-400 text-[#0D5C43] dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/30'
                  : completed
                  ? 'border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                  : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {completed && <Check className="w-3.5 h-3.5 text-[#0D5C43] dark:text-emerald-400 shrink-0" />}
            </button>
          );
        })}
      </div>

      <form onSubmit={handlePublish} className="p-6 space-y-6">
        {error && (
          <div className="p-3 text-sm bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 rounded-lg">
            {error}
          </div>
        )}
        {draftNotice && (
          <div className="p-3 text-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg">
            {draftNotice}
          </div>
        )}

        {/* STEP 1: Basics & Pricing */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Listing Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Sunlit 2-Bedroom Apartment Near Kigali Convention Centre"
                className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[#0D5C43] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
                Property Type *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PROPERTY_TYPES.map((pt) => {
                  const selected = propertyType === pt;
                  return (
                    <button
                      key={pt}
                      type="button"
                      onClick={() => setPropertyType(pt)}
                      className={`px-3 py-2.5 text-xs font-semibold rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#0D5C43] text-white border-[#0D5C43]'
                          : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {t(`type_${pt}`)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Property Description *
              </label>
              <textarea
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe water reliability, CashPower meter, security, distance to paved road or bus stop..."
                className="w-full px-3.5 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:border-[#0D5C43] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Monthly Rent (RWF) *
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={priceRwf}
                  onChange={(e) => setPriceRwf(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Deposit Amount (RWF)
                </label>
                <input
                  type="number"
                  min={0}
                  step={5000}
                  value={depositRwf}
                  onChange={(e) => setDepositRwf(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Available From
                </label>
                <input
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={furnished}
                    onChange={(e) => setFurnished(e.target.checked)}
                    className="w-4 h-4 accent-[#0D5C43]"
                  />
                  Furnished Property
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 max-w-md">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Bedrooms</label>
                <input
                  type="number"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Bathrooms</label>
                <input
                  type="number"
                  min={0}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Size (m²)</label>
                <input
                  type="number"
                  min={1}
                  value={sizeSqm}
                  onChange={(e) => setSizeSqm(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Location & Map Pin */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Province</label>
                <select
                  value={province}
                  onChange={(e) => {
                    const p = e.target.value;
                    const firstDist = Object.keys(RWANDA_PROVINCES[p] || {})[0] || '';
                    const firstSec = RWANDA_PROVINCES[p]?.[firstDist]?.[0] || '';
                    setProvince(p);
                    setDistrict(firstDist);
                    setSector(firstSec);
                    if (DISTRICT_COORDS[firstDist]) setCoords(DISTRICT_COORDS[firstDist]);
                  }}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {Object.keys(RWANDA_PROVINCES).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">District *</label>
                <select
                  value={district}
                  onChange={(e) => {
                    const d = e.target.value;
                    setDistrict(d);
                    setSector(RWANDA_PROVINCES[province]?.[d]?.[0] || '');
                    if (DISTRICT_COORDS[d]) setCoords(DISTRICT_COORDS[d]);
                  }}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {districtsForProvince.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Sector *</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  {sectorsForDistrict.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Cell (Akagari)
                </label>
                <input
                  type="text"
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  placeholder="e.g. Rugando"
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                  Street / Nearby Landmark *
                </label>
                <input
                  type="text"
                  value={streetLandmark}
                  onChange={(e) => setStreetLandmark(e.target.value)}
                  placeholder="e.g. KG 624 St, 300m from KCC roundabout"
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 inline-flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0D5C43] dark:text-emerald-400" />
                  Click the map or drag the pin to set exact coordinates
                </span>
                <span className="text-xs font-mono tabular-nums text-zinc-500 dark:text-zinc-400">
                  Lat {coords.lat} · Lng {coords.lng}
                </span>
              </div>
              <LeafletMap
                mode="picker"
                selectedPosition={coords}
                onPickPosition={(lat, lng) => setCoords({ lat, lng })}
                className="h-72 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden"
              />
            </div>
          </div>
        )}

        {/* STEP 3: Upload Media, Reorder & Amenities/Rules */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 rounded-xl p-6 text-center bg-zinc-50/60 dark:bg-zinc-900/50">
              <Upload className="w-7 h-7 text-zinc-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                Upload 1 to 15 Property Photos ({photos.length}/15)
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 mb-4">
                JPG, PNG, or WEBP up to 5 MB each. Reorder photos or pick your cover image below.
              </p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-semibold rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading photos...' : 'Select Photos from Device'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadPhotos}
                  className="hidden"
                />
              </label>
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map((photo, idx) => (
                  <div
                    key={`${photo.url}-${idx}`}
                    className={`border rounded-lg overflow-hidden bg-zinc-50 dark:bg-zinc-900 ${
                      photo.isCover ? 'border-[#0D5C43] ring-1 ring-[#0D5C43]' : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    <img src={photo.url} alt={`Upload ${idx + 1}`} className="w-full h-28 object-cover" />
                    <div className="p-1.5 flex items-center justify-between gap-1 bg-white dark:bg-zinc-900">
                      <div className="flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => movePhoto(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePhoto(idx, 1)}
                          disabled={idx === photos.length - 1}
                          className="p-1 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCoverPhoto(idx)}
                        className={`text-[11px] font-medium px-1.5 py-0.5 rounded cursor-pointer ${
                          photo.isCover
                            ? 'text-[#0D5C43] dark:text-emerald-400 font-bold'
                            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                        }`}
                      >
                        <Star
                          className={`w-3 h-3 inline mr-0.5 ${photo.isCover ? 'fill-[#0D5C43] dark:fill-emerald-400' : ''}`}
                        />
                        {photo.isCover ? 'Cover' : 'Set'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">Amenities</h3>
                <div className="grid grid-cols-2 gap-2">
                  {AMENITIES_LIST.map((a) => (
                    <label
                      key={a}
                      className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={amenities.includes(a)}
                        onChange={() =>
                          setAmenities((prev) =>
                            prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]
                          )
                        }
                        className="accent-[#0D5C43]"
                      />
                      {t(`amenity_${a}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white mb-2">Rental Rules</h3>
                <div className="grid grid-cols-2 gap-2">
                  {RENTAL_RULES.map((r) => (
                    <label
                      key={r}
                      className="inline-flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={rules.includes(r)}
                        onChange={() =>
                          setRules((prev) =>
                            prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
                          )
                        }
                        className="accent-[#0D5C43]"
                      />
                      {t(`rule_${r}`)}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Review & Publish */}
        {step === 4 && (
          <div className="space-y-5">
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 flex flex-col sm:flex-row gap-5 bg-zinc-50/50 dark:bg-zinc-900/50">
              {coverPhoto && (
                <img
                  src={coverPhoto}
                  alt={title}
                  className="w-full sm:w-48 h-36 object-cover rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0"
                />
              )}
              <div className="space-y-2 flex-1">
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {t(`type_${propertyType}`)} · {sector}, {district} ({province})
                </div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{title}</h3>
                <div className="text-base font-bold text-[#0D5C43] dark:text-emerald-400 font-mono tabular-nums">
                  {formatRwf(Number(priceRwf) || 0)} / mo
                  <span className="text-xs font-normal text-zinc-500 dark:text-zinc-400 ml-2">
                    Deposit: {formatRwf(Number(depositRwf) || 0)}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">{description}</p>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 pt-1">
                  {bedrooms} Bedrooms · {bathrooms} Bathrooms · {photos.length} Photo(s) ·{' '}
                  {amenities.length} Amenities
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Publish Status:</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                >
                  <option value="available">Available (Submit for Approval)</option>
                  <option value="hidden">Hidden / Keep as Draft</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => {
              setError('');
              setStep((s) => Math.max(1, s - 1));
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <div className="flex items-center gap-2.5">
            {step < 4 ? (
              <button
                type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 rounded-lg cursor-pointer"
              >
                Next Step <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold bg-[#0D5C43] hover:bg-[#094431] text-white rounded-lg cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {submitting
                  ? 'Saving...'
                  : initialListing
                  ? 'Update Listing'
                  : 'Publish Listing'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};
