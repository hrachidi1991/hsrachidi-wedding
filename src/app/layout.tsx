import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://www.therachidis.com'),
  title: 'Hussein & Suzan — Wedding Invitation',
  description: 'You are cordially invited to celebrate the wedding of Hussein & Suzan',
  openGraph: {
    title: 'Wedding of Hussein & Suzan',
    description: 'Wedding invitation',
    type: 'article',
    url: 'https://www.therachidis.com',
    siteName: 'www.therachidis.com',
    locale: 'en_GB',
    images: 'https://www.therachidis.com/images/og-small.jpg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-[#f0ede8]">{children}</body>
    </html>
  );
}
