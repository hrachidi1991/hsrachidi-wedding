import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://www.therachidis.com'),
  title: 'Hussein & Suzan — Wedding Invitation',
  description: 'You are cordially invited to celebrate the wedding of Hussein & Suzan',
  openGraph: {
    title: 'Wedding of Hussein & Suzan',
    description: 'Wedding invitation',
    type: 'website',
    siteName: 'www.therachidis.com',
    images: [
      {
        url: '/images/og-preview-wide.jpg',
        width: 1200,
        height: 630,
        type: 'image/jpeg',
        alt: 'Hussein & Suzan Wedding Invitation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Wedding of Hussein & Suzan',
    description: 'Wedding invitation',
    images: ['/images/og-preview-wide.jpg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-[#9B9B9B] text-white">{children}</body>
    </html>
  );
}
