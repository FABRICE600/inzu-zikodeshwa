import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Home,
  Plus,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiRequest, ListingItem, UserProfile } from '../lib/api.ts';
import {
  AMENITIES_LIST,
  formatRwf,
  PROPERTY_TYPES,
  RENTAL_RULES,
  RWANDA_PROVINCES,
} from '../lib/rwandaData.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useLanguage } from '../context/LanguageContext.tsx';
import { LeafletMap } from '../components/LeafletMap.tsx';

interface PhotoDraft {
  url: string;
  isCover: boolean;
}

interface LandlordDashboardProps {
  onSelectListing: (id: number) => void;
}

const SAMPLE_PRESET_PHOTOS = [
  '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg',
  '/src/assets/images/listing_remera_studio_1795096234234.jpg',
  '/src/assets/images/listing_kacyiru_villa_1795096233974.jpg',
  '/src/assets/images/listing_huye_student_hostel_1795096233835.jpg',
];

export const LandlordDashboard: React.FC<LandlordDashboardProps> = ({ onSelectListing }) => {
  const { user, token, setUser } = useAuth();
  const { t } = useLanguage();

  const [tab, setTab] = useState<'listings' | 'form' | 'requests'>('listings');
  const [myListings, setMyListings] = useState<ListingItem[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Form state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState<ListingItem['propertyType']>('apartment');
  const [priceRwf, setPriceRwf] = useState('250000');
  const [depositRwf, setDepositRwf] = useState('250000');
  const [bedrooms, setBedrooms] = useState('2');
  const [bathrooms, setBathrooms] = useState('1');
  const [sizeSqm, setSizeSqm] = useState('65');
  const [furnished, setFurnished] = useState(false);
  const [province, setProvince] = useState('Kigali City');
  const [district, setDistrict] = useState('Gasabo');
  const [sector, setSector] = useState('Kimihurura');
  const [cell, setCell] = useState('');
  const [streetLandmark, setStreetLandmark] = useState('');
  const [coords, setCoords] = useState({ lat: -1.9536, lng: 30.0928 });
  const [amenities, setAmenities] = useState<string[]>(['water', 'electricity', 'internal_toilet', 'tiles']);
  const [rules, setRules] = useState<string[]>([]);
  const [availableFrom, setAvailableFrom] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<'available' | 'rented' | 'hidden'>('available');
  const [photos, setPhotos] = useState<PhotoDraft[]>([
    { url: SAMPLE_PRESET_PHOTOS[0], isCover: true },
  ]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const districtsForProvince = useMemo(
    () => Object.keys(RWANDA_PROVINCES[province] || {}),
    [province]
  );

  const sectorsForDistrict = useMemo(
    () => RWANDA_PROVINCES[province]?.[district] || [],
    [province, district]
  );

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [listRes, reqRes] = await Promise.all([
        apiRequest<{ items: ListingItem[] }>('/api/listings?mine=true&limit=50', { token }),
        apiRequest<{ items: any[] }>('/api/tenant/viewings', { token }),
      ]);
      setMyListings(listRes.items);
      setRequests(reqRes.items.filter((r) => r.landlordId === user?.id));
    } catch (err: any) {
      setError(err.message || 'Could not load landlord data.');
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpgradeRole = async () => {
    if (!token || !user) return;
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PUT',
        token,
        body: JSON.stringify({
          fullName: user.fullName,
          phone: user.phone || '',
          whatsapp: user.whatsapp || '',
          bio: user.bio || '',
          role: 'landlord',
        }),
      });
      setUser(res.user);
      setNotice('Your account is now enabled as a Landlord.');
    } catch (err: any) {
      setError(err.message || 'Could not switch role.');
    }
  };

  if (user && user.role === 'tenant') {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 space-y-4">
          <Home className="w-10 h-10 text-[#0D5C43] mx-auto" />
          <h1 className="text-xl font-bold text-zinc-900">Post Properties as a Landlord</h1>
          <p className="text-sm text-zinc-600">
            Your account is currently registered as a Tenant. Switch to a Landlord account to create and manage rental listings.
          </p>
          <button
            type="button"
            onClick={handleUpgradeRole}
            className="px-5 py-2.5 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg cursor-pointer"
          >
            Enable Landlord Account
          </button>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setPropertyType('apartment');
    setPriceRwf('250000');
    setDepositRwf('250000');
    setBedrooms('2');
    setBathrooms('1');
    setSizeSqm('65');
    setFurnished(false);
    setProvince('Kigali City');
    setDistrict('Gasabo');
    setSector('Kimihurura');
    setCell('');
    setStreetLandmark('');
    setCoords({ lat: -1.9536, lng: 30.0928 });
    setAmenities(['water', 'electricity', 'internal_toilet', 'tiles']);
    setRules([]);
    setAvailableFrom(new Date().toISOString().slice(0, 10));
    setStatus('available');
    setPhotos([{ url: SAMPLE_PRESET_PHOTOS[0], isCover: true }]);
  };

  const startEdit = (item: ListingItem) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setPropertyType(item.propertyType);
    setPriceRwf(String(item.priceRwf));
    setDepositRwf(String(item.depositRwf));
    setBedrooms(String(item.bedrooms));
    setBathrooms(String(item.bathrooms));
    setSizeSqm(item.sizeSqm ? String(item.sizeSqm) : '');
    setFurnished(item.furnished);
    setProvince(item.province);
    setDistrict(item.district);
    setSector(item.sector);
    setCell(item.cell || '');
    setStreetLandmark(item.streetLandmark);
    setCoords({ lat: item.latitude, lng: item.longitude });
    setAmenities(item.amenities || []);
    setRules(item.rules || []);
    setAvailableFrom(item.availableFrom);
    setStatus(item.status);
    setPhotos(
      item.photos.length > 0
        ? item.photos.map((p) => ({ url: p.url, isCover: p.isCover }))
        : [{ url: SAMPLE_PRESET_PHOTOS[0], isCover: true }]
    );
    setTab('form');
  };

  const handleUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;
    if (photos.length + files.length > 15) {
      setError('Maximum 15 photos per listing.');
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
    if (photos.length <= 1) {
      setError('At least 1 photo is required.');
      return;
    }
    setPhotos((prev) => {
      const filtered = prev.filter((_, idx) => idx !== index);
      if (!filtered.some((p) => p.isCover) && filtered.length > 0) {
        filtered[0].isCover = true;
      }
      return filtered;
    });
  };

  const handleSaveListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        title,
        description,
        propertyType,
        priceRwf: Number(priceRwf),
        depositRwf: Number(depositRwf) || 0,
        bedrooms: Number(bedrooms) || 0,
        bathrooms: Number(bathrooms) || 0,
        sizeSqm: sizeSqm ? Number(sizeSqm) : null,
        furnished,
        province,
        district,
        sector,
        cell,
        streetLandmark,
        latitude: coords.lat,
        longitude: coords.lng,
        amenities,
        rules,
        availableFrom,
        status,
        photos,
      };

      if (editingId) {
        await apiRequest(`/api/listings/${editingId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        setNotice('Listing updated.');
      } else {
        await apiRequest('/api/listings', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setNotice('Listing created and submitted for admin approval.');
      }
      resetForm();
      setTab('listings');
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Could not save listing.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: number, nextStatus: 'available' | 'rented' | 'hidden') => {
    if (!token) return;
    await apiRequest(`/api/listings/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadData();
  };

  const handleDuplicate = async (id: number) => {
    if (!token) return;
    await apiRequest(`/api/listings/${id}/duplicate`, { method: 'POST', token });
    setNotice('Listing duplicated as paused draft.');
    await loadData();
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await apiRequest(`/api/listings/${id}`, { method: 'DELETE', token });
    await loadData();
  };

  const handleViewingDecision = async (id: number, decision: 'confirmed' | 'declined') => {
    if (!token) return;
    await apiRequest(`/api/tenant/viewings/${id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ status: decision }),
    });
    await loadData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Landlord Workspace</h1>
          <p className="text-sm text-zinc-500">
            Manage rental listings, photos, map locations, and tenant viewing requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex bg-zinc-100 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('listings')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'listings' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
              }`}
            >
              My Listings ({myListings.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('requests')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                tab === 'requests' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600'
              }`}
            >
              Viewing Requests ({requests.length})
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              setTab('form');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> New Listing
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 text-sm bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 text-sm bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          {notice}
        </div>
      )}

      {tab === 'listings' && (
        <div className="space-y-4">
          {loading ? (
            <div className="h-40 bg-zinc-200 rounded-xl animate-pulse" />
          ) : myListings.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
              <p className="font-semibold text-zinc-900">You have not posted any properties yet.</p>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setTab('form');
                }}
                className="mt-4 px-4 py-2 bg-[#0D5C43] text-white text-sm font-semibold rounded-lg cursor-pointer"
              >
                Create Your First Listing
              </button>
            </div>
          ) : (
            myListings.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-zinc-200 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <img
                    src={item.coverPhoto || SAMPLE_PRESET_PHOTOS[0]}
                    alt={item.title}
                    className="w-28 h-20 object-cover rounded-lg border border-zinc-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-500">
                      {t(`type_${item.propertyType}`)} · {item.sector}, {item.district} · Approval:{' '}
                      <span className="font-semibold capitalize text-zinc-800">
                        {item.approvalStatus}
                      </span>{' '}
                      · Status:{' '}
                      <span className="font-semibold capitalize text-zinc-800">{item.status}</span>
                    </div>
                    <h3
                      onClick={() => onSelectListing(item.id)}
                      className="text-base font-bold text-zinc-900 hover:text-[#0D5C43] cursor-pointer truncate mt-0.5"
                    >
                      {item.title}
                    </h3>
                    <div className="text-sm font-mono tabular-nums font-semibold text-[#0D5C43] mt-1">
                      {formatRwf(item.priceRwf)} / mo · {item.viewsCount} views
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit
                  </button>

                  {item.status === 'available' ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, 'hidden')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                    >
                      <EyeOff className="w-3.5 h-3.5" /> Pause
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, 'available')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Republish
                    </button>
                  )}

                  {item.status !== 'rented' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item.id, 'rented')}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> Mark Rented
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDuplicate(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center text-sm text-zinc-500">
              No viewing requests or inquiries received yet.
            </div>
          ) : (
            requests.map((r) => (
              <div
                key={r.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500">
                    {r.requestType === 'viewing' ? 'Viewing Request' : 'Direct Message'} ·{' '}
                    <span className="font-semibold capitalize text-zinc-800">{r.status}</span>
                    {r.preferredDate ? ` · Requested: ${r.preferredDate} ${r.preferredTime || ''}` : ''}
                  </div>
                  <div className="text-sm font-bold text-zinc-900">
                    {r.tenant?.fullName} ({r.tenant?.phone || 'No phone'}) —{' '}
                    <span className="font-normal text-zinc-600">{r.listing?.title}</span>
                  </div>
                  <p className="text-sm text-zinc-700">{r.message}</p>
                </div>

                {r.status === 'pending' && (
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleViewingDecision(r.id, 'confirmed')}
                      className="px-3.5 py-2 text-xs font-semibold bg-[#0D5C43] text-white rounded-lg cursor-pointer"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleViewingDecision(r.id, 'declined')}
                      className="px-3.5 py-2 text-xs font-semibold border border-zinc-200 text-zinc-700 rounded-lg cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'form' && (
        <form
          onSubmit={handleSaveListing}
          className="bg-white border border-zinc-200 rounded-xl p-6 space-y-6"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-lg font-bold text-zinc-900">
              {editingId ? 'Edit Listing' : 'Post a New Rental Property'}
            </h2>
            <button
              type="button"
              onClick={() => setTab('listings')}
              className="text-sm text-zinc-500 hover:text-zinc-900 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Title</label>
              <input
                type="text"
                required
                minLength={5}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Modern 2-Bedroom Apartment in Kimihurura"
                className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 mb-1">Description</label>
              <textarea
                rows={4}
                required
                minLength={15}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe water supply, electricity meter, neighborhood safety, transport access..."
                className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">Property Type</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as ListingItem['propertyType'])}
                className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {t(`type_${pt}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Monthly Rent (RWF)
              </label>
              <input
                type="number"
                required
                min={5000}
                value={priceRwf}
                onChange={(e) => setPriceRwf(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Deposit Amount (RWF)
              </label>
              <input
                type="number"
                min={0}
                value={depositRwf}
                onChange={(e) => setDepositRwf(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg font-mono tabular-nums"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Beds</label>
                <input
                  type="number"
                  min={0}
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Baths</label>
                <input
                  type="number"
                  min={0}
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Size m²</label>
                <input
                  type="number"
                  min={1}
                  value={sizeSqm}
                  onChange={(e) => setSizeSqm(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-600 mb-1">
                Available From
              </label>
              <input
                type="date"
                required
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-zinc-200 rounded-lg"
              />
            </div>

            <div className="flex items-center gap-6 pt-5">
              <label className="inline-flex items-center gap-2 text-sm text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={furnished}
                  onChange={(e) => setFurnished(e.target.checked)}
                  className="w-4 h-4 accent-[#0D5C43]"
                />
                Furnished Property
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
              >
                <option value="available">Available</option>
                <option value="hidden">Hidden / Draft</option>
                <option value="rented">Rented</option>
              </select>
            </div>
          </div>

          {/* Location Fields + Interactive Map Pin */}
          <div className="pt-4 border-t border-zinc-200 space-y-4">
            <h3 className="text-sm font-bold text-zinc-900">Rwanda Location & Exact Map Pin</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Province</label>
                <select
                  value={province}
                  onChange={(e) => {
                    const p = e.target.value;
                    const firstDist = Object.keys(RWANDA_PROVINCES[p] || {})[0] || '';
                    const firstSec = RWANDA_PROVINCES[p]?.[firstDist]?.[0] || '';
                    setProvince(p);
                    setDistrict(firstDist);
                    setSector(firstSec);
                  }}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  {Object.keys(RWANDA_PROVINCES).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">District</label>
                <select
                  value={district}
                  onChange={(e) => {
                    const d = e.target.value;
                    setDistrict(d);
                    setSector(RWANDA_PROVINCES[province]?.[d]?.[0] || '');
                  }}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  {districtsForProvince.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Sector</label>
                <select
                  value={sector}
                  onChange={(e) => setSector(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg bg-white"
                >
                  {sectorsForDistrict.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">Cell</label>
                <input
                  type="text"
                  value={cell}
                  onChange={(e) => setCell(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Street / Landmark
                </label>
                <input
                  type="text"
                  required
                  value={streetLandmark}
                  onChange={(e) => setStreetLandmark(e.target.value)}
                  placeholder="e.g. KG 624 St"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg"
                />
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500 mb-2 font-mono">
                Click on the map or drag the green pin to set exact coordinates ({coords.lat},{' '}
                {coords.lng})
              </p>
              <LeafletMap
                mode="picker"
                selectedPosition={coords}
                onPickPosition={(lat, lng) => setCoords({ lat, lng })}
                className="h-64 w-full rounded-xl border border-zinc-200 overflow-hidden"
              />
            </div>
          </div>

          {/* Photos Upload, Reorder & Cover Selection */}
          <div className="pt-4 border-t border-zinc-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">
                  Photos ({photos.length}/15)
                </h3>
                <p className="text-xs text-zinc-500">
                  Upload 1 to 15 photos, reorder them, and select the cover image.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-zinc-900 text-white rounded-lg cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                {uploading ? 'Uploading...' : 'Upload Photos'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadPhotos}
                  className="hidden"
                />
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              {photos.map((photo, idx) => (
                <div
                  key={`${photo.url}-${idx}`}
                  className={`border rounded-lg overflow-hidden bg-zinc-50 ${
                    photo.isCover ? 'border-[#0D5C43] ring-1 ring-[#0D5C43]' : 'border-zinc-200'
                  }`}
                >
                  <img src={photo.url} alt="" className="w-full h-24 object-cover" />
                  <div className="p-1.5 flex items-center justify-between gap-1 bg-white">
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => movePhoto(idx, -1)}
                        disabled={idx === 0}
                        className="p-1 text-zinc-600 hover:bg-zinc-100 rounded disabled:opacity-30 cursor-pointer"
                        title="Move left"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePhoto(idx, 1)}
                        disabled={idx === photos.length - 1}
                        className="p-1 text-zinc-600 hover:bg-zinc-100 rounded disabled:opacity-30 cursor-pointer"
                        title="Move right"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoverPhoto(idx)}
                      className={`text-[11px] font-medium px-1.5 py-0.5 rounded cursor-pointer ${
                        photo.isCover ? 'text-[#0D5C43] font-bold' : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      <Star className={`w-3 h-3 inline mr-0.5 ${photo.isCover ? 'fill-[#0D5C43]' : ''}`} />
                      {photo.isCover ? 'Cover' : 'Set'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(idx)}
                      className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Amenities & Rules */}
          <div className="pt-4 border-t border-zinc-200 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-bold text-zinc-900 mb-2">Amenities</h3>
              <div className="grid grid-cols-2 gap-2">
                {AMENITIES_LIST.map((a) => (
                  <label key={a} className="inline-flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
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
              <h3 className="text-sm font-bold text-zinc-900 mb-2">Rental Rules</h3>
              <div className="grid grid-cols-2 gap-2">
                {RENTAL_RULES.map((r) => (
                  <label key={r} className="inline-flex items-center gap-2 text-xs text-zinc-700 cursor-pointer">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setTab('listings')}
              className="px-4 py-2.5 text-sm font-medium text-zinc-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#0D5C43] hover:bg-[#094431] text-white text-sm font-semibold rounded-lg cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Listing'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
