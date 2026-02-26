import { getSettings } from '@/lib/settings';
import prisma from '@/lib/db';
import WeddingPage from '@/components/WeddingPage';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ g?: string; token?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();

  // Support both ?g=<groupCode> (new short link) and ?token=<uuid> (legacy)
  const groupCode = params.g;
  const legacyToken = params.token;
  let rsvpData = null;
  if (groupCode || legacyToken) {
    try {
      const group = groupCode
        ? await prisma.guestGroup.findUnique({ where: { groupCode }, include: { rsvpResponse: true } })
        : await prisma.guestGroup.findUnique({ where: { token: legacyToken! }, include: { rsvpResponse: true } });
      if (group) {
        const guests = await prisma.guest.findMany({
          where: { groupCode: group.groupCode },
        });
        rsvpData = {
          groupCode: group.groupCode,
          maxGuests: group.maxGuests,
          side: group.side,
          guests,
          rsvp: group.rsvpResponse
            ? {
                attending: group.rsvpResponse.attending,
                numberAttending: group.rsvpResponse.numberAttending,
                guestNames: group.rsvpResponse.guestNames as any,
              }
            : null,
        };
      }
    } catch {}
  }

  return (
    <WeddingPage
      settings={settings}
      rsvpData={rsvpData}
    />
  );
}
