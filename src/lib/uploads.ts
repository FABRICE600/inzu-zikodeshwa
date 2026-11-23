import fs from 'fs';
import path from 'path';

export function getUploadsDir(): string {
  const preferredDir =
    process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? '/tmp/uploads'
      : path.resolve(process.cwd(), 'uploads');
  try {
    if (!fs.existsSync(preferredDir)) {
      fs.mkdirSync(preferredDir, { recursive: true });
    }
    return preferredDir;
  } catch {
    const fallbackDir = '/tmp/uploads';
    if (!fs.existsSync(fallbackDir)) {
      fs.mkdirSync(fallbackDir, { recursive: true });
    }
    return fallbackDir;
  }
}
