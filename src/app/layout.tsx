import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { schemeScript } from '@/core/ui/SchemeToggle';
import '@/core/ui/base.css';

export const metadata: Metadata = {
  title: { default: 'Ponto do Pedido', template: '%s · Ponto do Pedido' },
  description: 'Plataforma de gestão para restaurantes com aplicativos independentes para cada área da operação.',
  applicationName: 'Ponto do Pedido',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0d10' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script id="pdp-scheme" strategy="beforeInteractive">
          {schemeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
