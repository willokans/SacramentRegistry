import type { Metadata, Viewport } from 'next';
import { ParishProvider } from '@/context/ParishContext';
import IdleSessionManager from '@/components/IdleSessionManager';
import { PWARegister } from '@/components/PWARegister';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sacrament Registry',
  description: 'Sacramental records',
  appleWebApp: {
    title: 'Sacrament Registry',
    capable: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#7a1e3a" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/icon-512.png" />
        <link rel="icon" href="/icons/icon-192.png" sizes="192x192" type="image/png" />
      </head>
      <body>
        <ParishProvider>
          <IdleSessionManager />
          <PWARegister />
          {children}
        </ParishProvider>
      </body>
    </html>
  );
}
