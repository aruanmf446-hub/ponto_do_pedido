import { Outfit } from 'next/font/google';
import { cormorantDisplay, jakartaText, jostText, latoText, playfairDisplay } from '@/core/fonts';

export const outfit = Outfit({ subsets: ['latin'], variable: '--cd-f2' });

export const cardapioFonts = [cormorantDisplay.variable, jostText.variable, outfit.variable, playfairDisplay.variable, latoText.variable, jakartaText.variable].join(' ');
