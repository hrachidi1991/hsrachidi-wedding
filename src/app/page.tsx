import { getSettings } from '@/lib/settings';
import prisma from '@/lib/db';
import WeddingPage from '@/components/WeddingPage';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();
  
  let timelineItems: any[] = [];
  try {
    timelineItems = await prisma.timelineItem.findMany({ orderBy: { sortOrder: 'asc' } });
  } catch {}

  // If there's a token, load group info
  let rsvpData = null;
  if (params.token) {
    try {
      const group = await prisma.guestGroup.findUnique({
        where: { token: params.token },
        include: { rsvpResponse: true },
      });
      if (group) {
        const guests = await prisma.guest.findMany({
          where: { groupCode: group.groupCode },
        });
        rsvpData = {
          token: params.token,
          groupCode: group.groupCode,
          maxGuests: group.maxGuests,
          side: group.side,
          guests,
          rsvp: group.rsvpResponse
            ? {
                attending: group.rsvpResponse.attending,
                numberAttending: group.rsvpResponse.numberAttending,
                guestNames: group.rsvpResponse.guestNames as string[],
              }
            : null,
        };
      }
    } catch {}
  }

  return (
    <WeddingPage
      settings={settings}
      timelineItems={timelineItems}
      rsvpData={rsvpData}
    />
  );
}
