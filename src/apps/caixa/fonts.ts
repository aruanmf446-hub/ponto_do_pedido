import { IBM_Plex_Sans_Condensed, JetBrains_Mono, Nunito, Outfit } from 'next/font/google';

export const outfit = Outfit({ subsets: ['latin'], variable: '--cx-f1' });
export const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--cx-f2' });
export const nunito = Nunito({ subsets: ['latin'], variable: '--cx-f3' });
export const plexCondensed = IBM_Plex_Sans_Condensed({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--cx-f4' });

export const caixaFonts = [outfit.variable, jetbrains.variable, nunito.variable, plexCondensed.variable].join(' ');
