import { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { verifyJwt } from '../lib/auth.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';

export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  dbUser?: DbUser;
}

async function resolveUserFromToken(token: string): Promise<DbUser | null> {
  // 1. Try local JWT first if it looks like our signed JWT
  try {
    const payload = verifyJwt(token);
    if (payload && payload.userId) {
      const [found] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (found) return found;
    }
  } catch {
    // Not a local JWT, fall through to Firebase ID Token verification
  }

  // 2. Verify Firebase ID Token (Google Sign-In)
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const email = decoded.email || null;
    const name = decoded.name || (email ? email.split('@')[0] : 'Rwanda User');
    const photoUrl = decoded.picture || null;

    const [existingByUid] = await db.select().from(users).where(eq(users.uid, decoded.uid)).limit(1);
    if (existingByUid) {
      return existingByUid;
    }

    if (email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingByEmail) {
        const [updated] = await db
          .update(users)
          .set({ uid: decoded.uid, photoUrl: existingByEmail.photoUrl || photoUrl, updatedAt: new Date() })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        return updated;
      }
    }

    const [inserted] = await db
      .insert(users)
      .values({
        uid: decoded.uid,
        email,
        fullName: name,
        photoUrl,
        role: 'tenant',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, fullName: name, updatedAt: new Date() },
      })
      .returning();

    return inserted;
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      const user = await resolveUserFromToken(token);
      if (user && !user.isSuspended) {
        req.dbUser = user;
      }
    }
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const token = authHeader.slice(7).trim();
  const user = await resolveUserFromToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  if (user.isSuspended) {
    return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
  }

  req.dbUser = user;
  next();
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.dbUser.role)) {
      return res.status(403).json({ error: `Access denied. Required role: ${roles.join(' or ')}.` });
    }
    next();
  };
};
