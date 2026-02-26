import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://hsrachidi.com'),
  title: 'Hussein & Suzan — Wedding Invitation',
  description: 'You are cordially invited to celebrate the wedding of Hussein & Suzan',
  openGraph: {
    title: 'Hussein & Suzan — Wedding',
    description: 'You are cordially invited to celebrate our wedding',
    type: 'website',
    images: [
      {
        url: '/images/og-preview.JPG',
        width: 1200,
        height: 630,
        alt: 'Hussein & Suzan Wedding Invitation',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hussein & Suzan — Wedding',
    description: 'You are cordially invited to celebrate our wedding',
    images: ['/images/og-preview.JPG'],
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
