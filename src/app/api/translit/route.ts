import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';

// Curated Arabic spellings for common Lebanese names (Google's generic
// transliteration gets many of these wrong). Keys are lowercased, letters only.
const LEBANESE: Record<string, string> = {
  // corrections where the generic transliteration is wrong
  fatima: 'فاطمة', fatimah: 'فاطمة',
  souad: 'سعاد', suad: 'سعاد',
  wael: 'وائل',
  aya: 'آية',
  lea: 'ليا', leah: 'ليا',
  leila: 'ليلى', laila: 'ليلى', layla: 'ليلى',
  lana: 'لانا',
  naya: 'نايا',
  rida: 'رضا', ridha: 'رضا', reda: 'رضا',
  faour: 'فاعور', faoue: 'فاعور',
  khalife: 'خليفة', khalifeh: 'خليفة',
  kanso: 'كنسو',
  bella: 'بيلا',
  fakhran: 'فخران',
  abbas: 'عباس', abbass: 'عباس',
  sabagh: 'صباغ', sabbagh: 'صباغ',
  sawli: 'الصولي',
  hrajli: 'حرجلي',
  khreiss: 'خريّص',
  // common Lebanese names — guarantee the right spelling
  mohamad: 'محمد', mohammad: 'محمد', muhammad: 'محمد', mohammed: 'محمد', mohamed: 'محمد',
  ahmad: 'أحمد', ahmed: 'أحمد', ahamad: 'أحمد',
  ali: 'علي',
  hussein: 'حسين', hussain: 'حسين', houssein: 'حسين',
  hassan: 'حسن',
  rachidi: 'رشيدي', rashidi: 'رشيدي',
  khodor: 'خضر', khoder: 'خضر', khodr: 'خضر',
  baydoun: 'بيضون', yakzan: 'يقظان', ghali: 'غالي', serhan: 'سرحان',
};

// Latin → Arabic name transliteration for the Guest List display-name popup.
// Proxies Google Input Tools server-side (the endpoint sends no CORS headers, so
// the browser can't call it directly). Admin-only. Each word is transliterated
// separately for better results; words already in Arabic are left untouched.
export async function GET(request: NextRequest) {
  if (!requireAdmin(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const text = (request.nextUrl.searchParams.get('text') || '').trim();
  if (!text) return NextResponse.json({ arabic: '' });

  const words = text.split(/\s+/).slice(0, 8);
  const out: string[] = [];
  for (const w of words) {
    if (!/[a-zA-Z]/.test(w)) { out.push(w); continue; } // keep non-Latin words as-is
    const key = w.toLowerCase().replace(/[^a-z]/g, '');
    if (LEBANESE[key]) { out.push(LEBANESE[key]); continue; } // curated Lebanese spelling wins
    try {
      const url = `https://inputtools.google.com/request?text=${encodeURIComponent(w)}&itc=ar-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;
      const r = await fetch(url, { cache: 'no-store' });
      const data = await r.json();
      const cand = data?.[0] === 'SUCCESS' ? data?.[1]?.[0]?.[1]?.[0] : null;
      out.push(typeof cand === 'string' && cand ? cand : w);
    } catch {
      out.push(w);
    }
  }
  return NextResponse.json({ arabic: out.join(' ') });
}
