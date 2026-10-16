import { Big_Shoulders, Bricolage_Grotesque, Fraunces, Inter, Manrope, Sora } from 'next/font/google';

export const display = Manrope({ subsets: ['latin'], variable: '--pl-display', weight: ['500', '700', '800'] });
export const text = Inter({ subsets: ['latin'], variable: '--pl-text' });
export const editorial = Fraunces({ subsets: ['latin'], variable: '--pl-serif' });
export const sora = Sora({ subsets: ['latin'], variable: '--pl-sora' });
export const condensed = Big_Shoulders({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--pl-condensed' });

// O eixo wdth da Bricolage vai de 75 a 100; o m1 usa a largura máxima.
export const azulejo = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['wdth', 'opsz'],
  variable: '--pl-azulejo',
  display: 'swap',
});
