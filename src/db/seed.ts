import { count } from 'drizzle-orm';
import { db } from './index.ts';
import { listingPhotos, listings, users } from './schema.ts';
import { hashPassword } from '../lib/auth.ts';

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Database seed warning:', err);
    });
  }
  return seedPromise;
}

async function runSeed(): Promise<void> {
  const [{ value: userCount }] = await db.select({ value: count() }).from(users);
  if (Number(userCount) > 0) return;

  const passwordHash = await hashPassword('Password123!');

  const [admin, landlord1, landlord2, tenant] = await db
    .insert(users)
    .values([
      {
        uid: 'seed-admin-rw',
        role: 'admin',
        fullName: 'Jean-Paul Mugisha',
        email: 'admin@inzufinder.rw',
        phone: '+250788100001',
        whatsapp: '+250788100001',
        passwordHash,
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

  const seedListings = [
    {
      landlordId: landlord1.id,
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
      landlordId: landlord1.id,
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
      landlordId: landlord2.id,
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
      landlordId: landlord2.id,
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
      landlordId: landlord2.id,
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
      landlordId: landlord1.id,
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
      landlordId: landlord2.id,
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
      landlordId: landlord1.id,
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

  for (const item of seedListings) {
    const { photos, ...listingData } = item;
    const [created] = await db.insert(listings).values(listingData).returning();
    await db.insert(listingPhotos).values(
      photos.map((url, idx) => ({
        listingId: created.id,
        url,
        displayOrder: idx,
        isCover: idx === 0,
      }))
    );
  }
}
