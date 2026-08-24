'use client';

import SeatFinder from '@/components/SeatFinder';

export default function SeatsPage() {
  return (
    <div className="admin-root" style={{ minHeight: '100vh', background: 'var(--ad-bg)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '1.75rem 1.15rem 3rem' }}>
        <SeatFinder variant="public" />
      </div>
    </div>
  );
}
