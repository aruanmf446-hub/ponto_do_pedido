import { Cormorant_Garamond, Jost, Lato, Outfit, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';

export const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--cd-display' });
export const jost = Jost({ subsets: ['latin'], variable: '--cd-text' });
export const outfit = Outfit({ subsets: ['latin'], variable: '--cd-f2' });
export const playfair = Playfair_Display({ subsets: ['latin'], variable: '--cd-f3d' });
export const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--cd-f3' });
export const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--cd-f4' });

export const cardapioFonts = [cormorant.variable, jost.variable, outfit.variable, playfair.variable, lato.variable, jakarta.variable].join(' ');
