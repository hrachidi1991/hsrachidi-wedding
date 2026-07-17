'use client';

import { useEffect, useState } from 'react';

// Rotating, bilingual lines shown while media caches. Primary follows the page
// language; the twin (other language) sits beneath it.
interface Line { en: string; ar: string }
const LINES: Line[] = [
  { en: 'Preparing your invitation…', ar: 'نُحضّر دعوتكم…' },
  { en: 'Setting the scene for a love story…', ar: 'لحظاتٌ وتبدأ الحكاية…' },
  { en: 'Gathering every little detail…', ar: 'نُنسّق كلّ التفاصيل…' },
  { en: 'Almost ready…', ar: 'أوشكنا على الوصول…' },
];

export default function Preloader({
  locale,
  isRtl,
  reducedMotion,
  ready,
  onDone,
}: {
  locale: string;
  isRtl: boolean;
  reducedMotion: boolean;
  ready: boolean;
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [hiding, setHiding] = useState(false);

  // rotate the lines while loading
  useEffect(() => {
    if (reducedMotion) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % LINES.length), 2400);
    return () => clearInterval(t);
  }, [reducedMotion]);

  // fade out once everything is cached, then unmount
  useEffect(() => {
    if (!ready) return;
    setHiding(true);
    const t = setTimeout(onDone, reducedMotion ? 60 : 850);
    return () => clearTimeout(t);
  }, [ready, reducedMotion, onDone]);

  const line = LINES[idx];
  const isAr = locale === 'ar';
  const primary = isAr ? line.ar : line.en;
  const twin = isAr ? line.en : line.ar;

  return (
    <div className={`preloader${hiding ? ' is-hiding' : ''}`} role="status" aria-live="polite" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="preloader-inner">
        <div className="preloader-monogram" aria-hidden="true">H&nbsp;&amp;&nbsp;S</div>
        <div className={`preloader-ring${reducedMotion ? ' is-static' : ''}`} aria-hidden="true" />
        <div className="preloader-lines">
          <span key={`p-${idx}`} className={`preloader-line preloader-line--primary${isAr ? ' ar' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
            {primary}
          </span>
          <span key={`t-${idx}`} className={`preloader-line preloader-line--twin${isAr ? '' : ' ar'}`} dir={isAr ? 'ltr' : 'rtl'}>
            {twin}
          </span>
        </div>
      </div>
    </div>
  );
}
