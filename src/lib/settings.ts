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

  // Quran Aya
  quranBg: string;

  // Invitation (structured fields)
  invPrefix1En: string;
  invPrefix1Ar: string;
  invFather1En: string;
  invFather1Ar: string;
  invConnector1En: string;
  invConnector1Ar: string;
  invMother1En: string;
  invMother1Ar: string;
  invPrefix2En: string;
  invPrefix2Ar: string;
  invFather2En: string;
  invFather2Ar: string;
  invConnector2En: string;
  invConnector2Ar: string;
  invMother2En: string;
  invMother2Ar: string;
  invBodyEn: string;
  invBodyAr: string;
  invCoupleEn: string;
  invCoupleAr: string;
  invDateEn: string;
  invDateAr: string;
  // Legacy (kept for backward compat)
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
  whatsappUrl: string;

  // Envelope
  envelopeImage: string;
  sealImage: string;
  sfxEnabled: boolean;

  // Music
  musicFile: string;
  musicFileAr: string;

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

  quranBg: '',

  invPrefix1En: 'Al-Haj',
  invPrefix1Ar: 'الحاج',
  invFather1En: 'Mohamad Rida Rachidi',
  invFather1Ar: 'محمد رضا رشيدي',
  invConnector1En: '& his wife',
  invConnector1Ar: 'وعقيلته',
  invMother1En: 'Leila',
  invMother1Ar: 'ليلى',
  invPrefix2En: 'Mr.',
  invPrefix2Ar: 'السيد',
  invFather2En: 'Faysal Rachidi',
  invFather2Ar: 'فيصل رشيدي',
  invConnector2En: '& his wife',
  invConnector2Ar: 'وعقيلته',
  invMother2En: 'Hubaba',
  invMother2Ar: 'حبابة',
  invBodyEn: 'cordially invite you to attend\nthe wedding celebration of their children',
  invBodyAr: 'يدعونكم لحضور حفل زفاف ولديهما',
  invCoupleEn: 'Hussein & Suzan',
  invCoupleAr: 'حسين وسوزان',
  invDateEn: 'on June 12, 2026',
  invDateAr: 'في الثاني عشر من حزيران 2026',
  invitationTextEn: '',
  invitationTextAr: '',
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
  whatsappUrl: 'https://wa.me/96181538385',

  envelopeImage: '',
  sealImage: '',
  sfxEnabled: true,

  musicFile: '',
  musicFileAr: '',

  primaryColor: '#7a8b69',
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
