// Fontes compartilhadas pelos canais públicos (Cardápio e Delivery). Cada família
// é declarada uma única vez: o build da Vercel rejeita a mesma família do Google
// Fonts carregada duas vezes com variáveis diferentes ("queries have exactly one entry").
import { Cormorant_Garamond, Jost, Lato, Playfair_Display, Plus_Jakarta_Sans } from 'next/font/google';

export const cormorantDisplay = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--pdp-serif' });
export const jostText = Jost({ subsets: ['latin'], variable: '--pdp-text' });
export const playfairDisplay = Playfair_Display({ subsets: ['latin'], variable: '--pdp-playfair' });
export const latoText = Lato({ subsets: ['latin'], weight: ['400', '700'], variable: '--pdp-lato' });
export const jakartaText = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--pdp-jakarta' });
