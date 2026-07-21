// Shared WhatsApp invite helpers (used by Guest List + RSVP admin pages).

import { encodeGroupCode } from '@/lib/linkCode';

export interface EventInfo {
  date: string; time: string; venue: string;
  dateAr: string; timeAr: string; venueAr: string;
}

export const defaultEventInfo: EventInfo = {
  date: '25 August', time: '8:00 PM', venue: 'Pleine Nature',
  dateAr: '٢٥ آب', timeAr: '٨:٠٠ مساءً', venueAr: 'Pleine Nature',
};

// Build EventInfo from the /api/settings blob (falls back to defaults).
export function eventInfoFromSettings(st: any): EventInfo {
  const d = new Date(st?.eventDate);
  const validD = !isNaN(d.getTime());
  return {
    date: validD ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : (st?.eventDate || '25 August'),
    time: st?.eventTime || '8:00 PM',
    venue: st?.venueNameEn || 'Pleine Nature',
    dateAr: validD ? d.toLocaleDateString('ar', { day: 'numeric', month: 'long' }) : (st?.eventDate || '٢٥ آب'),
    timeAr: st?.eventTimeAr || st?.eventTime || '٨:٠٠ مساءً',
    venueAr: st?.venueNameAr || st?.venueNameEn || 'Pleine Nature',
  };
}

// Normalize a phone for wa.me (default Lebanon +961), then strip the leading + so wa.me gets pure digits.
export function formatPhoneForWhatsApp(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0') && !p.startsWith('+')) p = '+961' + p.slice(1);
  if (!p.startsWith('+') && p.length <= 8) p = '+961' + p;
  if (!p.startsWith('+')) p = '+' + p;
  return p.replace('+', '');
}

// The invite link off the site root, keyed by group code. `lang='ar'` opens it in
// Arabic; `editToken` makes it an "update link" that re-opens editing for a group
// that already responded.
export function inviteLink(groupCode: string, lang: 'en' | 'ar' = 'en', editToken?: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  let url = `${origin}/?g=${encodeGroupCode(groupCode)}`;
  if (editToken) url += `&edit=${editToken}`;
  if (lang === 'ar') url += '&lang=ar';
  return url;
}

export function whatsAppUrl(phone: string, name: string, link: string, ev: EventInfo, lang: 'en' | 'ar' = 'en'): string {
  const msg =
    lang === 'ar'
      ? `مرحباً *${name}*،\n` +
        `يسعدنا دعوتكم لحضور حفل زفاف *حسين وسوزان* 💍\n` +
        `\n\n` +
        `📅 ${ev.dateAr}\n` +
        `🕐 ${ev.timeAr}\n` +
        `📍 ${ev.venueAr}\n` +
        `\n` +
        `نرجو تأكيد الحضور من هنا:\n` +
        `${link}`
      : `Hello *${name}*,\n` +
        `You're warmly invited to the wedding of *Hussein & Suzan* 💍\n` +
        `\n\n` +
        `📅 ${ev.date}\n` +
        `🕐 ${ev.time}\n` +
        `📍 ${ev.venue}\n` +
        `\n` +
        `Kindly RSVP here:\n` +
        `${link}`;
  return `https://wa.me/${formatPhoneForWhatsApp(phone)}?text=${encodeURIComponent(msg)}`;
}
