import fs from 'fs';
import path from 'path';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8')) as { projectId?: string };
      return parsed.projectId;
    }
  } catch {
    // Ignore missing or unreadable config file
  }
  return undefined;
}

let resolvedAdminAuth: Auth | null = null;
try {
  if (!getApps().length) {
    const projectId = resolveFirebaseProjectId();
    initializeApp(projectId ? { projectId } : undefined);
  }
  resolvedAdminAuth = getAuth();
} catch (err) {
  console.warn('Firebase Admin initialization skipped:', err);
}

export const adminAuth = resolvedAdminAuth;
