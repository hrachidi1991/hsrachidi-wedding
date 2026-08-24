import '../admin.css';

export const metadata = {
  title: 'Find Your Seat · Hussein & Suzan',
  description: 'Search your name to find your seat.',
  robots: { index: false, follow: false },
};

export default function SeatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
