import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Default site settings
  await prisma.siteSettings.upsert({
    where: { id: 'main' },
    update: {},
    create: {
      id: 'main',
      data: {
        groomNameEn: 'Hussein',
        groomNameAr: 'حسين',
        brideNameEn: 'Suzan',
        brideNameAr: 'سوزان',
        weddingDate: 'June 12, 2026',
        heroImage: '',
        countdownDate: '2026-06-12T20:00:00',
        countdownBg: '',
        invitationTextEn: 'With joyous hearts,\nTogether with their families,\nHussein & Suzan\nrequest the honor of your presence\nat their wedding celebration\nJune 12, 2026',
        invitationTextAr: 'بقلوب مليئة بالفرح،\nبرفقة عائلتيهما،\nحسين و سوزان\nيتشرفان بدعوتكم لحضور\nحفل زفافهما\n١٢ يونيو ٢٠٢٦',
        invitationBg: '',
        eventDate: 'June 12, 2026',
        eventTime: '8:00 PM',
        venueNameEn: 'Plein Nature',
        venueNameAr: 'بلين ناتشر',
        venueAddressEn: 'Beirut, Lebanon',
        venueAddressAr: 'بيروت، لبنان',
        googleMapsUrl: 'https://maps.google.com',
        locationBg: '',
        timelineBg: '',
        giftTextEn: 'Your Presence is the only gift we truly need.\nBut if you wish to bless us further, our wedding registry can be found at:',
        giftTextAr: 'حضوركم هو الهدية الوحيدة التي نحتاجها حقاً.\nولكن إذا أردتم إسعادنا أكثر، يمكنكم ذلك عبر:',
        giftProviderName: 'Whish Money',
        giftAccountId: '31135154-03',
        giftPhone: '81538385',
        giftBg: '',
        rsvpDeadlineEn: 'May 1, 2026',
        rsvpDeadlineAr: '١ مايو ٢٠٢٦',
        rsvpBg: '',
        envelopeImage: '',
        sealImage: '',
        sfxEnabled: true,
        musicFile: '',
        primaryColor: '#C9A96E',
      },
    },
  });
  console.log('  ✓ Site settings');

  // Default timeline
  const timelineData = [
    { time: '8:00 PM', labelEn: 'Welcome Drink', labelAr: 'مشروب الاستقبال', sortOrder: 0 },
    { time: '9:00 PM', labelEn: 'Groom & Bride Entrance', labelAr: 'دخول العروسين', sortOrder: 1 },
    { time: '10:00 PM', labelEn: 'Dinner', labelAr: 'العشاء', sortOrder: 2 },
    { time: '11:00 PM', labelEn: 'Cake Cutting', labelAr: 'قطع الكعكة', sortOrder: 3 },
  ];

  for (const item of timelineData) {
    await prisma.timelineItem.create({ data: item });
  }
  console.log('  ✓ Timeline items');

  // Sample groups and guests
  const sampleGroups = [
    { groupCode: 'RACHIDI-FAM', maxGuests: 4, side: 'groom' },
    { groupCode: 'BRIDE-FAMILY', maxGuests: 4, side: 'bride' },
    { groupCode: 'FRIENDS-01', maxGuests: 2, side: 'groom' },
  ];

  for (const group of sampleGroups) {
    const created = await prisma.guestGroup.create({
      data: { ...group, token: uuidv4() },
    });
    console.log(`  ✓ Group: ${group.groupCode} (token: ${created.token})`);
  }

  // Sample guests
  const sampleGuests = [
    { name: 'Hussein Rachidi', phone: '81538385', side: 'groom', relation: 'Groom', groupCode: 'RACHIDI-FAM' },
    { name: 'Suzan Rachidi', side: 'bride', relation: 'Bride', groupCode: 'BRIDE-FAMILY' },
  ];

  for (const guest of sampleGuests) {
    await prisma.guest.create({ data: guest });
  }
  console.log('  ✓ Sample guests');

  console.log('\n✅ Seed complete!\n');

  // Print RSVP links
  const groups = await prisma.guestGroup.findMany();
  console.log('📎 RSVP Links:');
  for (const g of groups) {
    console.log(`  ${g.groupCode}: http://localhost:3000/?token=${g.token}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
