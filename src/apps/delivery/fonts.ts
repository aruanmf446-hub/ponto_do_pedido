import { Bricolage_Grotesque, Cormorant_Garamond, Figtree, Jost, Lato, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';

export const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--dl-display' });
export const figtree = Figtree({ subsets: ['latin'], variable: '--dl-text' });
export const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--dl-f1d' });
export const jost = Jost({ subsets: ['latin'], variable: '--dl-f1' });
export const playfair = Playfair_Display({ subsets: ['latin'], variable: '--dl-f3d' });
export const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--dl-f3' });
export const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--dl-f4' });

export const deliveryFonts = [bricolage.variable, figtree.variable, cormorant.variable, jost.variable, playfair.variable, lato.variable, jakarta.variable].join(' ');
