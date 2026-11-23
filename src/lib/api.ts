export interface UserProfile {
  id: number;
  uid: string;
  role: 'tenant' | 'landlord' | 'admin';
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  photoUrl: string | null;
  bio: string | null;
  phoneVerified: boolean;
  isSuspended: boolean;
  createdAt: string;
}

export interface ListingPhoto {
  id: number;
  listingId: number;
  url: string;
  displayOrder: number;
  isCover: boolean;
}

export interface ListingItem {
  id: number;
  landlordId: number;
  title: string;
  description: string;
  propertyType: 'house' | 'apartment' | 'single_room' | 'shared_room' | 'studio' | 'hostel' | 'commercial';
  priceRwf: number;
  depositRwf: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number | null;
  furnished: boolean;
  province: string;
  district: string;
  sector: string;
  cell: string | null;
  streetLandmark: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  rules: string[];
  availableFrom: string;
  status: 'available' | 'rented' | 'hidden';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  photos: ListingPhoto[];
  coverPhoto: string;
  distanceKm?: number | null;
  landlord?: {
    id: number;
    fullName: string;
    phone: string | null;
    whatsapp: string | null;
    photoUrl: string | null;
    bio: string | null;
    phoneVerified: boolean;
  } | null;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token, headers, body, ...rest } = options;
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const mergedHeaders: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(headers as Record<string, string>),
  };

  if (token) {
    mergedHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    ...rest,
    headers: mergedHeaders,
    body,
  });

  const rawText = await res.text().catch(() => '');
  let data: any = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = {};
    }
  }
  if (!res.ok) {
    const fallbackText =
      !data.error && rawText && !rawText.trim().startsWith('<')
        ? rawText.trim().slice(0, 180)
        : '';
    throw new Error(data.error || fallbackText || `Request failed (${res.status})`);
  }
  return data as T;
}
