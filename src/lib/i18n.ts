export type Locale = 'en' | 'ar';

export const translations = {
  en: {
    // Envelope
    tapToOpen: 'Tap to open',
    // Hero
    areGettingMarried: 'are getting married',
    scrollDown: 'Scroll down',
    // Countdown
    days: 'Days',
    hours: 'Hours',
    minutes: 'Minutes',
    seconds: 'Seconds',
    countdownTo: 'Counting down to our special day',
    // Invitation
    bismillah: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
    quranVerse: '﴿ وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً ۚ إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِّقَوْمٍ يَتَفَكَّرُونَ ﴾',
    sadaqAllah: 'صدق الله العظيم',
    // Location
    dateLabel: 'Date',
    timeLabel: 'Time',
    venueLabel: 'Venue',
    addressLabel: 'Address',
    viewMap: 'View Map',
    // Timeline
    programTitle: 'Wedding Program',
    // Gift
    giftTitle: 'Gift Registry',
    // RSVP
    rsvpTitle: 'RSVP',
    attending: 'Attending',
    notAttending: 'Not Attending',
    maxGuests: 'Max Guests',
    numberAttending: 'Number Attending',
    guestName: 'Guest Name',
    confirm: 'Confirm',
    confirmBy: 'Kindly Confirm by',
    rsvpSuccess: 'Thank you! Your RSVP has been recorded.',
    rsvpUpdated: 'Your RSVP has been updated.',
    rsvpError: 'Something went wrong. Please try again.',
    guest: 'Guest',
    // Audio
    mute: 'Mute',
    unmute: 'Unmute',
    // Language
    switchLang: 'العربية',
    // General
    weddingOf: 'The Wedding of',
    and: '&',
  },
  ar: {
    tapToOpen: 'انقر للفتح',
    areGettingMarried: 'يحتفلان بزفافهما',
    scrollDown: 'مرر للأسفل',
    days: 'أيام',
    hours: 'ساعات',
    minutes: 'دقائق',
    seconds: 'ثواني',
    countdownTo: 'العد التنازلي ليومنا المميز',
    bismillah: 'بِسْمِ ٱللَّٰهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ',
    quranVerse: '﴿ وَمِنْ آيَاتِهِ أَنْ خَلَقَ لَكُم مِّنْ أَنفُسِكُمْ أَزْوَاجًا لِّتَسْكُنُوا إِلَيْهَا وَجَعَلَ بَيْنَكُم مَّوَدَّةً وَرَحْمَةً ۚ إِنَّ فِي ذَٰلِكَ لَآيَاتٍ لِّقَوْمٍ يَتَفَكَّرُونَ ﴾',
    sadaqAllah: 'صدق الله العظيم',
    dateLabel: 'التاريخ',
    timeLabel: 'الوقت',
    venueLabel: 'المكان',
    addressLabel: 'العنوان',
    viewMap: 'عرض الخريطة',
    programTitle: 'برنامج الحفل',
    giftTitle: 'سجل الهدايا',
    rsvpTitle: 'تأكيد الحضور',
    attending: 'سأحضر',
    notAttending: 'لن أحضر',
    maxGuests: 'الحد الأقصى للضيوف',
    numberAttending: 'عدد الحاضرين',
    guestName: 'اسم الضيف',
    confirm: 'تأكيد',
    confirmBy: 'يرجى التأكيد قبل',
    rsvpSuccess: 'شكراً لك! تم تسجيل ردك.',
    rsvpUpdated: 'تم تحديث ردك.',
    rsvpError: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
    guest: 'ضيف',
    mute: 'كتم الصوت',
    unmute: 'تشغيل الصوت',
    switchLang: 'English',
    weddingOf: 'حفل زفاف',
    and: 'و',
  },
} as const;

export function t(locale: Locale, key: keyof typeof translations.en): string {
  return translations[locale][key] || translations.en[key] || key;
}
