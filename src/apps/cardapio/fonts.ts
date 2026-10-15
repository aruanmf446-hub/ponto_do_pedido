import { Cormorant_Garamond, Jost } from 'next/font/google';

export const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--cd-display' });
export const jost = Jost({ subsets: ['latin'], variable: '--cd-text' });

export const cardapioFonts = `${cormorant.variable} ${jost.variable}`;
