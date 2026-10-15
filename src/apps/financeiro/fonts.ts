import { DM_Mono, IBM_Plex_Mono, Libre_Franklin, Manrope, Source_Serif_4, Space_Grotesk } from 'next/font/google';

export const sourceSerif = Source_Serif_4({ subsets: ['latin'], variable: '--fn-f1' });
export const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--fn-f2' });
export const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--fn-f2m' });
export const libreFranklin = Libre_Franklin({ subsets: ['latin'], variable: '--fn-f3' });
export const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--fn-f3m' });
export const manrope = Manrope({ subsets: ['latin'], variable: '--fn-f4' });

export const financeiroFonts = [sourceSerif.variable, spaceGrotesk.variable, plexMono.variable, libreFranklin.variable, dmMono.variable, manrope.variable].join(' ');
