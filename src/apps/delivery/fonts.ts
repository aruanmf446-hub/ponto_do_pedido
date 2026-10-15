import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { cormorantDisplay, jakartaText, jostText, latoText, playfairDisplay } from '@/core/fonts';

export const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--dl-display' });
export const figtree = Figtree({ subsets: ['latin'], variable: '--dl-text' });

export const deliveryFonts = [bricolage.variable, figtree.variable, cormorantDisplay.variable, jostText.variable, playfairDisplay.variable, latoText.variable, jakartaText.variable].join(' ');
