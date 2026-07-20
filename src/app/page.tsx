import { getSettings } from '@/lib/settings';
import prisma from '@/lib/db';
import WeddingPage from '@/components/WeddingPage';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ g?: string; token?: string; edit?: string; lang?: string }> }) {
  const params = await searchParams;
  const settings = await getSettings();

  // Language-specific invite links (?lang=ar) open the page directly in that language.
  const initialLocale = params.lang === 'ar' ? 'ar' : 'en';

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
        // Editing an already-submitted response is only allowed via the couple's
        // update link (?edit=<group token>). The normal invite link is submit-once.
        const allowEdit = !!(params.edit && params.edit === group.token);
        // Public read — expose ONLY what the RSVP form needs (names). Never ship
        // phone / relation / circle / notes / rsvpManual to the client.
        const guests = await prisma.guest.findMany({
          where: { groupCode: group.groupCode },
          select: { id: true, name: true, displayName: true, sortOrder: true },
          orderBy: { sortOrder: 'asc' },
        });
        rsvpData = {
          groupCode: group.groupCode,
          maxGuests: group.maxGuests,
          side: group.side,
          guests,
          allowEdit,
          editToken: allowEdit ? group.token : null,
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
      initialLocale={initialLocale}
    />
  );
}
