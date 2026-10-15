import { Archivo_Narrow, Chivo, Chivo_Mono, Karla, Lexend, Work_Sans } from 'next/font/google';

export const archivoNarrow = Archivo_Narrow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--es-f1' });
export const chivoMono = Chivo_Mono({ subsets: ['latin'], variable: '--es-f1m' });
export const lexend = Lexend({ subsets: ['latin'], variable: '--es-f2' });
export const karla = Karla({ subsets: ['latin'], variable: '--es-f3' });
export const chivo = Chivo({ subsets: ['latin'], variable: '--es-f3d' });
export const workSans = Work_Sans({ subsets: ['latin'], variable: '--es-f4' });

export const estoqueFonts = [archivoNarrow.variable, chivoMono.variable, lexend.variable, karla.variable, chivo.variable, workSans.variable].join(' ');
