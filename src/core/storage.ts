import { config } from '@/core/config';

/** URL pública de mídia do restaurante (logo, fotos de produtos). */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `${config.app.url}/storage/v1/object/public/tenant-media/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
