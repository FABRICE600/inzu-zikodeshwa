import { and, count, eq, sql } from 'drizzle-orm';
import { db, isDatabaseConfigured } from './index.ts';
import { listingPhotos, listings, users } from './schema.ts';
import { hashPassword, verifyPassword } from '../lib/auth.ts';

let seedPromise: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  const existing = await db.execute(sql`SELECT to_regclass('public.users') AS tbl`);
  const firstRow = (existing as { rows?: Array<{ tbl?: string | null }> }).rows?.[0];
  if (firstRow?.tbl) {
    return;
  }

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      uid TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'tenant',
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT UNIQUE,
      whatsapp TEXT,
      password_hash TEXT,
      photo_url TEXT,
      bio TEXT,
      phone_verified BOOLEAN NOT NULL DEFAULT false,
      is_suspended BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      target TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS listings (
      id SERIAL PRIMARY KEY,
      landlord_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      property_type TEXT NOT NULL,
      price_rwf INTEGER NOT NULL,
      deposit_rwf INTEGER NOT NULL DEFAULT 0,
      bedrooms INTEGER NOT NULL DEFAULT 1,
      bathrooms INTEGER NOT NULL DEFAULT 1,
      size_sqm INTEGER,
      furnished BOOLEAN NOT NULL DEFAULT false,
      province TEXT NOT NULL,
      district TEXT NOT NULL,
      sector TEXT NOT NULL,
      cell TEXT,
      street_landmark TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      amenities JSONB NOT NULL DEFAULT '[]'::jsonb,
      rules JSONB NOT NULL DEFAULT '[]'::jsonb,
      available_from TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      approval_status TEXT NOT NULL DEFAULT 'pending',
      views_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS listing_photos (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_cover BOOLEAN NOT NULL DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS favorites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS favorites_user_listing_idx ON favorites(user_id, listing_id);

    CREATE TABLE IF NOT EXISTS saved_searches (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      filters JSONB NOT NULL,
      notify_enabled BOOLEAN NOT NULL DEFAULT true,
      last_checked_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS viewing_requests (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      tenant_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      landlord_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_type TEXT NOT NULL DEFAULT 'viewing',
      preferred_date TEXT,
      preferred_time TEXT,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS price_drop_alerts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
      subscribed_price_rwf INTEGER NOT NULL,
      last_notified_price_rwf INTEGER,
      notified_drop BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS price_drop_alerts_user_listing_idx ON price_drop_alerts(user_id, listing_id);
  `);
}

export async function ensureSeeded(): Promise<void> {
  if (!isDatabaseConfigured()) {
    return;
  }
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Database seed warning:', err);
    });
  }
  return seedPromise;
}

interface SeedListingDef {
  landlordIndex: 1 | 2;
  title: string;
  description: string;
  propertyType: 'house' | 'apartment' | 'single_room' | 'shared_room' | 'studio' | 'hostel' | 'commercial';
  priceRwf: number;
  depositRwf: number;
  bedrooms: number;
  bathrooms: number;
  sizeSqm: number;
  furnished: boolean;
  province: string;
  district: string;
  sector: string;
  cell: string;
  streetLandmark: string;
  latitude: number;
  longitude: number;
  amenities: string[];
  rules: string[];
  availableFrom: string;
  status: 'available' | 'rented' | 'hidden';
  approvalStatus: 'pending' | 'approved' | 'rejected';
  viewsCount: number;
  photos: string[];
}

// Approved, available houses covering ALL 13 districts in RWANDA_PROVINCES
const DISTRICT_HOUSES_SEED: SeedListingDef[] = [
  {
    landlordIndex: 1,
    title: '4-Bedroom Family Villa with Garden & Paved Courtyard',
    description:
      'Contemporary standalone residence in Kacyiru near embassies and ministries. Features a manicured lawn, perimeter stone fence with electric wire, two-car parking, annex quarters, and modern kitchen.',
    propertyType: 'house',
    priceRwf: 1200000,
    depositRwf: 1200000,
    bedrooms: 4,
    bathrooms: 3,
    sizeSqm: 260,
    furnished: false,
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Kacyiru',
    cell: 'Kamatamu',
    streetLandmark: 'KG 548 St, near Kacyiru Police HQ',
    latitude: -1.9438,
    longitude: 30.0846,
    amenities: ['water', 'electricity', 'parking', 'security', 'fence', 'kitchen', 'balcony', 'garden', 'internal_toilet', 'tiles'],
    rules: ['family_only'],
    availableFrom: '2026-11-25',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 98,
    photos: [
      '/src/assets/images/listing_kacyiru_villa_1795096233974.jpg',
      '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg',
    ],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Modern Standalone House in Kagarama',
    description:
      'Spacious 3-bedroom family house in a quiet gated compound in Kagarama, Kicukiro. Features paved parking for two cars, indoor kitchen, solar water heater, backup tank, and security fence.',
    propertyType: 'house',
    priceRwf: 480000,
    depositRwf: 480000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 155,
    furnished: false,
    province: 'Kigali City',
    district: 'Kicukiro',
    sector: 'Kagarama',
    cell: 'Kanserege',
    streetLandmark: 'KK 31 Ave, near Kagarama High School',
    latitude: -1.9845,
    longitude: 30.1068,
    amenities: ['water', 'electricity', 'parking', 'security', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['family_only', 'no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 64,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Terraced House with Valley View — Nyamirambo',
    description:
      'Bright 3-bedroom house on a paved street in Nyamirambo, 8 minutes from Kigali CBD. Includes walled courtyard, tiled floors, reliable REG power and WASAC water supply.',
    propertyType: 'house',
    priceRwf: 350000,
    depositRwf: 350000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 130,
    furnished: false,
    province: 'Kigali City',
    district: 'Nyarugenge',
    sector: 'Nyamirambo',
    cell: 'Mumena',
    streetLandmark: 'KN 112 St, near Nyamirambo Regional Stadium',
    latitude: -1.9794,
    longitude: 30.0448,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'balcony', 'internal_toilet', 'tiles'],
    rules: ['no_pets'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 82,
    photos: ['/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg'],
  },
  {
    landlordIndex: 2,
    title: '3-Bedroom Family House with Annex — Tumba, Huye',
    description:
      'Quiet residential house in Tumba sector, Huye, ideal for university staff or families. Offers a private garden, paved courtyard, internal kitchen, and 24/7 water tank.',
    propertyType: 'house',
    priceRwf: 220000,
    depositRwf: 220000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 140,
    furnished: false,
    province: 'Southern Province',
    district: 'Huye',
    sector: 'Tumba',
    cell: 'Cyarwa',
    streetLandmark: 'SH 4 St, 6 minutes from UR Huye Campus',
    latitude: -2.6215,
    longitude: 29.7492,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-11-28',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 53,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Tiled House with Gate — Nyamabuye, Muhanga',
    description:
      'Well-kept 3-bedroom standalone home near Gitarama town centre in Nyamabuye. Includes enclosed stone fence, indoor bathroom, kitchen, and easy access to Kigali-Huye highway.',
    propertyType: 'house',
    priceRwf: 180000,
    depositRwf: 180000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 125,
    furnished: false,
    province: 'Southern Province',
    district: 'Muhanga',
    sector: 'Nyamabuye',
    cell: 'Gahogo',
    streetLandmark: 'Near Muhanga Market & Stadium',
    latitude: -2.0744,
    longitude: 29.7567,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'internal_toilet', 'tiles'],
    rules: ['no_pets'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 41,
    photos: ['/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg'],
  },
  {
    landlordIndex: 2,
    title: '2-Bedroom Courtyard House — Busasamana, Nyanza',
    description:
      'Peaceful 2-bedroom house in Busasamana with front veranda, tiled living room, private gate, and reliable water. Short walk to Nyanza town services and transport.',
    propertyType: 'house',
    priceRwf: 130000,
    depositRwf: 130000,
    bedrooms: 2,
    bathrooms: 1,
    sizeSqm: 95,
    furnished: false,
    province: 'Southern Province',
    district: 'Nyanza',
    sector: 'Busasamana',
    cell: 'Nyanza',
    streetLandmark: 'Near Nyanza Heritage Museum & Main Road',
    latitude: -2.3519,
    longitude: 29.7509,
    amenities: ['water', 'electricity', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 34,
    photos: ['/src/assets/images/listing_huye_student_hostel_1795096233835.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Volcano View House — Cyuve, Musanze',
    description:
      'Clean 3-bedroom residential home in Cyuve sector, Musanze with views of Mount Karisimbi, gated driveway, modern kitchen, and hot water shower.',
    propertyType: 'house',
    priceRwf: 290000,
    depositRwf: 290000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 150,
    furnished: false,
    province: 'Northern Province',
    district: 'Musanze',
    sector: 'Cyuve',
    cell: 'Bukinanyana',
    streetLandmark: 'Near Cyuve Market & Musanze Ring Road',
    latitude: -1.4912,
    longitude: 29.6512,
    amenities: ['water', 'electricity', 'parking', 'security', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 68,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
  {
    landlordIndex: 2,
    title: '3-Bedroom Hilltop Family House — Byumba, Gicumbi',
    description:
      'Solid brick family house in Byumba town with enclosed courtyard, parking space, indoor toilet, and 5-minute access to Gicumbi bus station and market.',
    propertyType: 'house',
    priceRwf: 160000,
    depositRwf: 160000,
    bedrooms: 3,
    bathrooms: 1,
    sizeSqm: 120,
    furnished: false,
    province: 'Northern Province',
    district: 'Gicumbi',
    sector: 'Byumba',
    cell: 'Gacurabwenge',
    streetLandmark: 'Near Byumba Hospital & Bus Park',
    latitude: -1.5763,
    longitude: 30.0675,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'internal_toilet', 'tiles'],
    rules: ['family_only'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 29,
    photos: ['/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Lake Kivu Breeze House — Gisenyi, Rubavu',
    description:
      'Airy 3-bedroom house 6 minutes from Lake Kivu shoreline in Gisenyi. Includes shaded veranda, parking, WiFi readiness, fenced yard, and modern tiled kitchen.',
    propertyType: 'house',
    priceRwf: 380000,
    depositRwf: 380000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 165,
    furnished: true,
    province: 'Western Province',
    district: 'Rubavu',
    sector: 'Gisenyi',
    cell: 'Bugoyi',
    streetLandmark: 'Near Petite Barriere & Lake Kivu Public Beach',
    latitude: -1.6871,
    longitude: 29.2564,
    amenities: ['water', 'electricity', 'wifi', 'parking', 'security', 'fence', 'kitchen', 'balcony', 'garden', 'furniture', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-11-26',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 87,
    photos: ['/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg'],
  },
  {
    landlordIndex: 2,
    title: '2-Bedroom Town House Near Kamembe Centre — Rusizi',
    description:
      'Convenient 2-bedroom standalone house in Kamembe with fenced compound, water reserve tank, and quick transport links to Rusizi bus park and border crossing.',
    propertyType: 'house',
    priceRwf: 175000,
    depositRwf: 175000,
    bedrooms: 2,
    bathrooms: 1,
    sizeSqm: 105,
    furnished: false,
    province: 'Western Province',
    district: 'Rusizi',
    sector: 'Kamembe',
    cell: 'Gihundwe',
    streetLandmark: 'Near Kamembe Market & Airport Road',
    latitude: -2.4846,
    longitude: 28.9075,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'internal_toilet', 'tiles'],
    rules: ['no_pets'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 37,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Gated Residential House — Kigabiro, Rwamagana',
    description:
      'Spacious 3-bedroom house in Kigabiro along a quiet residential lane. Offers manicured garden, two-car parking, indoor kitchen, and reliable utility connections.',
    propertyType: 'house',
    priceRwf: 240000,
    depositRwf: 240000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 140,
    furnished: false,
    province: 'Eastern Province',
    district: 'Rwamagana',
    sector: 'Kigabiro',
    cell: 'Cyanya',
    streetLandmark: 'Near Rwamagana Provincial HQ & Highway',
    latitude: -1.9487,
    longitude: 30.4347,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 51,
    photos: ['/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg'],
  },
  {
    landlordIndex: 2,
    title: '3-Bedroom Modern Home — Mukarange, Kayonza',
    description:
      'Bright 3-bedroom house in Mukarange sector near Kayonza roundabout. Includes walled perimeter, tiled living areas, kitchen cabinets, and water storage tank.',
    propertyType: 'house',
    priceRwf: 200000,
    depositRwf: 200000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 130,
    furnished: false,
    province: 'Eastern Province',
    district: 'Kayonza',
    sector: 'Mukarange',
    cell: 'Kayonza',
    streetLandmark: 'Near Kayonza Bus Terminal & Highway Junction',
    latitude: -1.8943,
    longitude: 30.5172,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'internal_toilet', 'tiles'],
    rules: ['no_pets'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 44,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom Newly Built House — Nyamata, Bugesera',
    description:
      'Brand-new 3-bedroom residential house in Nyamata, 35 minutes from Kigali. Features wide paved compound, modern kitchen, spacious bedrooms, and security gate.',
    propertyType: 'house',
    priceRwf: 260000,
    depositRwf: 260000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 145,
    furnished: false,
    province: 'Eastern Province',
    district: 'Bugesera',
    sector: 'Nyamata',
    cell: 'Nyamata Ville',
    streetLandmark: 'Near Nyamata Main Road & District Office',
    latitude: -2.1449,
    longitude: 30.0928,
    amenities: ['water', 'electricity', 'parking', 'security', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['family_only'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 59,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
];

// Commercial houses & spaces (Ubucuruzi) across Rwanda business hubs
const COMMERCIAL_HOUSES_SEED: SeedListingDef[] = [
  {
    landlordIndex: 1,
    title: 'Corner Commercial House & Showroom — Remera, Kigali',
    description:
      'High-visibility two-level commercial house along the main Remera-Kisimenti road, suitable for retail showroom, clinic, or corporate office. Features customer parking, fiber WiFi, security guardhouse, and tiled display hall.',
    propertyType: 'commercial',
    priceRwf: 950000,
    depositRwf: 950000,
    bedrooms: 4,
    bathrooms: 3,
    sizeSqm: 240,
    furnished: false,
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Remera',
    cell: 'Kisimenti',
    streetLandmark: 'KN 5 Rd, Kisimenti Commercial Strip',
    latitude: -1.9578,
    longitude: 30.1092,
    amenities: ['water', 'electricity', 'wifi', 'parking', 'security', 'fence', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 91,
    photos: [
      '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg',
      '/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg',
    ],
  },
  {
    landlordIndex: 1,
    title: 'Executive Office House & Reception Compound — Kiyovu, Nyarugenge',
    description:
      'Standalone commercial office house on a quiet paved avenue in Kiyovu, Kigali CBD. Includes 5 private office rooms, conference hall, paved parking for 6 vehicles, fiber internet readiness, and 24/7 perimeter security.',
    propertyType: 'commercial',
    priceRwf: 1450000,
    depositRwf: 1450000,
    bedrooms: 5,
    bathrooms: 3,
    sizeSqm: 310,
    furnished: false,
    province: 'Kigali City',
    district: 'Nyarugenge',
    sector: 'Nyarugenge',
    cell: 'Kiyovu',
    streetLandmark: 'KN 3 Ave, 300m from Kigali City Tower',
    latitude: -1.9518,
    longitude: 30.0628,
    amenities: ['water', 'electricity', 'wifi', 'parking', 'security', 'fence', 'kitchen', 'internal_toilet', 'tiles'],
    rules: ['no_pets', 'no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 112,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
  {
    landlordIndex: 2,
    title: 'Roadside Shop & Commercial Annex — Kicukiro Centre',
    description:
      'Clean commercial house with wide glass frontage and storage rooms near Kicukiro Centre roundabout. Ideal for pharmacy, boutique, salon, or agency branch with prepaid CashPower and water.',
    propertyType: 'commercial',
    priceRwf: 380000,
    depositRwf: 380000,
    bedrooms: 2,
    bathrooms: 1,
    sizeSqm: 95,
    furnished: false,
    province: 'Kigali City',
    district: 'Kicukiro',
    sector: 'Kicukiro',
    cell: 'Kicukiro',
    streetLandmark: 'KK 15 Rd, opposite Kicukiro Market',
    latitude: -1.9748,
    longitude: 30.1024,
    amenities: ['water', 'electricity', 'parking', 'security', 'internal_toilet', 'tiles'],
    rules: [],
    availableFrom: '2026-11-25',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 73,
    photos: ['/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg'],
  },
  {
    landlordIndex: 2,
    title: 'Town Centre Commercial Building — Ngoma, Huye',
    description:
      'Multi-room commercial house on Huye main business street, suitable for bookshop, café, training hub, or regional office. Includes courtyard parking, WiFi readiness, and dual washrooms.',
    propertyType: 'commercial',
    priceRwf: 320000,
    depositRwf: 320000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 140,
    furnished: false,
    province: 'Southern Province',
    district: 'Huye',
    sector: 'Ngoma',
    cell: 'Butare',
    streetLandmark: 'RN1 Main Street, near Huye Market',
    latitude: -2.6012,
    longitude: 29.7418,
    amenities: ['water', 'electricity', 'wifi', 'parking', 'security', 'fence', 'internal_toilet', 'tiles'],
    rules: [],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 58,
    photos: ['/src/assets/images/listing_huye_student_hostel_1795096233835.jpg'],
  },
];

// Additional varied property types (apartments, studios, hostels, single/shared rooms, pending moderation)
const EXTRA_LISTINGS_SEED: SeedListingDef[] = [
  {
    landlordIndex: 1,
    title: 'Sunlit 2-Bedroom Furnished Apartment with Hill View',
    description:
      'Spacious modern apartment on a quiet paved street in Kimihurura, 4 minutes from Kigali Convention Centre. Includes high-speed fiber WiFi, backup water tank, balcony overlooking the valley, and 24/7 gated security.',
    propertyType: 'apartment',
    priceRwf: 650000,
    depositRwf: 650000,
    bedrooms: 2,
    bathrooms: 2,
    sizeSqm: 115,
    furnished: true,
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Kimihurura',
    cell: 'Rugando',
    streetLandmark: 'KG 624 St, near Papyrus & KCC',
    latitude: -1.9532,
    longitude: 30.0895,
    amenities: ['water', 'electricity', 'wifi', 'parking', 'security', 'fence', 'kitchen', 'balcony', 'furniture', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 142,
    photos: [
      '/src/assets/images/listing_kimihurura_apartment_1795096233146.jpg',
      '/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg',
    ],
  },
  {
    landlordIndex: 2,
    title: 'Bright Furnished Studio Near UR Remera Campus',
    description:
      'Ideal for university students or young professionals. Includes study desk, bed, wardrobe, kitchenette, internal bathroom, and reliable WiFi. 8-minute walk to UR Remera & Kisimenti transit stop.',
    propertyType: 'studio',
    priceRwf: 180000,
    depositRwf: 180000,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 34,
    furnished: true,
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Remera',
    cell: 'Rukiri I',
    streetLandmark: 'KG 17 Ave, 500m from Kisimenti',
    latitude: -1.9562,
    longitude: 30.1118,
    amenities: ['water', 'electricity', 'wifi', 'security', 'fence', 'kitchen', 'furniture', 'internal_toilet', 'tiles'],
    rules: ['no_pets', 'no_smoking'],
    availableFrom: '2026-11-20',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 215,
    photos: ['/src/assets/images/listing_remera_studio_1795096234234.jpg'],
  },
  {
    landlordIndex: 2,
    title: 'Huye Campus Modern Student Hostel — Private & Shared Units',
    description:
      'Clean purpose-built student accommodation 5 minutes walk from University of Rwanda Huye Campus. Quiet courtyard study tables, solar-backed electricity, water included, and night watchman.',
    propertyType: 'hostel',
    priceRwf: 75000,
    depositRwf: 50000,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 20,
    furnished: true,
    province: 'Southern Province',
    district: 'Huye',
    sector: 'Ngoma',
    cell: 'Butare',
    streetLandmark: 'Near UR Huye Main Gate',
    latitude: -2.6138,
    longitude: 29.7421,
    amenities: ['water', 'electricity', 'wifi', 'security', 'fence', 'furniture', 'internal_toilet', 'tiles'],
    rules: ['students_only', 'no_smoking', 'no_pets'],
    availableFrom: '2026-11-20',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 164,
    photos: ['/src/assets/images/listing_huye_student_hostel_1795096233835.jpg'],
  },
  {
    landlordIndex: 2,
    title: 'Neat Single Room in Secure Gated Compound — Kimironko',
    description:
      'Clean tiled single room (annex) with private internal toilet, piped water, and prepaid CashPower meter. Close to Kimironko Market and bus terminal.',
    propertyType: 'single_room',
    priceRwf: 90000,
    depositRwf: 90000,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 18,
    furnished: false,
    province: 'Kigali City',
    district: 'Gasabo',
    sector: 'Kimironko',
    cell: 'Bibare',
    streetLandmark: 'KG 38 St, 400m from Kimironko Market',
    latitude: -1.9475,
    longitude: 30.1282,
    amenities: ['water', 'electricity', 'fence', 'internal_toilet', 'tiles'],
    rules: ['no_pets'],
    availableFrom: '2026-11-22',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 189,
    photos: ['/src/assets/images/listing_remera_studio_1795096234234.jpg'],
  },
  {
    landlordIndex: 1,
    title: '2-Bedroom Affordable Apartment in Kicukiro Centre',
    description:
      'Well-maintained unfurnished 2-bedroom apartment in a peaceful compound with parking space, balcony, and indoor kitchen. Easy bus access to CBD and Kanombe.',
    propertyType: 'apartment',
    priceRwf: 280000,
    depositRwf: 280000,
    bedrooms: 2,
    bathrooms: 1,
    sizeSqm: 78,
    furnished: false,
    province: 'Kigali City',
    district: 'Kicukiro',
    sector: 'Niboye',
    cell: 'Niboye',
    streetLandmark: 'KK 19 Ave, near Kicukiro Centre',
    latitude: -1.9765,
    longitude: 30.1045,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'balcony', 'internal_toilet', 'tiles'],
    rules: ['no_pets'],
    availableFrom: '2026-12-01',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 77,
    photos: ['/src/assets/images/hero_kigali_neighborhood_1795096233905.jpg'],
  },
  {
    landlordIndex: 2,
    title: 'Shared Student Room Near UR Nyarugenge (CST)',
    description:
      'Clean 2-bed shared room with study desks, lockers, WiFi, and water included. 6 minutes walk to College of Science and Technology.',
    propertyType: 'shared_room',
    priceRwf: 55000,
    depositRwf: 55000,
    bedrooms: 1,
    bathrooms: 1,
    sizeSqm: 22,
    furnished: true,
    province: 'Kigali City',
    district: 'Nyarugenge',
    sector: 'Nyarugenge',
    cell: 'Kiyovu',
    streetLandmark: 'KN 67 St, walking distance to CST',
    latitude: -1.9598,
    longitude: 30.0622,
    amenities: ['water', 'electricity', 'wifi', 'security', 'fence', 'furniture', 'tiles'],
    rules: ['students_only', 'no_smoking', 'no_pets'],
    availableFrom: '2026-11-20',
    status: 'available',
    approvalStatus: 'approved',
    viewsCount: 132,
    photos: ['/src/assets/images/listing_huye_student_hostel_1795096233835.jpg'],
  },
  {
    landlordIndex: 1,
    title: '3-Bedroom House Near INES-Ruhengeri — Musanze',
    description:
      'Quiet modern family house in Muhoza sector with mountain views, secure gate, parking, and spacious living area. 10 minutes from INES-Ruhengeri.',
    propertyType: 'house',
    priceRwf: 320000,
    depositRwf: 320000,
    bedrooms: 3,
    bathrooms: 2,
    sizeSqm: 145,
    furnished: false,
    province: 'Northern Province',
    district: 'Musanze',
    sector: 'Muhoza',
    cell: 'Ruhengeri',
    streetLandmark: 'NM 12 St, near Musanze Stadium',
    latitude: -1.5008,
    longitude: 29.6345,
    amenities: ['water', 'electricity', 'parking', 'fence', 'kitchen', 'garden', 'internal_toilet', 'tiles'],
    rules: ['no_smoking'],
    availableFrom: '2026-12-05',
    status: 'available',
    approvalStatus: 'pending',
    viewsCount: 24,
    photos: ['/src/assets/images/listing_kacyiru_villa_1795096233974.jpg'],
  },
];

async function insertSeedListing(item: SeedListingDef, landlord1Id: number, landlord2Id: number) {
  const { photos, landlordIndex, ...listingData } = item;
  const landlordId = landlordIndex === 1 ? landlord1Id : landlord2Id;
  const [created] = await db
    .insert(listings)
    .values({ ...listingData, landlordId })
    .returning();
  await db.insert(listingPhotos).values(
    photos.map((url, idx) => ({
      listingId: created.id,
      url,
      displayOrder: idx,
      isCover: idx === 0,
    }))
  );
}

async function runSeed(): Promise<void> {
  await ensureSchema();
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);

  let landlord1Id: number;
  let landlord2Id: number;

  const adminEmail = 'cumuhirefabrice24@gmail.com';

  if (Number(userCount) === 0) {
    const adminPasswordHash = await hashPassword('fabrice@2007');
    const passwordHash = await hashPassword('Password123!');

    const [, landlord1, landlord2] = await db
      .insert(users)
      .values([
        {
          uid: 'seed-admin-rw',
          role: 'admin',
          fullName: 'Cumuhire Fabrice',
          email: adminEmail,
          phone: '+250788100001',
          whatsapp: '+250788100001',
          passwordHash: adminPasswordHash,
          bio: 'Platform Administrator for InzuFinder Rwanda.',
          phoneVerified: true,
        },
        {
          uid: 'seed-landlord-1',
          role: 'landlord',
          fullName: 'Claudine Uwimana',
          email: 'claudine@kigalihomes.rw',
          phone: '+250788234567',
          whatsapp: '+250788234567',
          passwordHash,
          bio: 'Property owner in Kimihurura & Kacyiru with modern furnished apartments and family villas.',
          phoneVerified: true,
        },
        {
          uid: 'seed-landlord-2',
          role: 'landlord',
          fullName: 'Eric Ndayisenga',
          email: 'eric@studentstays.rw',
          phone: '+250788345678',
          whatsapp: '+250788345678',
          passwordHash,
          bio: 'Affordable studios, single rooms, and student hostels near UR Remera, CST, and Huye Campus.',
          phoneVerified: true,
        },
        {
          uid: 'seed-tenant-1',
          role: 'tenant',
          fullName: 'Aline Mukamana',
          email: 'aline@tenant.rw',
          phone: '+250788456789',
          whatsapp: '+250788456789',
          passwordHash,
          bio: 'Software analyst looking for quiet housing in Kigali.',
          phoneVerified: true,
        },
      ])
      .returning();

    landlord1Id = landlord1.id;
    landlord2Id = landlord2.id;
  } else {
    const allUsers = await db
      .select({
        id: users.id,
        uid: users.uid,
        role: users.role,
        email: users.email,
        passwordHash: users.passwordHash,
      })
      .from(users);
    const existingAdmin =
      allUsers.find((u) => u.email === adminEmail) ||
      allUsers.find((u) => u.uid === 'seed-admin-rw') ||
      allUsers.find((u) => u.role === 'admin');

    if (existingAdmin) {
      const passwordMatches =
        Boolean(existingAdmin.passwordHash) &&
        (await verifyPassword('fabrice@2007', existingAdmin.passwordHash!));
      if (
        existingAdmin.email !== adminEmail ||
        existingAdmin.role !== 'admin' ||
        !passwordMatches
      ) {
        const adminPasswordHash = await hashPassword('fabrice@2007');
        await db
          .update(users)
          .set({
            fullName: 'Cumuhire Fabrice',
            email: adminEmail,
            passwordHash: adminPasswordHash,
            role: 'admin',
          })
          .where(eq(users.id, existingAdmin.id));
      }
    } else {
      const adminPasswordHash = await hashPassword('fabrice@2007');
      await db.insert(users).values({
        uid: 'seed-admin-rw',
        role: 'admin',
        fullName: 'Cumuhire Fabrice',
        email: adminEmail,
        phone: '+250788100001',
        whatsapp: '+250788100001',
        passwordHash: adminPasswordHash,
        bio: 'Platform Administrator for InzuFinder Rwanda.',
        phoneVerified: true,
      });
    }

    const l1 = allUsers.find((u) => u.uid === 'seed-landlord-1') || allUsers.find((u) => u.role === 'landlord') || allUsers[0];
    const l2 = allUsers.find((u) => u.uid === 'seed-landlord-2') || l1;
    landlord1Id = l1.id;
    landlord2Id = l2.id;
  }

  // If the listings table is completely empty, insert all varied extra listings too
  const [{ value: listingCount }] = await db.select({ value: count() }).from(listings);
  if (Number(listingCount) === 0) {
    for (const item of EXTRA_LISTINGS_SEED) {
      await insertSeedListing(item, landlord1Id, landlord2Id);
    }
  }

  // Ensure every single Rwanda district in RWANDA_PROVINCES has at least 1 approved, available house
  const existingApprovedHouses = await db
    .select({ district: listings.district })
    .from(listings)
    .where(
      and(
        eq(listings.approvalStatus, 'approved'),
        eq(listings.status, 'available'),
        eq(listings.propertyType, 'house')
      )
    );

  const coveredDistricts = new Set(existingApprovedHouses.map((r) => r.district));

  for (const houseSeed of DISTRICT_HOUSES_SEED) {
    if (!coveredDistricts.has(houseSeed.district)) {
      await insertSeedListing(houseSeed, landlord1Id, landlord2Id);
      coveredDistricts.add(houseSeed.district);
    }
  }

  // Ensure Commercial / Ubucuruzi houses exist
  const existingCommercial = await db
    .select({ district: listings.district })
    .from(listings)
    .where(
      and(
        eq(listings.approvalStatus, 'approved'),
        eq(listings.status, 'available'),
        eq(listings.propertyType, 'commercial')
      )
    );

  const commercialDistricts = new Set(existingCommercial.map((r) => r.district));
  for (const commercialSeed of COMMERCIAL_HOUSES_SEED) {
    if (!commercialDistricts.has(commercialSeed.district)) {
      await insertSeedListing(commercialSeed, landlord1Id, landlord2Id);
      commercialDistricts.add(commercialSeed.district);
    }
  }
}
