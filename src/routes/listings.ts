import { Router } from 'express';
import { and, asc, desc, eq, gt, gte, ilike, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import { listingPhotos, listings, priceDropAlerts, users } from '../db/schema.ts';
import { haversineDistanceKm, RWANDA_LANDMARKS } from '../lib/rwandaData.ts';
import { getUploadsDir } from '../lib/uploads.ts';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

const router = Router();

const listingUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadsDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `listing_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 15 },
});

const photoInputSchema = z.object({
  url: z.string().min(1),
  isCover: z.boolean().optional(),
});

const listingInputSchema = z.object({
  title: z.string().min(5).max(160),
  description: z.string().min(15).max(3000),
  propertyType: z.enum(['house', 'apartment', 'single_room', 'shared_room', 'studio', 'hostel', 'commercial']),
  priceRwf: z.coerce.number().int().min(5000).max(50000000),
  depositRwf: z.coerce.number().int().min(0).max(50000000).default(0),
  bedrooms: z.coerce.number().int().min(0).max(20).default(1),
  bathrooms: z.coerce.number().int().min(0).max(20).default(1),
  sizeSqm: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  furnished: z.boolean().default(false),
  province: z.string().min(2),
  district: z.string().min(2),
  sector: z.string().min(2),
  cell: z.string().max(100).optional().or(z.literal('')),
  streetLandmark: z.string().min(2).max(200),
  latitude: z.coerce.number().min(-3).max(-1),
  longitude: z.coerce.number().min(28.5).max(31),
  amenities: z.array(z.string()).default([]),
  rules: z.array(z.string()).default([]),
  availableFrom: z.string().min(4),
  status: z.enum(['available', 'rented', 'hidden']).default('available'),
  photos: z.array(photoInputSchema).min(1, 'Upload at least 1 photo').max(15, 'Maximum 15 photos allowed'),
});

const draftInputSchema = z.object({
  isDraft: z.literal(true),
  title: z.string().min(2, 'Enter a listing title (min 2 chars) to save a draft').max(160),
  description: z.string().max(3000).optional().default(''),
  propertyType: z
    .enum(['house', 'apartment', 'single_room', 'shared_room', 'studio', 'hostel', 'commercial'])
    .default('apartment'),
  priceRwf: z.coerce.number().int().min(0).max(50000000).optional().default(0),
  depositRwf: z.coerce.number().int().min(0).max(50000000).optional().default(0),
  bedrooms: z.coerce.number().int().min(0).max(20).optional().default(1),
  bathrooms: z.coerce.number().int().min(0).max(20).optional().default(1),
  sizeSqm: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  furnished: z.boolean().optional().default(false),
  province: z.string().optional().default('Kigali City'),
  district: z.string().optional().default('Gasabo'),
  sector: z.string().optional().default('Kimihurura'),
  cell: z.string().max(100).optional().or(z.literal('')),
  streetLandmark: z.string().max(200).optional().default(''),
  latitude: z.coerce.number().min(-3).max(-1).optional().default(-1.9536),
  longitude: z.coerce.number().min(28.5).max(31).optional().default(30.0928),
  amenities: z.array(z.string()).optional().default([]),
  rules: z.array(z.string()).optional().default([]),
  availableFrom: z.string().optional().default(() => new Date().toISOString().slice(0, 10)),
  photos: z.array(photoInputSchema).max(15, 'Maximum 15 photos allowed').optional().default([]),
});

async function hydrateListings(rows: Array<typeof listings.$inferSelect>, landmarkId?: string) {
  if (rows.length === 0) return [];
  const listingIds = rows.map((r) => r.id);
  const landlordIds = Array.from(new Set(rows.map((r) => r.landlordId)));

  const [photoRows, landlordRows] = await Promise.all([
    db
      .select()
      .from(listingPhotos)
      .where(inArray(listingPhotos.listingId, listingIds))
      .orderBy(asc(listingPhotos.displayOrder)),
    db
      .select({
        id: users.id,
        fullName: users.fullName,
        phone: users.phone,
        whatsapp: users.whatsapp,
        photoUrl: users.photoUrl,
        bio: users.bio,
        phoneVerified: users.phoneVerified,
      })
      .from(users)
      .where(inArray(users.id, landlordIds)),
  ]);

  const photosByListing = new Map<number, typeof photoRows>();
  for (const p of photoRows) {
    const arr = photosByListing.get(p.listingId) || [];
    arr.push(p);
    photosByListing.set(p.listingId, arr);
  }

  const landlordMap = new Map(landlordRows.map((l) => [l.id, l]));
  const landmark = landmarkId ? RWANDA_LANDMARKS.find((l) => l.id === landmarkId) : undefined;

  return rows.map((row) => {
    const photos = photosByListing.get(row.id) || [];
    const coverPhoto = photos.find((p) => p.isCover)?.url || photos[0]?.url || '';
    const distanceKm = landmark
      ? haversineDistanceKm(row.latitude, row.longitude, landmark.lat, landmark.lng)
      : null;
    return {
      ...row,
      photos,
      coverPhoto,
      landlord: landlordMap.get(row.landlordId) || null,
      distanceKm,
    };
  });
}

router.post(
  '/upload',
  requireAuth,
  requireRole('landlord', 'admin'),
  listingUpload.array('photos', 15),
  (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      return res.status(400).json({ error: 'No photos received.' });
    }
    const urls = files.map((f) => `/uploads/${f.filename}`);
    res.json({ urls });
  }
);

router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const {
      q,
      province,
      district,
      sector,
      neighborhood,
      minPrice,
      maxPrice,
      propertyType,
      bedrooms,
      bathrooms,
      furnished,
      amenities,
      landmarkId,
      maxDistanceKm,
      sort = 'newest',
      page = '1',
      limit = '12',
      mine,
    } = req.query as Record<string, string | undefined>;

    const conditions = [];

    if (mine === 'true' && req.dbUser) {
      conditions.push(eq(listings.landlordId, req.dbUser.id));
    } else {
      conditions.push(eq(listings.approvalStatus, 'approved'));
      conditions.push(eq(listings.status, 'available'));
    }

    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(listings.title, term),
          ilike(listings.description, term),
          ilike(listings.district, term),
          ilike(listings.sector, term),
          ilike(listings.streetLandmark, term)
        )!
      );
    }

    if (province) conditions.push(eq(listings.province, province));
    if (district) conditions.push(eq(listings.district, district));
    if (sector) conditions.push(eq(listings.sector, sector));
    if (neighborhood && neighborhood.trim()) {
      const nTerm = `%${neighborhood.trim()}%`;
      conditions.push(or(ilike(listings.cell, nTerm), ilike(listings.streetLandmark, nTerm))!);
    }

    if (minPrice && !Number.isNaN(Number(minPrice))) {
      conditions.push(gte(listings.priceRwf, Number(minPrice)));
    }
    if (maxPrice && !Number.isNaN(Number(maxPrice))) {
      conditions.push(lte(listings.priceRwf, Number(maxPrice)));
    }

    if (propertyType) conditions.push(eq(listings.propertyType, propertyType));
    if (bedrooms && !Number.isNaN(Number(bedrooms))) {
      conditions.push(gte(listings.bedrooms, Number(bedrooms)));
    }
    if (bathrooms && !Number.isNaN(Number(bathrooms))) {
      conditions.push(gte(listings.bathrooms, Number(bathrooms)));
    }
    if (furnished === 'true') conditions.push(eq(listings.furnished, true));
    if (furnished === 'false') conditions.push(eq(listings.furnished, false));

    const orderByClause =
      sort === 'cheapest'
        ? asc(listings.priceRwf)
        : sort === 'expensive'
        ? desc(listings.priceRwf)
        : desc(listings.createdAt);

    const rows = await db
      .select()
      .from(listings)
      .where(and(...conditions))
      .orderBy(orderByClause);

    let hydrated = await hydrateListings(rows, landmarkId);

    // Filter by amenities array
    if (amenities && amenities.trim()) {
      const requiredAmenities = amenities.split(',').map((a) => a.trim()).filter(Boolean);
      if (requiredAmenities.length > 0) {
        hydrated = hydrated.filter((item) =>
          requiredAmenities.every((reqAmenity) => item.amenities.includes(reqAmenity))
        );
      }
    }

    // Filter by max distance from university/landmark
    if (landmarkId && maxDistanceKm && !Number.isNaN(Number(maxDistanceKm))) {
      const limitKm = Number(maxDistanceKm);
      hydrated = hydrated.filter((item) => item.distanceKm !== null && item.distanceKm <= limitKm);
    }

    // Sort by nearest if requested and landmark selected
    if (sort === 'nearest' && landmarkId) {
      hydrated.sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999));
    }

    const total = hydrated.length;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 12));
    const start = (pageNum - 1) * limitNum;
    const items = hydrated.slice(start, start + limitNum);

    res.json({
      items,
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
    });
  } catch (error) {
    console.error('Search listings error:', error);
    res.status(500).json({ error: 'Failed to load rental listings.' });
  }
});

router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const [row] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!row) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const isOwnerOrAdmin =
      req.dbUser && (req.dbUser.id === row.landlordId || req.dbUser.role === 'admin');
    if (!isOwnerOrAdmin && (row.approvalStatus !== 'approved' || row.status === 'hidden')) {
      return res.status(404).json({ error: 'Listing is not publicly available.' });
    }

    await db
      .update(listings)
      .set({ viewsCount: sql`${listings.viewsCount} + 1` })
      .where(eq(listings.id, id));

    const [hydrated] = await hydrateListings([{ ...row, viewsCount: row.viewsCount + 1 }]);

    const similarRows = await db
      .select()
      .from(listings)
      .where(
        and(
          ne(listings.id, id),
          eq(listings.approvalStatus, 'approved'),
          eq(listings.status, 'available'),
          or(eq(listings.district, row.district), eq(listings.propertyType, row.propertyType))!
        )
      )
      .orderBy(desc(listings.createdAt))
      .limit(4);

    const similar = await hydrateListings(similarRows);

    res.json({ listing: hydrated, similar });
  } catch (error) {
    console.error('Get listing error:', error);
    res.status(500).json({ error: 'Failed to fetch listing details.' });
  }
});

router.post('/', requireAuth, requireRole('landlord', 'admin'), async (req: AuthRequest, res) => {
  try {
    const isDraft = req.body?.isDraft === true;
    const parsed = isDraft
      ? draftInputSchema.safeParse(req.body)
      : listingInputSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid listing payload.' });
    }

    const approvalStatus = req.dbUser!.role === 'admin' ? 'approved' : 'pending';
    const rawData = parsed.data as any;
    const photos: Array<{ url: string; isCover?: boolean }> = rawData.photos || [];
    const { photos: _p, isDraft: _d, ...data } = rawData;

    const [created] = await db
      .insert(listings)
      .values({
        ...data,
        status: isDraft ? 'hidden' : data.status || 'available',
        cell: data.cell || null,
        sizeSqm: data.sizeSqm ?? null,
        landlordId: req.dbUser!.id,
        approvalStatus,
      })
      .returning();

    if (photos.length > 0) {
      const coverIndex = Math.max(0, photos.findIndex((p) => p.isCover));
      await db.insert(listingPhotos).values(
        photos.map((p, idx) => ({
          listingId: created.id,
          url: p.url,
          displayOrder: idx,
          isCover: idx === coverIndex,
        }))
      );
    }

    const [hydrated] = await hydrateListings([created]);
    res.status(201).json({ listing: hydrated });
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ error: 'Unable to save listing.' });
  }
});

router.put('/:id', requireAuth, requireRole('landlord', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Listing not found.' });

    if (existing.landlordId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'You do not have permission to edit this listing.' });
    }

    const isDraft = req.body?.isDraft === true;
    const parsed = isDraft
      ? draftInputSchema.safeParse(req.body)
      : listingInputSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid listing data.' });
    }

    const rawData = parsed.data as any;
    const photos: Array<{ url: string; isCover?: boolean }> = rawData.photos || [];
    const { photos: _p, isDraft: _d, ...data } = rawData;

    const [updated] = await db
      .update(listings)
      .set({
        ...data,
        status: isDraft ? 'hidden' : data.status || 'available',
        cell: data.cell || null,
        sizeSqm: data.sizeSqm ?? null,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, id))
      .returning();

    await db.delete(listingPhotos).where(eq(listingPhotos.listingId, id));
    if (photos.length > 0) {
      const coverIndex = Math.max(0, photos.findIndex((p) => p.isCover));
      await db.insert(listingPhotos).values(
        photos.map((p, idx) => ({
          listingId: id,
          url: p.url,
          displayOrder: idx,
          isCover: idx === coverIndex,
        }))
      );
    }

    if (typeof data.priceRwf === 'number' && data.priceRwf > 0 && data.priceRwf < existing.priceRwf) {
      await db
        .update(priceDropAlerts)
        .set({
          notifiedDrop: true,
          lastNotifiedPriceRwf: data.priceRwf,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(priceDropAlerts.listingId, id),
            gt(priceDropAlerts.subscribedPriceRwf, data.priceRwf)
          )
        );
    }

    const [hydrated] = await hydrateListings([updated]);
    res.json({ listing: hydrated });
  } catch (error) {
    console.error('Update listing error:', error);
    res.status(500).json({ error: 'Could not update listing.' });
  }
});

router.patch('/:id/status', requireAuth, requireRole('landlord', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const nextStatus = req.body?.status;
    if (!['available', 'rented', 'hidden'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Status must be available, rented, or hidden.' });
    }

    const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Listing not found.' });

    if (existing.landlordId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const [updated] = await db
      .update(listings)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();

    const [hydrated] = await hydrateListings([updated]);
    res.json({ listing: hydrated });
  } catch (error) {
    console.error('Status toggle error:', error);
    res.status(500).json({ error: 'Could not update listing status.' });
  }
});

router.post('/:id/duplicate', requireAuth, requireRole('landlord', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Listing not found.' });

    if (existing.landlordId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const existingPhotos = await db
      .select()
      .from(listingPhotos)
      .where(eq(listingPhotos.listingId, id))
      .orderBy(asc(listingPhotos.displayOrder));

    const { id: _id, createdAt: _c, updatedAt: _u, viewsCount: _v, ...rest } = existing;

    const [duplicated] = await db
      .insert(listings)
      .values({
        ...rest,
        title: `${existing.title} (Copy)`,
        status: 'hidden',
        approvalStatus: req.dbUser!.role === 'admin' ? 'approved' : 'pending',
        viewsCount: 0,
      })
      .returning();

    if (existingPhotos.length > 0) {
      await db.insert(listingPhotos).values(
        existingPhotos.map((p) => ({
          listingId: duplicated.id,
          url: p.url,
          displayOrder: p.displayOrder,
          isCover: p.isCover,
        }))
      );
    }

    const [hydrated] = await hydrateListings([duplicated]);
    res.status(201).json({ listing: hydrated });
  } catch (error) {
    console.error('Duplicate listing error:', error);
    res.status(500).json({ error: 'Could not duplicate listing.' });
  }
});

router.delete('/:id', requireAuth, requireRole('landlord', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Listing not found.' });

    if (existing.landlordId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied.' });
    }

    await db.delete(listings).where(eq(listings.id, id));
    res.json({ message: 'Listing deleted.' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ error: 'Could not delete listing.' });
  }
});

export default router;
