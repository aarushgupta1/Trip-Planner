import type { Metadata, Viewport } from 'next';
import { Inter, IBM_Plex_Mono, Nanum_Pen_Script } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const nanumPen = Nanum_Pen_Script({ subsets: ['latin'], weight: '400', variable: '--font-nanum-pen' });
const plexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-plex-mono' });

export const metadata: Metadata = {
  title: 'Trip Planner',
  description: 'Plan a trip to anywhere — day-by-day itinerary, lodging, maps and weather.',
  // iOS ignores the manifest's icons/display fields for "Add to Home Screen"
  // — it only respects these tags (via Next's icons/appleWebApp metadata),
  // plus needs a PNG icon since it doesn't rasterize SVG apple-touch-icons.
  icons: { apple: '/apple-touch-icon.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Trips',
  },
};

export const viewport: Viewport = {
  themeColor: '#1f4fd8',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className={`${inter.variable} ${plexMono.variable} ${nanumPen.variable} h-full antialiased`} suppressHydrationWarning>
        <div className="brand-rule" aria-hidden />
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
