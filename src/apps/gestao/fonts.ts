import { Fraunces, IBM_Plex_Sans, Source_Sans_3, Space_Grotesk } from 'next/font/google';

// Cada modelo visual tem a própria tipografia.
export const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--gs-f1' });
export const fraunces = Fraunces({ subsets: ['latin'], variable: '--gs-f2' });
export const sourceSans = Source_Sans_3({ subsets: ['latin'], variable: '--gs-f3' });
export const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--gs-f4' });

export const gestaoFonts = [plex.variable, fraunces.variable, sourceSans.variable, grotesk.variable].join(' ');
