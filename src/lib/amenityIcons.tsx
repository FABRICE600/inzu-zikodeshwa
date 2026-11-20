import React from 'react';
import {
  Armchair,
  Bath,
  Car,
  Check,
  Droplets,
  Grid2x2,
  Lock,
  ShieldCheck,
  Sun,
  Trees,
  Utensils,
  Wifi,
  Zap,
} from 'lucide-react';

export const PRIORITY_AMENITIES = [
  'wifi',
  'parking',
  'security',
  'water',
  'electricity',
  'kitchen',
  'furniture',
  'internal_toilet',
  'garden',
  'balcony',
  'fence',
  'tiles',
] as const;

export function sortAmenitiesForDisplay(amenities: string[]): string[] {
  const rank = new Map<string, number>(PRIORITY_AMENITIES.map((a, idx) => [a, idx]));
  return [...amenities].sort((a, b) => (rank.get(a) ?? 99) - (rank.get(b) ?? 99));
}

export function renderAmenityIcon(amenity: string, className = 'w-3.5 h-3.5 text-[#0D5C43] shrink-0'): React.ReactNode {
  switch (amenity) {
    case 'wifi':
      return <Wifi className={className} aria-hidden="true" />;
    case 'parking':
      return <Car className={className} aria-hidden="true" />;
    case 'security':
      return <ShieldCheck className={className} aria-hidden="true" />;
    case 'water':
      return <Droplets className={className} aria-hidden="true" />;
    case 'electricity':
      return <Zap className={className} aria-hidden="true" />;
    case 'fence':
      return <Lock className={className} aria-hidden="true" />;
    case 'kitchen':
      return <Utensils className={className} aria-hidden="true" />;
    case 'balcony':
      return <Sun className={className} aria-hidden="true" />;
    case 'garden':
      return <Trees className={className} aria-hidden="true" />;
    case 'furniture':
      return <Armchair className={className} aria-hidden="true" />;
    case 'internal_toilet':
      return <Bath className={className} aria-hidden="true" />;
    case 'tiles':
      return <Grid2x2 className={className} aria-hidden="true" />;
    default:
      return <Check className={className} aria-hidden="true" />;
  }
}
