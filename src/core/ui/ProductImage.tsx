import { mediaUrl } from '@/core/storage';
import { FoodArt } from '@/core/ui/FoodArt';

/** Foto do produto quando existe; ilustração própria quando não. */
export function ProductImage({ name, path, category, className }: { name: string; path?: string | null; category?: string | null; className?: string }) {
  const src = mediaUrl(path);
  if (src) return <img className={['pdp-product-img', className].filter(Boolean).join(' ')} src={src} alt={name} loading="lazy" />;
  return <FoodArt name={name} category={category} className={className} />;
}
