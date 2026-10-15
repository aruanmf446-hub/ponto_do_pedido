import { Lato, Lexend, Playfair_Display, Poppins, Work_Sans } from 'next/font/google';

export const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--at-f1' });
export const lexend = Lexend({ subsets: ['latin'], variable: '--at-f2' });
export const workSans = Work_Sans({ subsets: ['latin'], variable: '--at-f3' });
export const playfair = Playfair_Display({ subsets: ['latin'], variable: '--at-f4d' });
export const lato = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--at-f4' });

export const atendimentoFonts = [poppins.variable, lexend.variable, workSans.variable, playfair.variable, lato.variable].join(' ');
