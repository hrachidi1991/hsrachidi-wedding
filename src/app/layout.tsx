import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hussein & Suzan — Wedding Invitation',
  description: 'You are cordially invited to celebrate the wedding of Hussein & Suzan',
  openGraph: {
    title: 'Hussein & Suzan — Wedding',
    description: 'You are cordially invited to celebrate our wedding',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="bg-cream-50 text-charcoal-900">{children}</body>
    </html>
  );
}
