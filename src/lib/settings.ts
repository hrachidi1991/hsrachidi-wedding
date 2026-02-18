import prisma from './db';

export interface SiteContent {
  // Hero
  groomNameEn: string;
  groomNameAr: string;
  brideNameEn: string;
  brideNameAr: string;
  weddingDate: string;
  heroImage: string;

  // Countdown
  countdownDate: string;
  countdownBg: string;

  // Invitation
  invitationTextEn: string;
  invitationTextAr: string;
  invitationBg: string;

  // Location
  eventDate: string;
  eventTime: string;
  venueNameEn: string;
  venueNameAr: string;
  venueAddressEn: string;
  venueAddressAr: string;
  googleMapsUrl: string;
  locationBg: string;

  // Timeline
  timelineBg: string;

  // Gift
  giftTextEn: string;
  giftTextAr: string;
  giftProviderName: string;
  giftAccountId: string;
  giftPhone: string;
  giftBg: string;

  // RSVP
  rsvpDeadlineEn: string;
  rsvpDeadlineAr: string;
  rsvpBg: string;

  // Envelope
  envelopeImage: string;
  sealImage: string;
  sfxEnabled: boolean;

  // Music
  musicFile: string;

  // General
  primaryColor: string;
}

export const defaultSettings: SiteContent = {
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
};

export async function getSettings(): Promise<SiteContent> {
  try {
    const record = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    if (!record) return defaultSettings;
    return { ...defaultSettings, ...(record.data as object) };
  } catch {
    return defaultSettings;
  }
}

export async function updateSettings(data: Partial<SiteContent>): Promise<SiteContent> {
  const current = await getSettings();
  const merged = { ...current, ...data };
  await prisma.siteSettings.upsert({
    where: { id: 'main' },
    update: { data: merged as any },
    create: { id: 'main', data: merged as any },
  });
  return merged;
}
