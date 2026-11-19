import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'inzufinder-rwanda-dev-secret-change-in-prod';

export interface JwtPayload {
  userId: number;
  uid: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function generateOtpCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function normalizeRwandaPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+250')) return digits;
  if (digits.startsWith('250') && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith('07') && digits.length === 10) return `+250${digits.slice(1)}`;
  return digits;
}
