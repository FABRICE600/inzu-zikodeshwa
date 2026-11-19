export interface LandmarkPoint {
  id: string;
  name: string;
  district: string;
  category: 'university' | 'landmark';
  lat: number;
  lng: number;
}

export const RWANDA_PROVINCES: Record<string, Record<string, string[]>> = {
  'Kigali City': {
    Gasabo: ['Kimihurura', 'Kacyiru', 'Remera', 'Gisozi', 'Kinyinya', 'Kimironko', 'Bumbogo', 'Rusororo'],
    Kicukiro: ['Kicukiro', 'Niboye', 'Kanombe', 'Kagarama', 'Gikondo', 'Gatenga', 'Masaka'],
    Nyarugenge: ['Nyarugenge', 'Nyamirambo', 'Muhima', 'Kigali', 'Gitega', 'Kimisagara', 'Rwezamenyo'],
  },
  'Southern Province': {
    Huye: ['Ngoma', 'Tumba', 'Huye', 'Mbazi', 'Mukura'],
    Muhanga: ['Nyamabuye', 'Shyogwe', 'Cyeza'],
    Nyanza: ['Busasamana', 'Mukingo'],
  },
  'Northern Province': {
    Musanze: ['Muhoza', 'Cyuve', 'Kinigi', 'Busogo'],
    Gicumbi: ['Byumba', 'Kageyo'],
  },
  'Western Province': {
    Rubavu: ['Gisenyi', 'Nyamyumba', 'Rugerero'],
    Rusizi: ['Kamembe', 'Gihundwe'],
  },
  'Eastern Province': {
    Rwamagana: ['Kigabiro', 'Muhazi'],
    Kayonza: ['Mukarange', 'Nyamirama'],
    Bugesera: ['Nyamata', 'Mayange'],
  },
};

export const RWANDA_LANDMARKS: LandmarkPoint[] = [
  { id: 'ur-nyarugenge', name: 'University of Rwanda (Nyarugenge / CST)', district: 'Nyarugenge', category: 'university', lat: -1.9585, lng: 30.0645 },
  { id: 'ur-remera', name: 'University of Rwanda (Remera Campus)', district: 'Gasabo', category: 'university', lat: -1.9571, lng: 30.1149 },
  { id: 'ur-huye', name: 'University of Rwanda (Huye Campus)', district: 'Huye', category: 'university', lat: -2.6152, lng: 29.7405 },
  { id: 'kepler', name: 'Kepler College (Kinyinya)', district: 'Gasabo', category: 'university', lat: -1.9182, lng: 30.1068 },
  { id: 'alu', name: 'African Leadership University (Bumbogo)', district: 'Gasabo', category: 'university', lat: -1.9309, lng: 30.1525 },
  { id: 'ines', name: 'INES-Ruhengeri (Musanze)', district: 'Musanze', category: 'university', lat: -1.5036, lng: 29.6134 },
  { id: 'auca', name: 'AUCA Gishushu / Masoro', district: 'Gasabo', category: 'university', lat: -1.9554, lng: 30.1037 },
  { id: 'kcc', name: 'Kigali Convention Centre (Kimihurura)', district: 'Gasabo', category: 'landmark', lat: -1.9546, lng: 30.0938 },
  { id: 'kimironko-market', name: 'Kimironko Market', district: 'Gasabo', category: 'landmark', lat: -1.9489, lng: 30.1264 },
  { id: 'nyabugogo', name: 'Nyabugogo Bus Terminal', district: 'Nyarugenge', category: 'landmark', lat: -1.9384, lng: 30.0445 },
  { id: 'kigali-airport', name: 'Kigali International Airport (Kanombe)', district: 'Kicukiro', category: 'landmark', lat: -1.9686, lng: 30.1395 },
];

export const PROPERTY_TYPES = [
  'house',
  'apartment',
  'single_room',
  'shared_room',
  'studio',
  'hostel',
  'commercial',
] as const;

export const AMENITIES_LIST = [
  'water',
  'electricity',
  'wifi',
  'parking',
  'security',
  'fence',
  'kitchen',
  'balcony',
  'garden',
  'furniture',
  'internal_toilet',
  'tiles',
] as const;

export const RENTAL_RULES = [
  'no_pets',
  'no_smoking',
  'family_only',
  'students_only',
] as const;

export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatRwf(amount: number): string {
  return `${new Intl.NumberFormat('en-RW').format(amount)} RWF`;
}
