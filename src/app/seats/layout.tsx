import '../admin.css';

export const metadata = {
  title: 'Find Your Seat · Hussein & Suzan',
  description: 'Search your name to find your table and seat at Pleine Nature.',
  robots: { index: false, follow: false },
  // Dedicated WhatsApp/social preview for the seat finder — the venue map,
  // NOT the wedding-invitation photo used by the rest of the site.
  openGraph: {
    title: 'Find Your Seat — Hussein & Suzan',
    description: 'Tap to search your name and find your table at Pleine Nature · 25 August 2026',
    type: 'website',
    url: 'https://www.therachidis.com/seats',
    siteName: 'Hussein & Suzan',
    images: [
      {
        url: 'https://www.therachidis.com/images/og-seats.jpg',
        width: 1200,
        height: 630,
        alt: 'Seating map — find your seat at the wedding of Hussein & Suzan',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find Your Seat — Hussein & Suzan',
    description: 'Tap to search your name and find your table at Pleine Nature · 25 August 2026',
    images: ['https://www.therachidis.com/images/og-seats.jpg'],
  },
};

export default function SeatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
