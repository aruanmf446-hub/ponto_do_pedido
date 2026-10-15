import { Archivo, Barlow, Oswald, Roboto_Mono, Rubik } from 'next/font/google';

export const barlow = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--kz-f1' });
export const oswald = Oswald({ subsets: ['latin'], variable: '--kz-f2d' });
export const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--kz-f2' });
export const archivo = Archivo({ subsets: ['latin'], variable: '--kz-f3' });
export const rubik = Rubik({ subsets: ['latin'], variable: '--kz-f4' });

export const cozinhaFonts = [barlow.variable, oswald.variable, robotoMono.variable, archivo.variable, rubik.variable].join(' ');
