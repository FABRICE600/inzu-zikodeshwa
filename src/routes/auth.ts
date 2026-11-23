import { Router } from 'express';
import { and, desc, eq, gt, or } from 'drizzle-orm';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db } from '../db/index.ts';
import { otpCodes, users } from '../db/schema.ts';
import {
  generateOtpCode,
  hashPassword,
  normalizeRwandaPhone,
  signJwt,
  verifyPassword,
} from '../lib/auth.ts';
import { requireAuth } from '../middleware/auth.ts';
import type { AuthRequest } from '../middleware/auth.ts';
import { getUploadsDir } from '../lib/uploads.ts';

const router = Router();

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, getUploadsDir()),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `avatar_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
});

function sanitizeUser(user: typeof users.$inferSelect) {
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

const registerSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().min(9).max(20).optional().or(z.literal('')),
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  password: z.string().min(6).max(128),
  role: z.enum(['tenant', 'landlord']).default('tenant'),
});

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data.' });
    }

    const { fullName, password, role } = parsed.data;
    const email = parsed.data.email ? parsed.data.email.trim().toLowerCase() : null;
    const phone = parsed.data.phone ? normalizeRwandaPhone(parsed.data.phone) : null;
    const whatsapp = parsed.data.whatsapp ? normalizeRwandaPhone(parsed.data.whatsapp) : phone;

    if (!email && !phone) {
      return res.status(400).json({ error: 'Please provide either a phone number or an email address.' });
    }

    if (email) {
      const [existingEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existingEmail) {
        return res.status(409).json({ error: 'An account with this email already exists.' });
      }
    }

    if (phone) {
      const [existingPhone] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
      if (existingPhone) {
        return res.status(409).json({ error: 'An account with this phone number already exists.' });
      }
    }

    const passwordHash = await hashPassword(password);
    const uid = `local-${crypto.randomUUID()}`;

    const [created] = await db
      .insert(users)
      .values({
        uid,
        fullName: fullName.trim(),
        email,
        phone,
        whatsapp,
        passwordHash,
        role,
        phoneVerified: false,
      })
      .returning();

    let verificationDemoCode: string | undefined;
    if (phone) {
      verificationDemoCode = generateOtpCode();
      await db.insert(otpCodes).values({
        target: phone,
        purpose: 'verify_phone',
        code: verificationDemoCode,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      });
    }

    const token = signJwt({ userId: created.id, uid: created.uid, role: created.role });
    res.status(201).json({
      token,
      user: sanitizeUser(created),
      demoOtp: verificationDemoCode,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Unable to create account right now.' });
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1),
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Phone/email and password are required.' });
    }

    const raw = parsed.data.identifier.trim();
    const normalizedEmail = raw.toLowerCase();
    const normalizedPhone = normalizeRwandaPhone(raw);

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, normalizedEmail), eq(users.phone, normalizedPhone), eq(users.phone, raw)))
      .limit(1);

    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid phone/email or password.' });
    }

    if (user.isSuspended) {
      return res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    }

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid phone/email or password.' });
    }

    const token = signJwt({ userId: user.id, uid: user.uid, role: user.role });
    res.json({ token, user: sanitizeUser(user) });
  } catch (error: any) {
    console.error('Login error:', error);
    const code = error?.code || error?.cause?.code;
    if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
      return res.status(503).json({
        error: 'Database connection failed. Please verify your PostgreSQL host and credentials.',
      });
    }
    res.status(500).json({ error: error?.message || 'Login failed. Please try again.' });
  }
});

router.post('/sync-google', requireAuth, async (req: AuthRequest, res) => {
  try {
    const current = req.dbUser!;
    const requestedRole = req.body?.role;
    if (
      (requestedRole === 'tenant' || requestedRole === 'landlord') &&
      current.role !== 'admin' &&
      current.role !== requestedRole
    ) {
      const [updated] = await db
        .update(users)
        .set({ role: requestedRole, updatedAt: new Date() })
        .where(eq(users.id, current.id))
        .returning();
      return res.json({ user: sanitizeUser(updated) });
    }
    res.json({ user: sanitizeUser(current) });
  } catch (error) {
    console.error('Google sync error:', error);
    res.status(500).json({ error: 'Failed to sync profile.' });
  }
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: sanitizeUser(req.dbUser!) });
});

const profileUpdateSchema = z.object({
  fullName: z.string().min(2).max(100),
  phone: z.string().max(20).optional().or(z.literal('')),
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  bio: z.string().max(500).optional().or(z.literal('')),
  photoUrl: z.string().max(500).optional().or(z.literal('')),
  role: z.enum(['tenant', 'landlord']).optional(),
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid profile fields.' });
    }

    const user = req.dbUser!;
    const nextPhone = parsed.data.phone ? normalizeRwandaPhone(parsed.data.phone) : null;
    const nextWhatsapp = parsed.data.whatsapp ? normalizeRwandaPhone(parsed.data.whatsapp) : nextPhone;

    if (nextPhone && nextPhone !== user.phone) {
      const [taken] = await db.select().from(users).where(eq(users.phone, nextPhone)).limit(1);
      if (taken && taken.id !== user.id) {
        return res.status(409).json({ error: 'That phone number is already linked to another account.' });
      }
    }

    const phoneChanged = nextPhone !== user.phone;
    const nextRole =
      user.role === 'admin' ? 'admin' : parsed.data.role ? parsed.data.role : user.role;

    const [updated] = await db
      .update(users)
      .set({
        fullName: parsed.data.fullName.trim(),
        phone: nextPhone,
        whatsapp: nextWhatsapp,
        bio: parsed.data.bio?.trim() || null,
        photoUrl: parsed.data.photoUrl?.trim() || user.photoUrl,
        role: nextRole,
        phoneVerified: phoneChanged ? false : user.phoneVerified,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Could not update profile.' });
  }
});

router.post('/avatar', requireAuth, avatarUpload.single('avatar'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const photoUrl = `/uploads/${req.file.filename}`;
    const [updated] = await db
      .update(users)
      .set({ photoUrl, updatedAt: new Date() })
      .where(eq(users.id, req.dbUser!.id))
      .returning();

    res.json({ photoUrl, user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile photo.' });
  }
});

router.post('/change-password', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      currentPassword: z.string().optional().default(''),
      newPassword: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const user = req.dbUser!;
    if (user.passwordHash) {
      const ok = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
      if (!ok) {
        return res.status(400).json({ error: 'Current password is incorrect.' });
      }
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await db
      .update(users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Could not update password.' });
  }
});

router.post('/otp/send', async (req, res) => {
  try {
    const schema = z.object({
      target: z.string().min(5),
      purpose: z.enum(['verify_phone', 'reset_password']),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid phone or email and purpose are required.' });
    }

    const raw = parsed.data.target.trim();
    const target = raw.includes('@') ? raw.toLowerCase() : normalizeRwandaPhone(raw);

    if (parsed.data.purpose === 'reset_password') {
      const [exists] = await db
        .select()
        .from(users)
        .where(or(eq(users.email, target), eq(users.phone, target)))
        .limit(1);
      if (!exists) {
        return res.status(404).json({ error: 'No account found for that phone number or email.' });
      }
    }

    const code = generateOtpCode();
    await db.insert(otpCodes).values({
      target,
      purpose: parsed.data.purpose,
      code,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    res.json({
      message: `Verification code sent to ${target}.`,
      demoOtp: code,
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to send verification code.' });
  }
});

router.post('/otp/verify-phone', requireAuth, async (req: AuthRequest, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    const phone = req.dbUser!.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Add a phone number to your profile first.' });
    }

    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.target, phone),
          eq(otpCodes.purpose, 'verify_phone'),
          eq(otpCodes.code, code),
          eq(otpCodes.used, false),
          gt(otpCodes.expiresAt, new Date())
        )
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!otp) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otp.id));
    const [updated] = await db
      .update(users)
      .set({ phoneVerified: true, updatedAt: new Date() })
      .where(eq(users.id, req.dbUser!.id))
      .returning();

    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Could not verify phone number.' });
  }
});

router.post('/password-reset/confirm', async (req, res) => {
  try {
    const schema = z.object({
      target: z.string().min(5),
      code: z.string().length(6),
      newPassword: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Provide phone/email, 6-digit code, and new password (min 6 chars).' });
    }

    const raw = parsed.data.target.trim();
    const target = raw.includes('@') ? raw.toLowerCase() : normalizeRwandaPhone(raw);

    const [otp] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.target, target),
          eq(otpCodes.purpose, 'reset_password'),
          eq(otpCodes.code, parsed.data.code),
          eq(otpCodes.used, false),
          gt(otpCodes.expiresAt, new Date())
        )
      )
      .orderBy(desc(otpCodes.createdAt))
      .limit(1);

    if (!otp) {
      return res.status(400).json({ error: 'Invalid or expired reset code.' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, target), eq(users.phone, target)))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.update(otpCodes).set({ used: true }).where(eq(otpCodes.id, otp.id));
    await db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    res.json({ message: 'Password has been reset. You can now sign in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Could not reset password.' });
  }
});

router.delete('/account', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.delete(users).where(eq(users.id, req.dbUser!.id));
    res.json({ message: 'Your account and associated data have been deleted.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Unable to delete account.' });
  }
});

export default router;
