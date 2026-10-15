import { Bricolage_Grotesque, Figtree } from 'next/font/google';

export const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--dl-display' });
export const figtree = Figtree({ subsets: ['latin'], variable: '--dl-text' });

export const deliveryFonts = `${bricolage.variable} ${figtree.variable}`;
