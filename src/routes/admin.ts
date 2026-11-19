import { Router } from 'express';
import { count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { listingPhotos, listings, reports, users, viewingRequests } from '../db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/overview', async (_req, res) => {
  try {
    const [
      [{ value: totalUsers }],
      [{ value: totalListings }],
      [{ value: pendingListings }],
      [{ value: approvedListings }],
      [{ value: openReports }],
      [{ value: totalViewings }],
    ] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(listings),
      db.select({ value: count() }).from(listings).where(eq(listings.approvalStatus, 'pending')),
      db.select({ value: count() }).from(listings).where(eq(listings.approvalStatus, 'approved')),
      db.select({ value: count() }).from(reports).where(eq(reports.status, 'open')),
      db.select({ value: count() }).from(viewingRequests),
    ]);

    res.json({
      stats: {
        totalUsers: Number(totalUsers),
        totalListings: Number(totalListings),
        pendingListings: Number(pendingListings),
        approvedListings: Number(approvedListings),
        openReports: Number(openReports),
        totalViewings: Number(totalViewings),
        totalRevenueRwf: 0, // Phase 2 MoMo/Airtel Money monetization
      },
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    res.status(500).json({ error: 'Could not load admin metrics.' });
  }
});

router.get('/listings', async (_req, res) => {
  try {
    const rows = await db.select().from(listings).orderBy(desc(listings.createdAt));
    if (rows.length === 0) return res.json({ items: [] });

    const landlordIds = Array.from(new Set(rows.map((r) => r.landlordId)));
    const listingIds = rows.map((r) => r.id);

    const [landlordRows, photoRows] = await Promise.all([
      db.select({ id: users.id, fullName: users.fullName, email: users.email, phone: users.phone }).from(users).where(inArray(users.id, landlordIds)),
      db.select().from(listingPhotos).where(inArray(listingPhotos.listingId, listingIds)),
    ]);

    const landlordMap = new Map(landlordRows.map((l) => [l.id, l]));
    const coverMap = new Map<number, string>();
    for (const p of photoRows) {
      if (p.isCover || !coverMap.has(p.listingId)) {
        coverMap.set(p.listingId, p.url);
      }
    }

    const items = rows.map((r) => ({
      ...r,
      coverPhoto: coverMap.get(r.id) || '',
      landlord: landlordMap.get(r.landlordId) || null,
    }));

    res.json({ items });
  } catch (error) {
    console.error('Admin listings error:', error);
    res.status(500).json({ error: 'Could not load listings.' });
  }
});

router.patch('/listings/:id/approval', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const approvalStatus = req.body?.approvalStatus;
    if (!['approved', 'rejected', 'pending'].includes(approvalStatus)) {
      return res.status(400).json({ error: 'Invalid approval status.' });
    }

    const [updated] = await db
      .update(listings)
      .set({ approvalStatus, updatedAt: new Date() })
      .where(eq(listings.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Listing not found.' });
    res.json({ listing: updated });
  } catch (error) {
    console.error('Admin approval error:', error);
    res.status(500).json({ error: 'Could not update approval status.' });
  }
});

router.get('/users', async (_req, res) => {
  try {
    const rows = await db
      .select({
        id: users.id,
        uid: users.uid,
        role: users.role,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        phoneVerified: users.phoneVerified,
        isSuspended: users.isSuspended,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    res.json({ items: rows });
  } catch (error) {
    console.error('Admin users error:', error);
    res.status(500).json({ error: 'Could not load users.' });
  }
});

router.patch('/users/:id/suspend', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.dbUser!.id) {
      return res.status(400).json({ error: 'You cannot suspend your own admin account.' });
    }
    const isSuspended = Boolean(req.body?.isSuspended);
    const [updated] = await db
      .update(users)
      .set({ isSuspended, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: updated });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({ error: 'Could not update user status.' });
  }
});

router.delete('/users/:id', async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    if (id === req.dbUser!.id) {
      return res.status(400).json({ error: 'You cannot delete your own admin account.' });
    }
    await db.delete(users).where(eq(users.id, id));
    res.json({ message: 'User deleted.' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Could not delete user.' });
  }
});

router.get('/reports', async (_req, res) => {
  try {
    const rows = await db.select().from(reports).orderBy(desc(reports.createdAt));
    if (rows.length === 0) return res.json({ items: [] });

    const listingIds = Array.from(new Set(rows.map((r) => r.listingId)));
    const userIds = Array.from(new Set(rows.map((r) => r.reporterId)));

    const [listingRows, userRows] = await Promise.all([
      db.select({ id: listings.id, title: listings.title, district: listings.district }).from(listings).where(inArray(listings.id, listingIds)),
      db.select({ id: users.id, fullName: users.fullName, email: users.email }).from(users).where(inArray(users.id, userIds)),
    ]);

    const listingMap = new Map(listingRows.map((l) => [l.id, l]));
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    const items = rows.map((r) => ({
      ...r,
      listing: listingMap.get(r.listingId) || null,
      reporter: userMap.get(r.reporterId) || null,
    }));

    res.json({ items });
  } catch (error) {
    console.error('Admin reports error:', error);
    res.status(500).json({ error: 'Could not load reports.' });
  }
});

router.patch('/reports/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;
    if (!['open', 'resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid report status.' });
    }

    const [updated] = await db
      .update(reports)
      .set({ status })
      .where(eq(reports.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: 'Report not found.' });
    res.json({ report: updated });
  } catch (error) {
    console.error('Update report error:', error);
    res.status(500).json({ error: 'Could not update report.' });
  }
});

export default router;
