'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SiteContent } from '@/lib/settings';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface TimelineItem {
  id: string;
  time: string;
  labelEn: string;
  labelAr: string;
  sortOrder: number;
}

interface RsvpData {
  token: string;
  groupCode: string;
  maxGuests: number;
  side: string;
  guests: any[];
  rsvp: { attending: boolean; numberAttending: number; guestNames: string[] } | null;
}

interface Props {
  settings: SiteContent;
  timelineItems: TimelineItem[];
  rsvpData: RsvpData | null;
}

export default function WeddingPage({ settings, timelineItems, rsvpData }: Props) {
  const [locale, setLocale] = useState<Locale>('en');
  const [envelopeOpened, setEnvelopeOpened] = useState(false);
  const [sealBreaking, setSealBreaking] = useState(false);
  const [flapsOpening, setFlapsOpening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // RSVP State
  const [rsvpAttending, setRsvpAttending] = useState<boolean | null>(
    rsvpData?.rsvp?.attending ?? null
  );
  const [numAttending, setNumAttending] = useState(rsvpData?.rsvp?.numberAttending || 1);
  const [guestNames, setGuestNames] = useState<string[]>(
    rsvpData?.rsvp?.guestNames || new Array(rsvpData?.maxGuests || 4).fill('')
  );
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState('');

  // Countdown
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Visibility observer for animations
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set());

  useEffect(() => {
    const target = new Date(settings.countdownDate).getTime();
    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, target - now);
      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [settings.countdownDate]);

  // Switch music track when locale changes
  const currentMusicSrc = locale === 'ar' && settings.musicFileAr ? settings.musicFileAr : settings.musicFile;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const newSrc = locale === 'ar' && settings.musicFileAr ? settings.musicFileAr : settings.musicFile;
    if (!newSrc) return;
    // Only switch if src actually changed
    if (audio.src.endsWith(newSrc)) return;
    const wasPlaying = isPlaying;
    const currentTime = audio.currentTime;
    audio.src = newSrc;
    audio.load();
    if (wasPlaying) {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, [locale, settings.musicFile, settings.musicFileAr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Intersection observer for section animations
  useEffect(() => {
    if (!showContent) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = parseInt(entry.target.getAttribute('data-section') || '0');
          if (entry.isIntersecting) {
            setVisibleSections((prev) => new Set(prev).add(idx));
          }
        });
      },
      { threshold: 0.3 }
    );

    document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showContent]);

  const handleOpenEnvelope = useCallback(() => {
    setSealBreaking(true);
    // Play SFX
    if (settings.sfxEnabled) {
      try {
        const sfx = new Audio('/audio/seal-open.mp3');
        sfx.volume = 0.5;
        sfx.play().catch(() => {});
      } catch {}
    }

    // t=700ms: Seal animation finishes → open flaps + start music
    setTimeout(() => {
      setFlapsOpening(true);
      // Start music
      if (currentMusicSrc && audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }, 700);

    // t=2000ms: Flaps done → reveal content
    setTimeout(() => {
      setEnvelopeOpened(true);
      setShowContent(true);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }, 2000);
  }, [settings, currentMusicSrc]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleLocale = () => {
    setLocale((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const isRtl = locale === 'ar';

  const handleRsvpSubmit = async () => {
    if (!rsvpData?.token || rsvpAttending === null) return;
    setRsvpLoading(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: rsvpData.token,
          attending: rsvpAttending,
          numberAttending: rsvpAttending ? numAttending : 0,
          guestNames: rsvpAttending ? guestNames.slice(0, numAttending) : [],
          language: locale,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRsvpSubmitted(true);
        setRsvpMessage(data.updated ? t(locale, 'rsvpUpdated') : t(locale, 'rsvpSuccess'));
      } else {
        setRsvpMessage(t(locale, 'rsvpError'));
      }
    } catch {
      setRsvpMessage(t(locale, 'rsvpError'));
    } finally {
      setRsvpLoading(false);
    }
  };

  const sectionVisible = (idx: number) => visibleSections.has(idx);

  // ═══════════════════════════════════════════════════
  // SECTION 1 — DIGITAL ENVELOPE (Entry Gate)
  // ═══════════════════════════════════════════════════
  if (!showContent) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'}>
        {/* Audio element */}
        {currentMusicSrc && (
          <audio ref={audioRef} src={currentMusicSrc} loop preload="auto" />
        )}

        {/* Language toggle */}
        <button onClick={toggleLocale} className="lang-toggle" style={{ zIndex: 60 }}>
          {t(locale, 'switchLang')}
        </button>

        {/* Full-viewport envelope */}
        <div className="envelope-viewport">
          {/* Four flaps */}
          <div className={`envelope-flap-base envelope-flap-left ${flapsOpening ? 'flap-opening' : ''}`} />
          <div className={`envelope-flap-base envelope-flap-right ${flapsOpening ? 'flap-opening' : ''}`} />
          <div className={`envelope-flap-base envelope-flap-top ${flapsOpening ? 'flap-opening' : ''}`} />
          <div className={`envelope-flap-base envelope-flap-bottom ${flapsOpening ? 'flap-opening' : ''}`} />

          {/* Gold wax seal — centered */}
          <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
            {!sealBreaking ? (
              <button
                onClick={handleOpenEnvelope}
                className="gold-seal"
                aria-label="Open invitation"
              >
                {/* Wedding rings + diamond SVG */}
                <svg width="55%" height="55%" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  {/* Left ring */}
                  <circle cx="22" cy="32" r="12" stroke="rgba(255,253,240,0.45)" strokeWidth="2.5" fill="none" />
                  {/* Right ring */}
                  <circle cx="38" cy="32" r="12" stroke="rgba(255,253,240,0.45)" strokeWidth="2.5" fill="none" />
                  {/* Diamond */}
                  <polygon points="30,8 34,16 30,20 26,16" fill="rgba(255,253,240,0.35)" stroke="rgba(255,253,240,0.45)" strokeWidth="1.5" />
                </svg>
              </button>
            ) : (
              <div className="gold-seal seal-breaking-gold">
                <svg width="55%" height="55%" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="22" cy="32" r="12" stroke="rgba(255,253,240,0.45)" strokeWidth="2.5" fill="none" />
                  <circle cx="38" cy="32" r="12" stroke="rgba(255,253,240,0.45)" strokeWidth="2.5" fill="none" />
                  <polygon points="30,8 34,16 30,20 26,16" fill="rgba(255,253,240,0.35)" stroke="rgba(255,253,240,0.45)" strokeWidth="1.5" />
                </svg>
              </div>
            )}
          </div>

          {/* Tap to open hint */}
          {!sealBreaking && (
            <div className="envelope-hint">
              <p className={`text-sm text-cream-200 animate-pulse-soft ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {t(locale, 'tapToOpen')}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════
  // MAIN WEDDING SECTIONS
  // ═══════════════════════════════════════════════════
  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Audio */}
      {settings.musicFile && (
        <audio ref={audioRef} src={settings.musicFile} loop preload="auto" />
      )}

      {/* Language toggle */}
      <button onClick={toggleLocale} className="lang-toggle">
        {t(locale, 'switchLang')}
      </button>

      {/* Audio toggle */}
      <button onClick={toggleAudio} className="audio-btn" aria-label={isPlaying ? 'Mute' : 'Unmute'}>
        {isPlaying ? (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-sage-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-charcoal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </button>

      {/* Scroll container */}
      <div ref={scrollRef} className="scroll-container">

        {/* ═══ SECTION 2 — HERO ═══ */}
        <section className="scroll-section" data-section="2">
          {settings.heroImage && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.heroImage})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 ${sectionVisible(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className={`text-xs sm:text-sm uppercase tracking-[0.15em] sm:tracking-[0.3em] text-sage-600 mb-4 sm:mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'weddingOf')}
            </p>
            
            <h1 className={`mb-4 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
              <span className="block text-4xl sm:text-5xl md:text-6xl font-light text-charcoal-800 leading-tight">
                {isRtl ? settings.groomNameAr : settings.groomNameEn}
              </span>
              <span className="block text-2xl sm:text-3xl text-sage-500 my-2 font-display">&</span>
              <span className="block text-4xl sm:text-5xl md:text-6xl font-light text-charcoal-800 leading-tight">
                {isRtl ? settings.brideNameAr : settings.brideNameEn}
              </span>
            </h1>

            <div className="divider-gold-wide" />

            <p className={`text-lg text-charcoal-600 ${isRtl ? 'font-arabic' : 'font-body italic'}`}>
              {t(locale, 'areGettingMarried')}
            </p>
            <p className={`text-xl text-charcoal-700 mt-2 font-medium ${isRtl ? 'font-arabic' : 'font-display'}`}>
              {settings.weddingDate}
            </p>

            {/* Scroll indicator */}
            <div className="mt-12 animate-float">
              <p className={`text-xs uppercase tracking-[0.2em] text-charcoal-400 mb-2 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {t(locale, 'scrollDown')}
              </p>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-sage-500">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 3 — COUNTDOWN (Calendar Style) ═══ */}
        <section className="scroll-section" data-section="3">
          {settings.countdownBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.countdownBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Calendar-style date display */}
            {(() => {
              const weddingDate = new Date(settings.countdownDate);
              const dayNum = weddingDate.getDate();
              const year = weddingDate.getFullYear();
              const dayName = weddingDate.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' });
              const monthName = weddingDate.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' });

              // Build calendar grid for the wedding month
              const firstOfMonth = new Date(year, weddingDate.getMonth(), 1);
              const daysInMonth = new Date(year, weddingDate.getMonth() + 1, 0).getDate();
              // getDay() returns 0=Sunday; shift so Monday=0
              const startDay = (firstOfMonth.getDay() + 6) % 7;
              const dayHeaders = locale === 'ar'
                ? ['ن','ث','ر','خ','ج','س','ح']
                : ['Mo','Tu','We','Th','Fr','Sa','Su'];

              return (
                <>
                  <div className="divider-gold-wide" />

                  {/* Day of week */}
                  <p className={`text-xs sm:text-sm uppercase tracking-[0.3em] text-charcoal-400 mb-3 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {dayName}
                  </p>

                  {/* Large date with decorative pipes */}
                  <div className="flex items-center justify-center gap-3 sm:gap-5 mb-3">
                    <span className="text-sage-300 text-3xl sm:text-4xl font-light select-none">|</span>
                    <span className={`text-5xl sm:text-7xl md:text-8xl font-light text-charcoal-800 leading-none ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                      {dayNum}
                    </span>
                    <span className="text-sage-300 text-3xl sm:text-4xl font-light select-none">|</span>
                  </div>

                  {/* Month + Year */}
                  <p className={`text-sm sm:text-base uppercase tracking-[0.2em] text-charcoal-500 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {monthName}
                  </p>
                  <p className={`text-sm tracking-[0.15em] text-charcoal-400 mb-8 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {year}
                  </p>

                  <div className="divider-gold" />

                  {/* Countdown label */}
                  <p className={`text-xs sm:text-sm uppercase tracking-[0.25em] text-sage-600 mt-6 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {t(locale, 'countdownTo')}
                  </p>

                  {/* Countdown timer */}
                  <div className="flex items-center justify-center gap-1 sm:gap-2 mb-2">
                    {[
                      { value: countdown.days, label: t(locale, 'days') },
                      { value: countdown.hours, label: t(locale, 'hours') },
                      { value: countdown.minutes, label: t(locale, 'minutes') },
                      { value: countdown.seconds, label: t(locale, 'seconds') },
                    ].map((unit, i) => (
                      <div key={i} className="flex items-center">
                        <div className="countdown-unit">
                          <div className="countdown-number">{String(unit.value).padStart(2, '0')}</div>
                          <div className={`countdown-label ${isRtl ? 'font-arabic' : ''}`}>{unit.label}</div>
                        </div>
                        {i < 3 && (
                          <span className="text-sage-400 text-xl sm:text-2xl font-light select-none mx-1 sm:mx-2 -mt-4">:</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="divider-gold mt-8 mb-6" />

                  {/* Mini calendar */}
                  <p className={`text-xs uppercase tracking-[0.25em] text-sage-600 mb-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {t(locale, 'theGreatDay')}
                  </p>
                  <p className={`text-xs uppercase tracking-[0.15em] text-charcoal-400 mb-3 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {monthName} {year}
                  </p>
                  <div className="calendar-grid">
                    {dayHeaders.map((d) => (
                      <div key={d} className="cal-header font-body">{d}</div>
                    ))}
                    {Array.from({ length: startDay }).map((_, i) => (
                      <div key={`e${i}`} className="cal-day empty" />
                    ))}
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                      <div key={d} className={`cal-day ${d === dayNum ? 'highlight' : ''}`}>
                        {d}
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </section>

        {/* ═══ SECTION 4 — INVITATION (Islamic) ═══ */}
        <section className="scroll-section" data-section="4">
          {settings.invitationBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.invitationBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content max-w-2xl transition-all duration-1000 delay-200 ${sectionVisible(4) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Bismillah */}
            <p className="font-arabicDisplay text-xl sm:text-2xl md:text-3xl text-sage-700 mb-4 sm:mb-6" dir="rtl">
              {t(locale, 'bismillah')}
            </p>

            <div className="divider-gold" />

            {/* Quran Verse */}
            <div className="my-8 px-4">
              <p className="quran-verse text-charcoal-700" dir="rtl">
                {t(locale, 'quranVerse')}
              </p>
            </div>

            {/* Sadaq Allah */}
            <p className="font-arabicDisplay text-lg text-sage-600 mb-8" dir="rtl">
              {t(locale, 'sadaqAllah')}
            </p>

            <div className="divider-gold" />

            {/* Invitation Text */}
            <div className={`mt-8 space-y-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {(isRtl ? settings.invitationTextAr : settings.invitationTextEn)
                .split('\n')
                .map((line, i) => (
                  <p key={i} className={`text-charcoal-700 ${
                    line.includes('Hussein') || line.includes('حسين')
                      ? `text-xl sm:text-2xl font-semibold text-charcoal-800 my-3 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`
                      : 'text-base sm:text-lg'
                  }`}>
                    {line}
                  </p>
                ))}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 5 — LOCATION ═══ */}
        <section className="scroll-section" data-section="5">
          {settings.locationBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.locationBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(5) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Decorative top */}
            <div className="mb-8">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-sage-500 mb-4">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            <div className="space-y-6">
              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-sage-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'dateLabel')}
                </p>
                <p className={`text-xl font-medium text-charcoal-800 ${isRtl ? 'font-arabic' : 'font-display'}`}>
                  {settings.eventDate}
                </p>
              </div>

              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-sage-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'timeLabel')}
                </p>
                <p className={`text-xl font-medium text-charcoal-800 ${isRtl ? 'font-arabic' : 'font-display'}`}>
                  {settings.eventTime}
                </p>
              </div>

              <div className="divider-gold" />

              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-sage-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'venueLabel')}
                </p>
                <p className={`text-2xl font-semibold text-charcoal-800 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                  {isRtl ? settings.venueNameAr : settings.venueNameEn}
                </p>
              </div>

              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-sage-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'addressLabel')}
                </p>
                <p className={`text-base text-charcoal-600 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {isRtl ? settings.venueAddressAr : settings.venueAddressEn}
                </p>
              </div>

              {settings.googleMapsUrl && (
                <a
                  href={settings.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-gold inline-flex items-center justify-center gap-2 mt-4 w-full sm:w-auto"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {t(locale, 'viewMap')}
                </a>
              )}
            </div>
          </div>
        </section>

        {/* ═══ SECTION 6 — PROGRAM TIMELINE ═══ */}
        {timelineItems.length > 0 && (
          <section className="scroll-section" data-section="6">
            {settings.timelineBg && (
              <>
                <div className="section-bg" style={{ backgroundImage: `url(${settings.timelineBg})` }} />
                <div className="section-overlay" />
              </>
            )}
            <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(6) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <p className={`text-sm uppercase tracking-[0.3em] text-sage-600 mb-10 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {t(locale, 'programTitle')}
              </p>

              <div className="relative max-w-md mx-auto">
                {/* Vertical line */}
                <div className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-0 bottom-0 timeline-line`} />

                <div className="space-y-5 sm:space-y-8">
                  {timelineItems.map((item, i) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 sm:gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}
                      style={{
                        opacity: sectionVisible(6) ? 1 : 0,
                        transform: sectionVisible(6) ? 'translateY(0)' : 'translateY(20px)',
                        transition: `all 0.6s ease ${i * 150}ms`,
                      }}
                    >
                      <div className="flex-shrink-0 relative z-10 mt-1">
                        <div className="timeline-dot" />
                      </div>
                      <div className={`${isRtl ? 'text-right' : 'text-left'}`}>
                        <p className={`text-sage-700 font-semibold text-lg ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                          {item.time}
                        </p>
                        <p className={`text-charcoal-600 text-base mt-0.5 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                          {isRtl ? item.labelAr : item.labelEn}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ═══ SECTION 7 — GIFT REGISTRY ═══ */}
        <section className="scroll-section" data-section="7">
          {settings.giftBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.giftBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(7) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Gift icon */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto text-sage-500 mb-6">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>

            <h2 className={`text-sm uppercase tracking-[0.3em] text-sage-600 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'giftTitle')}
            </h2>

            <div className={`text-base text-charcoal-600 mb-8 leading-relaxed ${isRtl ? 'font-arabic' : 'font-body italic'}`}>
              {(isRtl ? settings.giftTextAr : settings.giftTextEn).split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
            </div>

            <div className="divider-gold mb-8" />

            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 sm:p-6 max-w-sm mx-auto border border-sage-300/30">
              <p className={`text-lg font-semibold text-charcoal-800 mb-4 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                {settings.giftProviderName}
              </p>
              <div className={`space-y-3 text-sm ${isRtl ? 'text-right font-arabic' : 'text-left font-body'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal-500">Account ID</span>
                  <span className="text-charcoal-800 font-mono text-base">{settings.giftAccountId}</span>
                </div>
                <div className="border-t border-sage-300/30" />
                <div className="flex justify-between items-center">
                  <span className="text-charcoal-500">Phone</span>
                  <span className="text-charcoal-800 font-mono text-base">{settings.giftPhone}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 8 — RSVP ═══ */}
        <section className="scroll-section" data-section="8" style={{ minHeight: 'max(100dvh, 700px)', height: 'auto' }}>
          {settings.rsvpBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.rsvpBg})`, position: 'fixed' }} />
              <div className="section-overlay" style={{ position: 'fixed' }} />
            </>
          )}
          <div className={`section-content py-12 transition-all duration-1000 delay-200 ${sectionVisible(8) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className={`text-sm uppercase tracking-[0.3em] text-sage-600 mb-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'rsvpTitle')}
            </h2>

            {/* Deadline */}
            <p className={`text-base text-charcoal-600 mb-8 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'confirmBy')}: <span className="font-semibold text-charcoal-800">
                {isRtl ? settings.rsvpDeadlineAr : settings.rsvpDeadlineEn}
              </span>
            </p>

            {!rsvpData?.token ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-8 border border-sage-300/30">
                <p className={`text-charcoal-500 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {locale === 'en'
                    ? 'Please use your personal invitation link to RSVP.'
                    : 'يرجى استخدام رابط الدعوة الشخصي للتأكيد.'}
                </p>
              </div>
            ) : rsvpSubmitted ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-8 border border-sage-300/30">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-green-500 mb-4">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className={`text-lg text-charcoal-700 ${isRtl ? 'font-arabic' : 'font-body'}`}>{rsvpMessage}</p>
              </div>
            ) : (
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-sage-300/30 max-w-lg mx-auto">
                {/* Attendance toggle */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
                  <button
                    onClick={() => { setRsvpAttending(true); if (numAttending === 0) setNumAttending(1); }}
                    className={`rsvp-btn rsvp-btn-attending ${rsvpAttending === true ? 'active' : ''}`}
                  >
                    {t(locale, 'attending')}
                  </button>
                  <button
                    onClick={() => { setRsvpAttending(false); setNumAttending(0); }}
                    className={`rsvp-btn rsvp-btn-not-attending ${rsvpAttending === false ? 'active' : ''}`}
                  >
                    {t(locale, 'notAttending')}
                  </button>
                </div>

                {/* Guest count */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 text-sm ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  <div>
                    <label className="block text-charcoal-500 mb-1">{t(locale, 'maxGuests')}</label>
                    <div className="bg-charcoal-50 rounded px-3 py-2 text-charcoal-700 font-semibold">
                      {rsvpData.maxGuests}
                    </div>
                  </div>
                  <div>
                    <label className="block text-charcoal-500 mb-1">{t(locale, 'numberAttending')}</label>
                    <select
                      value={numAttending}
                      onChange={(e) => setNumAttending(parseInt(e.target.value))}
                      disabled={rsvpAttending !== true}
                      className="w-full bg-white border border-charcoal-200 rounded px-3 py-2 text-charcoal-700 disabled:opacity-50 disabled:bg-charcoal-50"
                    >
                      {Array.from({ length: rsvpData.maxGuests }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Guest name inputs */}
                <div className="space-y-3 mb-6">
                  {Array.from({ length: rsvpData.maxGuests }).map((_, i) => (
                    <div key={i}>
                      <label className={`block text-xs text-charcoal-400 mb-1 ${isRtl ? 'font-arabic text-right' : 'font-body text-left'}`}>
                        {t(locale, 'guest')} {i + 1}
                      </label>
                      <input
                        type="text"
                        value={guestNames[i] || ''}
                        onChange={(e) => {
                          const updated = [...guestNames];
                          updated[i] = e.target.value;
                          setGuestNames(updated);
                        }}
                        disabled={rsvpAttending !== true || i >= numAttending}
                        placeholder={`${t(locale, 'guestName')} ${i + 1}`}
                        className={`w-full border rounded px-3 py-2.5 text-sm transition-all
                          ${i < numAttending && rsvpAttending
                            ? 'border-sage-300 bg-white text-charcoal-800 focus:border-sage-500 focus:ring-1 focus:ring-sage-300'
                            : 'border-charcoal-100 bg-charcoal-50 text-charcoal-300 cursor-not-allowed'
                          }
                          ${isRtl ? 'font-arabic text-right' : 'font-body'}
                        `}
                      />
                    </div>
                  ))}
                </div>

                {/* Confirm */}
                <button
                  onClick={handleRsvpSubmit}
                  disabled={rsvpAttending === null || rsvpLoading}
                  className="btn-gold w-full disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {rsvpLoading ? (
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    t(locale, 'confirm')
                  )}
                </button>

                {rsvpMessage && !rsvpSubmitted && (
                  <p className="mt-3 text-sm text-red-500">{rsvpMessage}</p>
                )}
              </div>
            )}

            {/* WhatsApp */}
            {settings.whatsappUrl && (
              <a
                href={settings.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-8 text-charcoal-500 hover:text-green-600 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-green-500">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <span className={`text-sm ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'whatsappRsvp')}
                </span>
              </a>
            )}

            {/* Footer */}
            <div className="mt-8">
              <div className="divider-gold" />
              <p className={`text-xs text-charcoal-400 mt-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {isRtl ? `${settings.groomNameAr} & ${settings.brideNameAr}` : `${settings.groomNameEn} & ${settings.brideNameEn}`} — {settings.weddingDate}
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
