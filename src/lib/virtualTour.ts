import { ListingItem } from './api.ts';

export interface TourStop {
  id: string;
  label: string;
  photoUrl: string;
  description: string;
  defaultAngle: number;
}

/**
 * Determines whether a property qualifies for the 360° interactive virtual tour.
 * Houses, apartments, and commercial spaces—or furnished/multi-photo properties—qualify.
 */
export function hasVirtualTour(listing: ListingItem): boolean {
  if (!listing) return false;
  if (
    listing.propertyType === 'house' ||
    listing.propertyType === 'apartment' ||
    listing.propertyType === 'commercial'
  ) {
    return true;
  }
  if ((listing.photos?.length || 0) >= 2 || listing.furnished) {
    return true;
  }
  return false;
}

export function buildTourStops(listing: ListingItem): TourStop[] {
  const fallbackPool = [
    '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg',
    '/src/assets/images/listing_kacyiru_villa_1795096233974.jpg',
    '/src/assets/images/listing_remera_studio_1795096234234.jpg',
    '/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg',
  ];

  const photos = listing.photos?.length
    ? listing.photos.map((p) => p.url)
    : listing.coverPhoto
    ? [listing.coverPhoto]
    : [fallbackPool[0]];

  const pickPhoto = (idx: number) => photos[idx % photos.length] || fallbackPool[idx % fallbackPool.length];

  const isCommercial = listing.propertyType === 'commercial';

  return [
    {
      id: 'main',
      label: isCommercial ? 'Main Showroom & Entrance' : 'Living Area & Front View',
      photoUrl: pickPhoto(0),
      description: `${listing.sector}, ${listing.district} — ${listing.streetLandmark}`,
      defaultAngle: 15,
    },
    {
      id: 'interior',
      label: isCommercial ? 'Workspaces & Hall' : 'Kitchen & Interior Finish',
      photoUrl: pickPhoto(1),
      description: listing.furnished
        ? 'Furnished interior with tiled floors and natural daylight.'
        : 'Spacious tiled interior ready for custom setup.',
      defaultAngle: 120,
    },
    {
      id: 'surroundings',
      label: 'Compound & Neighborhood',
      photoUrl: photos.length > 2 ? pickPhoto(2) : '/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg',
      description: `Surroundings in ${listing.district} (${listing.province})`,
      defaultAngle: 245,
    },
  ];
}
