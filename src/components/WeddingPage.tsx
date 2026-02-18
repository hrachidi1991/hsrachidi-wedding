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

    setTimeout(() => {
      setEnvelopeOpened(true);
      // Start music
      if (settings.musicFile && audioRef.current) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
      setTimeout(() => {
        setShowContent(true);
        // Scroll to hero section
        setTimeout(() => {
          scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
        }, 100);
      }, 600);
    }, 700);
  }, [settings]);

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
        {settings.musicFile && (
          <audio ref={audioRef} src={settings.musicFile} loop preload="auto" />
        )}
        
        {/* Language toggle */}
        <button onClick={toggleLocale} className="lang-toggle">
          {t(locale, 'switchLang')}
        </button>

        <div className="h-screen w-screen flex flex-col items-center justify-center bg-cream-50 relative overflow-hidden">
          {/* Subtle background pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23C9A96E' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />

          <div className="envelope-wrapper relative z-10">
            <div className="envelope-body">
              {/* Envelope flap */}
              <div className={`envelope-flap ${envelopeOpened ? 'open' : ''}`} />
              
              {/* Inner card peek */}
              <div className="absolute inset-4 top-[35%] bg-white/80 rounded-sm flex items-center justify-center">
                <div className="text-center px-4">
                  <p className={`font-display text-gold-700 text-lg ${isRtl ? 'font-arabicDisplay' : ''}`}>
                    {isRtl ? settings.groomNameAr : settings.groomNameEn}
                    <span className="mx-2 text-gold-500">&</span>
                    {isRtl ? settings.brideNameAr : settings.brideNameEn}
                  </p>
                </div>
              </div>

              {/* Wax seal */}
              {!sealBreaking && (
                <button
                  onClick={handleOpenEnvelope}
                  className="wax-seal"
                  aria-label="Open invitation"
                >
                  <span className="wax-seal-text">H&S</span>
                </button>
              )}

              {sealBreaking && !envelopeOpened && (
                <div className="wax-seal seal-breaking">
                  <span className="wax-seal-text">H&S</span>
                </div>
              )}
            </div>
          </div>

          {/* Tap to open hint */}
          <p className={`mt-8 text-sm text-charcoal-400 animate-pulse-soft ${isRtl ? 'font-arabic' : 'font-body'}`}>
            {t(locale, 'tapToOpen')}
          </p>

          {/* Decorative elements */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <div className="divider-gold" />
          </div>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold-700">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-charcoal-400">
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
            <p className={`text-sm uppercase tracking-[0.3em] text-gold-600 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'weddingOf')}
            </p>
            
            <h1 className={`mb-4 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
              <span className="block text-4xl sm:text-5xl md:text-6xl font-light text-charcoal-800 leading-tight">
                {isRtl ? settings.groomNameAr : settings.groomNameEn}
              </span>
              <span className="block text-2xl sm:text-3xl text-gold-500 my-2 font-display">&</span>
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-gold-500">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 3 — COUNTDOWN ═══ */}
        <section className="scroll-section" data-section="3">
          {settings.countdownBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.countdownBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <p className={`text-sm uppercase tracking-[0.3em] text-gold-600 mb-10 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'countdownTo')}
            </p>

            <div className="flex items-center justify-center gap-4 sm:gap-8">
              {[
                { value: countdown.days, label: t(locale, 'days') },
                { value: countdown.hours, label: t(locale, 'hours') },
                { value: countdown.minutes, label: t(locale, 'minutes') },
                { value: countdown.seconds, label: t(locale, 'seconds') },
              ].map((unit, i) => (
                <div key={i} className="countdown-unit">
                  <div className="countdown-number">{String(unit.value).padStart(2, '0')}</div>
                  <div className={`countdown-label ${isRtl ? 'font-arabic' : ''}`}>{unit.label}</div>
                  {i < 3 && (
                    <span className="hidden sm:block absolute -right-4 top-3 text-gold-400 text-3xl font-light select-none" style={{ position: 'relative', right: 'auto', top: 'auto' }}>:</span>
                  )}
                </div>
              ))}
            </div>

            <div className="divider-gold-wide mt-10" />
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
            <p className="font-arabicDisplay text-2xl sm:text-3xl text-gold-700 mb-6" dir="rtl">
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
            <p className="font-arabicDisplay text-lg text-gold-600 mb-8" dir="rtl">
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
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-gold-500 mb-4">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            <div className="space-y-6">
              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-gold-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'dateLabel')}
                </p>
                <p className={`text-xl font-medium text-charcoal-800 ${isRtl ? 'font-arabic' : 'font-display'}`}>
                  {settings.eventDate}
                </p>
              </div>

              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-gold-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'timeLabel')}
                </p>
                <p className={`text-xl font-medium text-charcoal-800 ${isRtl ? 'font-arabic' : 'font-display'}`}>
                  {settings.eventTime}
                </p>
              </div>

              <div className="divider-gold" />

              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-gold-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'venueLabel')}
                </p>
                <p className={`text-2xl font-semibold text-charcoal-800 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                  {isRtl ? settings.venueNameAr : settings.venueNameEn}
                </p>
              </div>

              <div>
                <p className={`text-xs uppercase tracking-[0.25em] text-gold-600 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
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
                  className="btn-gold inline-flex items-center gap-2 mt-4"
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
              <p className={`text-sm uppercase tracking-[0.3em] text-gold-600 mb-10 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {t(locale, 'programTitle')}
              </p>

              <div className="relative max-w-md mx-auto">
                {/* Vertical line */}
                <div className={`absolute ${isRtl ? 'right-[19px]' : 'left-[19px]'} top-0 bottom-0 timeline-line`} />

                <div className="space-y-8">
                  {timelineItems.map((item, i) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-6 ${isRtl ? 'flex-row-reverse' : ''}`}
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
                        <p className={`text-gold-700 font-semibold text-lg ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
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
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto text-gold-500 mb-6">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>

            <h2 className={`text-sm uppercase tracking-[0.3em] text-gold-600 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'giftTitle')}
            </h2>

            <div className={`text-base text-charcoal-600 mb-8 leading-relaxed ${isRtl ? 'font-arabic' : 'font-body italic'}`}>
              {(isRtl ? settings.giftTextAr : settings.giftTextEn).split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
            </div>

            <div className="divider-gold mb-8" />

            <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 max-w-sm mx-auto border border-gold-200/30">
              <p className={`text-lg font-semibold text-charcoal-800 mb-4 ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                {settings.giftProviderName}
              </p>
              <div className={`space-y-3 text-sm ${isRtl ? 'text-right font-arabic' : 'text-left font-body'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-charcoal-500">Account ID</span>
                  <span className="text-charcoal-800 font-mono text-base">{settings.giftAccountId}</span>
                </div>
                <div className="border-t border-gold-200/30" />
                <div className="flex justify-between items-center">
                  <span className="text-charcoal-500">Phone</span>
                  <span className="text-charcoal-800 font-mono text-base">{settings.giftPhone}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SECTION 8 — RSVP ═══ */}
        <section className="scroll-section" data-section="8" style={{ minHeight: 'max(100vh, 700px)', height: 'auto' }}>
          {settings.rsvpBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.rsvpBg})`, position: 'fixed' }} />
              <div className="section-overlay" style={{ position: 'fixed' }} />
            </>
          )}
          <div className={`section-content py-12 transition-all duration-1000 delay-200 ${sectionVisible(8) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className={`text-sm uppercase tracking-[0.3em] text-gold-600 mb-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'rsvpTitle')}
            </h2>

            {/* Deadline */}
            <p className={`text-base text-charcoal-600 mb-8 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'confirmBy')}: <span className="font-semibold text-charcoal-800">
                {isRtl ? settings.rsvpDeadlineAr : settings.rsvpDeadlineEn}
              </span>
            </p>

            {!rsvpData?.token ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-8 border border-gold-200/30">
                <p className={`text-charcoal-500 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {locale === 'en'
                    ? 'Please use your personal invitation link to RSVP.'
                    : 'يرجى استخدام رابط الدعوة الشخصي للتأكيد.'}
                </p>
              </div>
            ) : rsvpSubmitted ? (
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-8 border border-gold-200/30">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-green-500 mb-4">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className={`text-lg text-charcoal-700 ${isRtl ? 'font-arabic' : 'font-body'}`}>{rsvpMessage}</p>
              </div>
            ) : (
              <div className="bg-white/60 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-gold-200/30 max-w-lg mx-auto">
                {/* Attendance toggle */}
                <div className="flex gap-3 justify-center mb-6">
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
                <div className={`grid grid-cols-2 gap-4 mb-6 text-sm ${isRtl ? 'font-arabic' : 'font-body'}`}>
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
                            ? 'border-gold-300 bg-white text-charcoal-800 focus:border-gold-500 focus:ring-1 focus:ring-gold-300'
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

            {/* Footer */}
            <div className="mt-12">
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
