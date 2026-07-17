import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.therachidis.com'),
  title: 'Hussein & Suzan — Wedding Invitation',
  description: 'You are cordially invited to celebrate the wedding of Hussein & Suzan',
  openGraph: {
    title: 'Wedding of Hussein & Suzan',
    description: 'You are warmly invited — 25 August 2026, Pleine Nature',
    type: 'website',
    url: 'https://www.therachidis.com',
    siteName: 'Hussein & Suzan',
    locale: 'en_GB',
    images: [
      {
        url: 'https://www.therachidis.com/images/og-wide.jpg',
        width: 1200,
        height: 630,
        alt: 'Hussein & Suzan — Wedding Invitation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wedding of Hussein & Suzan',
    description: 'You are warmly invited — 25 August 2026, Pleine Nature',
    images: ['https://www.therachidis.com/images/og-wide.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-[#F7F7F5]">{children}</body>
    </html>
  );
}
