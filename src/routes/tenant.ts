import { Router } from 'express';
import { and, asc, desc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  favorites,
  listingPhotos,
  listings,
  priceDropAlerts,
  reports,
  savedSearches,
  users,
  viewingRequests,
} from '../db/schema.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';

const router = Router();

// Favorites
router.get('/favorites', requireAuth, async (req: AuthRequest, res) => {
  try {
    const favRows = await db
      .select()
      .from(favorites)
      .where(eq(favorites.userId, req.dbUser!.id))
      .orderBy(desc(favorites.createdAt));

    if (favRows.length === 0) return res.json({ items: [], ids: [] });

    const listingIds = favRows.map((f) => f.listingId);
    const listingRows = await db.select().from(listings).where(inArray(listings.id, listingIds));
    const photos = await db
      .select()
      .from(listingPhotos)
      .where(inArray(listingPhotos.listingId, listingIds))
      .orderBy(asc(listingPhotos.displayOrder));

    const photoMap = new Map<number, typeof photos>();
    for (const p of photos) {
      const list = photoMap.get(p.listingId) || [];
      list.push(p);
      photoMap.set(p.listingId, list);
    }

    const items = listingRows.map((l) => {
      const lPhotos = photoMap.get(l.id) || [];
      return {
        ...l,
        photos: lPhotos,
        coverPhoto: lPhotos.find((p) => p.isCover)?.url || lPhotos[0]?.url || '',
      };
    });

    res.json({ items, ids: listingIds });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Could not load favorites.' });
  }
});

router.post('/favorites/:listingId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const [existing] = await db
      .select()
      .from(favorites)
      .where(and(eq(favorites.userId, req.dbUser!.id), eq(favorites.listingId, listingId)))
      .limit(1);

    if (existing) {
      await db.delete(favorites).where(eq(favorites.id, existing.id));
      return res.json({ favorited: false });
    }

    await db.insert(favorites).values({ userId: req.dbUser!.id, listingId });
    res.json({ favorited: true });
  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({ error: 'Could not update favorite.' });
  }
});

// Saved Searches with live new-match notification counts
router.get('/saved-searches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const searches = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.userId, req.dbUser!.id))
      .orderBy(desc(savedSearches.createdAt));

    const activeListings = await db
      .select()
      .from(listings)
      .where(and(eq(listings.approvalStatus, 'approved'), eq(listings.status, 'available')));

    const enriched = searches.map((s) => {
      const f = s.filters || {};
      const matching = activeListings.filter((l) => {
        if (f.district && l.district !== f.district) return false;
        if (f.sector && l.sector !== f.sector) return false;
        if (f.propertyType && l.propertyType !== f.propertyType) return false;
        if (f.minPrice && l.priceRwf < f.minPrice) return false;
        if (f.maxPrice && l.priceRwf > f.maxPrice) return false;
        if (f.bedrooms && l.bedrooms < f.bedrooms) return false;
        if (f.furnished === 'true' && !l.furnished) return false;
        if (f.q) {
          const qLower = f.q.toLowerCase();
          const hay = `${l.title} ${l.district} ${l.sector} ${l.streetLandmark}`.toLowerCase();
          if (!hay.includes(qLower)) return false;
        }
        return true;
      });
      const newMatchesCount = matching.filter((m) => new Date(m.createdAt) >= new Date(s.createdAt)).length;
      return {
        ...s,
        totalMatches: matching.length,
        newMatchesCount,
      };
    });

    res.json({ items: enriched });
  } catch (error) {
    console.error('Saved searches error:', error);
    res.status(500).json({ error: 'Could not load saved searches.' });
  }
});

router.post('/saved-searches', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2).max(100),
      filters: z.record(z.string(), z.any()),
      notifyEnabled: z.boolean().default(true),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Search name and filters are required.' });
    }

    const [created] = await db
      .insert(savedSearches)
      .values({
        userId: req.dbUser!.id,
        name: parsed.data.name.trim(),
        filters: parsed.data.filters,
        notifyEnabled: parsed.data.notifyEnabled,
      })
      .returning();

    res.status(201).json({ search: created });
  } catch (error) {
    console.error('Save search error:', error);
    res.status(500).json({ error: 'Could not save search.' });
  }
});

router.delete('/saved-searches/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, req.dbUser!.id)));
    res.json({ message: 'Saved search removed.' });
  } catch (error) {
    console.error('Delete saved search error:', error);
    res.status(500).json({ error: 'Could not delete saved search.' });
  }
});

// Viewing Requests & Direct Contact Messages
router.get('/viewings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.dbUser!.id;
    const rows = await db
      .select()
      .from(viewingRequests)
      .where(or(eq(viewingRequests.tenantId, uid), eq(viewingRequests.landlordId, uid))!)
      .orderBy(desc(viewingRequests.createdAt));

    if (rows.length === 0) return res.json({ items: [] });

    const listingIds = Array.from(new Set(rows.map((r) => r.listingId)));
    const userIds = Array.from(new Set(rows.flatMap((r) => [r.tenantId, r.landlordId])));

    const [listingRows, userRows] = await Promise.all([
      db.select({ id: listings.id, title: listings.title, district: listings.district, sector: listings.sector, priceRwf: listings.priceRwf }).from(listings).where(inArray(listings.id, listingIds)),
      db.select({ id: users.id, fullName: users.fullName, phone: users.phone, whatsapp: users.whatsapp }).from(users).where(inArray(users.id, userIds)),
    ]);

    const listingMap = new Map(listingRows.map((l) => [l.id, l]));
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    const items = rows.map((r) => ({
      ...r,
      listing: listingMap.get(r.listingId) || null,
      tenant: userMap.get(r.tenantId) || null,
      landlord: userMap.get(r.landlordId) || null,
    }));

    res.json({ items });
  } catch (error) {
    console.error('Get viewings error:', error);
    res.status(500).json({ error: 'Could not load viewing requests.' });
  }
});

router.post('/viewings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      listingId: z.coerce.number().int(),
      requestType: z.enum(['viewing', 'message']).default('viewing'),
      preferredDate: z.string().optional().or(z.literal('')),
      preferredTime: z.string().optional().or(z.literal('')),
      message: z.string().min(3).max(1000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid request details.' });
    }

    const [listing] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, parsed.data.listingId))
      .limit(1);
    if (!listing) return res.status(404).json({ error: 'Listing not found.' });

    const [created] = await db
      .insert(viewingRequests)
      .values({
        listingId: listing.id,
        tenantId: req.dbUser!.id,
        landlordId: listing.landlordId,
        requestType: parsed.data.requestType,
        preferredDate: parsed.data.preferredDate || null,
        preferredTime: parsed.data.preferredTime || null,
        message: parsed.data.message.trim(),
        status: 'pending',
      })
      .returning();

    res.status(201).json({ request: created });
  } catch (error) {
    console.error('Create viewing request error:', error);
    res.status(500).json({ error: 'Could not submit request.' });
  }
});

router.patch('/viewings/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!['confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status.' });
    }

    const [existing] = await db.select().from(viewingRequests).where(eq(viewingRequests.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Request not found.' });

    if (existing.landlordId !== req.dbUser!.id && req.dbUser!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the property landlord can update this request.' });
    }

    const [updated] = await db
      .update(viewingRequests)
      .set({ status })
      .where(eq(viewingRequests.id, id))
      .returning();

    res.json({ request: updated });
  } catch (error) {
    console.error('Update viewing status error:', error);
    res.status(500).json({ error: 'Could not update viewing status.' });
  }
});

// Report listing
router.post('/reports', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      listingId: z.coerce.number().int(),
      reason: z.string().min(3).max(120),
      details: z.string().max(1000).optional().or(z.literal('')),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please select a reason for reporting.' });
    }

    const [created] = await db
      .insert(reports)
      .values({
        listingId: parsed.data.listingId,
        reporterId: req.dbUser!.id,
        reason: parsed.data.reason,
        details: parsed.data.details?.trim() || null,
      })
      .returning();

    res.status(201).json({ report: created });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ error: 'Could not submit report.' });
  }
});

// Price Drop Alerts
router.get('/price-alerts', requireAuth, async (req: AuthRequest, res) => {
  try {
    const alertRows = await db
      .select()
      .from(priceDropAlerts)
      .where(eq(priceDropAlerts.userId, req.dbUser!.id))
      .orderBy(desc(priceDropAlerts.updatedAt));

    if (alertRows.length === 0) {
      return res.json({ items: [], listingIds: [], droppedCount: 0 });
    }

    const listingIds = alertRows.map((a) => a.listingId);
    const [listingRows, photos] = await Promise.all([
      db.select().from(listings).where(inArray(listings.id, listingIds)),
      db
        .select()
        .from(listingPhotos)
        .where(inArray(listingPhotos.listingId, listingIds))
        .orderBy(asc(listingPhotos.displayOrder)),
    ]);

    const photoMap = new Map<number, typeof photos>();
    for (const p of photos) {
      const arr = photoMap.get(p.listingId) || [];
      arr.push(p);
      photoMap.set(p.listingId, arr);
    }

    const listingMap = new Map(listingRows.map((l) => [l.id, l]));

    const items = alertRows
      .map((alert) => {
        const listing = listingMap.get(alert.listingId);
        if (!listing) return null;
        const lPhotos = photoMap.get(listing.id) || [];
        const coverPhoto = lPhotos.find((p) => p.isCover)?.url || lPhotos[0]?.url || '';
        const hasDropped = listing.priceRwf < alert.subscribedPriceRwf || alert.notifiedDrop;
        const savingsRwf = Math.max(0, alert.subscribedPriceRwf - listing.priceRwf);
        return {
          ...alert,
          hasDropped,
          savingsRwf,
          listing: {
            ...listing,
            photos: lPhotos,
            coverPhoto,
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));

    const droppedCount = items.filter((item) => item.hasDropped).length;
    res.json({ items, listingIds, droppedCount });
  } catch (error) {
    console.error('Get price alerts error:', error);
    res.status(500).json({ error: 'Could not load price alerts.' });
  }
});

router.get('/price-alerts/:listingId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const [alert] = await db
      .select()
      .from(priceDropAlerts)
      .where(and(eq(priceDropAlerts.userId, req.dbUser!.id), eq(priceDropAlerts.listingId, listingId)))
      .limit(1);

    if (!alert) {
      return res.json({ subscribed: false, alert: null });
    }

    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    const hasDropped = listing ? listing.priceRwf < alert.subscribedPriceRwf || alert.notifiedDrop : false;
    const savingsRwf = listing ? Math.max(0, alert.subscribedPriceRwf - listing.priceRwf) : 0;

    res.json({
      subscribed: true,
      alert: {
        ...alert,
        hasDropped,
        savingsRwf,
      },
    });
  } catch (error) {
    console.error('Get price alert status error:', error);
    res.status(500).json({ error: 'Could not check price alert status.' });
  }
});

router.post('/price-alerts/:listingId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const [existing] = await db
      .select()
      .from(priceDropAlerts)
      .where(and(eq(priceDropAlerts.userId, req.dbUser!.id), eq(priceDropAlerts.listingId, listingId)))
      .limit(1);

    if (existing) {
      await db.delete(priceDropAlerts).where(eq(priceDropAlerts.id, existing.id));
      return res.json({ subscribed: false, alert: null });
    }

    const [created] = await db
      .insert(priceDropAlerts)
      .values({
        userId: req.dbUser!.id,
        listingId,
        subscribedPriceRwf: listing.priceRwf,
        notifiedDrop: false,
      })
      .returning();

    res.status(201).json({
      subscribed: true,
      alert: { ...created, hasDropped: false, savingsRwf: 0 },
    });
  } catch (error) {
    console.error('Toggle price alert error:', error);
    res.status(500).json({ error: 'Could not update price drop alert.' });
  }
});

router.patch('/price-alerts/:listingId/ack', requireAuth, async (req: AuthRequest, res) => {
  try {
    const listingId = Number(req.params.listingId);
    if (!Number.isInteger(listingId)) {
      return res.status(400).json({ error: 'Invalid listing ID.' });
    }

    const [listing] = await db.select().from(listings).where(eq(listings.id, listingId)).limit(1);
    if (!listing) {
      return res.status(404).json({ error: 'Listing not found.' });
    }

    const [updated] = await db
      .update(priceDropAlerts)
      .set({
        subscribedPriceRwf: listing.priceRwf,
        notifiedDrop: false,
        updatedAt: new Date(),
      })
      .where(and(eq(priceDropAlerts.userId, req.dbUser!.id), eq(priceDropAlerts.listingId, listingId)))
      .returning();

    res.json({ alert: updated || null });
  } catch (error) {
    console.error('Acknowledge price drop error:', error);
    res.status(500).json({ error: 'Could not acknowledge price drop.' });
  }
});

export default router;
