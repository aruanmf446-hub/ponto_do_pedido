import { Fraunces, Inter, Manrope, Sora } from 'next/font/google';

export const display = Manrope({ subsets: ['latin'], variable: '--pl-display', weight: ['500', '700', '800'] });
export const text = Inter({ subsets: ['latin'], variable: '--pl-text' });
export const editorial = Fraunces({ subsets: ['latin'], variable: '--pl-serif' });
export const sora = Sora({ subsets: ['latin'], variable: '--pl-sora' });
