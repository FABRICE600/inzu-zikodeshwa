import fs from 'fs';
import path from 'path';

export function getUploadsDir(): string {
  const dir =
    process.env.VERCEL === '1'
      ? '/tmp/uploads'
      : path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}
