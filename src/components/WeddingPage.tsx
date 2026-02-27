'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SiteContent } from '@/lib/settings';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface GuestAttendance {
  name: string;
  attending: boolean;
}

interface RsvpData {
  groupCode: string;
  maxGuests: number;
  side: string;
  guests: any[];
  rsvp: { attending: boolean; numberAttending: number; guestNames: any } | null;
}

interface Props {
  settings: SiteContent;
  rsvpData: RsvpData | null;
}

function ScrollArrow() {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 animate-float">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-black/30">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    </div>
  );
}

export default function WeddingPage({ settings, rsvpData }: Props) {
  const [locale, setLocale] = useState<Locale>('en');
  const [envelopeOpened, setEnvelopeOpened] = useState(false);
  const [sealBreaking, setSealBreaking] = useState(false);
  const [flapsOpening, setFlapsOpening] = useState(false);
  const [showRings, setShowRings] = useState(false);
  const [ringsPhase, setRingsPhase] = useState<'falling' | 'paired' | 'fading' | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // RSVP State — per-guest attendance toggles
  const initAttendance = (): GuestAttendance[] => {
    const dbGuests = rsvpData?.guests || [];
    const existingRsvp = rsvpData?.rsvp?.guestNames;

    // Build map from existing RSVP data (new format: objects, old format: strings)
    const rsvpMap = new Map<string, boolean>();
    if (Array.isArray(existingRsvp)) {
      existingRsvp.forEach((entry: any) => {
        if (typeof entry === 'object' && entry !== null && 'name' in entry) {
          rsvpMap.set(entry.name.toLowerCase(), entry.attending);
        } else if (typeof entry === 'string' && entry) {
          rsvpMap.set(entry.toLowerCase(), true);
        }
      });
    }

    if (dbGuests.length === 0) return [];

    return dbGuests.map((g: any) => {
      const fullName = g.name;
      const key = fullName.toLowerCase();
      // Match by full name, or first name for legacy data
      const matchFull = rsvpMap.get(key);
      const matchFirst = rsvpMap.get(fullName.split(' ')[0]?.toLowerCase());
      const attending = matchFull !== undefined ? matchFull : (matchFirst !== undefined ? matchFirst : true);
      return { name: fullName, attending };
    });
  };

  const [guestAttendance, setGuestAttendance] = useState<GuestAttendance[]>(initAttendance);
  const [rsvpSubmitted, setRsvpSubmitted] = useState(!!rsvpData?.rsvp);
  const [isEditing, setIsEditing] = useState(!rsvpData?.rsvp);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState('');

  // Copy to clipboard state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }).catch(() => {});
  };

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

  // Intersection observer for section animations — hide/show on scroll
  useEffect(() => {
    if (!showContent) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const idx = parseInt(entry.target.getAttribute('data-section') || '0');
          setVisibleSections((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) {
              next.add(idx);
            } else {
              next.delete(idx);
            }
            return next;
          });
        });
      },
      { threshold: 0.1 }
    );

    document.querySelectorAll('[data-section]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [showContent]);

  const handleOpenEnvelope = useCallback(() => {
    setSealBreaking(true);
    // Start music immediately on interaction
    if (currentMusicSrc && audioRef.current) {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }

    // t=500ms: Seal press done → light burst + seal departure + bg transition
    setTimeout(() => {
      setFlapsOpening(true);
    }, 500);

    // t=1800ms: Seal gone → show Quran page + start ring animation on top
    setTimeout(() => {
      setEnvelopeOpened(true);
      setShowContent(true);
      setShowRings(true);
      setRingsPhase('falling');
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }, 1800);

    // t=4000ms: Rings have met → move to divider
    setTimeout(() => {
      setRingsPhase('paired');
      setShowRings(false);
    }, 4000);
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

  const toggleGuestAttendance = (index: number) => {
    setGuestAttendance((prev) =>
      prev.map((g, i) => (i === index ? { ...g, attending: !g.attending } : g))
    );
  };

  const attendingCount = guestAttendance.filter((g) => g.attending).length;

  const handleRsvpSubmit = async () => {
    if (!rsvpData?.groupCode || guestAttendance.length === 0) return;
    setRsvpLoading(true);
    try {
      const res = await fetch('/api/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupCode: rsvpData.groupCode,
          guestAttendance,
          language: locale,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setRsvpSubmitted(true);
        setIsEditing(false);
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
  // RENDER — Envelope overlay + content card behind it
  // ═══════════════════════════════════════════════════
  return (
    <div dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Audio */}
      {currentMusicSrc && (
        <audio ref={audioRef} src={currentMusicSrc} loop preload="metadata" />
      )}

      {/* Language toggle */}
      <button onClick={toggleLocale} className="lang-toggle" style={{ zIndex: 60 }}>
        {t(locale, 'switchLang')}
      </button>

      {/* Audio toggle — only after envelope opened */}
      {showContent && (
        <button onClick={toggleAudio} className="audio-btn" aria-label={isPlaying ? 'Mute' : 'Unmute'}>
          {isPlaying ? (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-black/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          ) : (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-black/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          )}
        </button>
      )}

      {/* Main content — always present, envelope overlay sits on top */}
      <div ref={scrollRef} className={`scroll-container${!showContent ? ' no-scroll' : ''}`}>

        {/* ═══ SECTION 2 — QURAN AYA ═══ */}
        <section className="scroll-section" data-section="2">
          {settings.quranBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.quranBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content max-w-2xl transition-all duration-1000 ${sectionVisible(2) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Bismillah */}
            <p className="font-arabicDisplay text-2xl sm:text-3xl md:text-4xl text-black/70 mb-4 sm:mb-6" dir="rtl">
              {t(locale, 'bismillah')}
            </p>

            {/* Rings rest on the divider after animation */}
            <div className="rings-divider-wrapper">
              {ringsPhase === 'paired' && (
                <div className="rings-on-divider">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/ring1.png" alt="" className="ring-on-line ring-on-line-left" draggable={false} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/images/ring1.png" alt="" className="ring-on-line ring-on-line-right" draggable={false} />
                </div>
              )}
              <div className="divider-gold" />
            </div>

            {/* Quran Verse — Ar-Rum 30:21 */}
            <div className="my-6 sm:my-8 px-4">
              <p className="quran-verse font-arabicDisplay text-black/70 leading-relaxed" style={{ fontSize: '110%' }} dir="rtl">
                {t(locale, 'quranVerse')}
              </p>
            </div>

            {/* Sadaqa Allah Al-Azeem */}
            <p className="font-arabicDisplay text-2xl sm:text-3xl md:text-4xl text-black/70 mb-4" dir="rtl">
              صدق الله العظيم
            </p>

            {/* English translation */}
            <p className={`text-base sm:text-lg text-black/60 leading-relaxed mb-4 px-4 ${isRtl ? 'font-arabic' : 'font-body italic'}`}>
              {t(locale, 'quranVerseTranslation')}
            </p>

            {/* Verse reference */}
            <p className={`text-sm uppercase tracking-[0.2em] text-black/40 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'quranVerseRef')}
            </p>

            <div className="divider-gold-wide" />

            {/* "وخلقناكم أزواجا" — large calligraphy */}
            <p className="font-arabicDisplay text-3xl sm:text-4xl md:text-5xl text-[#546A50] mt-6 mb-4" dir="rtl">
              {t(locale, 'quranPairsVerse')}
            </p>

            {/* English translation of pairs verse */}
            <p className={`text-sm sm:text-base uppercase tracking-[0.2em] text-black/50 mb-3 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'quranPairsTranslation')}
            </p>

            {/* Pairs verse reference */}
            <p className={`text-xs sm:text-sm uppercase tracking-[0.15em] text-black/35 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'quranPairsRef')}
            </p>

          </div>
          <ScrollArrow />
        </section>

        {/* ═══ SECTION 3 — HERO (skipped entirely when toggle is off) ═══ */}
        {settings.showHeroNames !== false && (
          <section className="scroll-section section-olive" data-section="3">
            {settings.heroImage && (
              <>
                <div className="section-bg" style={{ backgroundImage: `url(${settings.heroImage})` }} />
                <div className="section-overlay" />
              </>
            )}
            <div className={`section-content transition-all duration-1000 ${sectionVisible(3) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <p className={`text-sm sm:text-base uppercase tracking-[0.15em] sm:tracking-[0.3em] text-black/50 mb-4 sm:mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {t(locale, 'weddingOf')}
              </p>

              <h1 className={`mb-4 ${isRtl ? 'font-arabicDisplay' : 'font-script'}`}>
                <span className={`block font-light text-black leading-tight ${isRtl ? 'text-5xl sm:text-6xl md:text-7xl' : 'text-6xl sm:text-7xl md:text-8xl'}`}>
                  {isRtl ? settings.groomNameAr : settings.groomNameEn}
                </span>
                <span className="block text-3xl sm:text-4xl text-[#546A50]/80 my-2 font-display">&</span>
                <span className={`block font-light text-black leading-tight ${isRtl ? 'text-5xl sm:text-6xl md:text-7xl' : 'text-6xl sm:text-7xl md:text-8xl'}`}>
                  {isRtl ? settings.brideNameAr : settings.brideNameEn}
                </span>
              </h1>

              <div className="divider-gold-wide" />

              <p className={`text-2xl sm:text-3xl text-black/80 mt-2 font-medium ${isRtl ? 'font-arabic' : 'font-display'}`}>
                {settings.weddingDate}
              </p>

            </div>
            <ScrollArrow />
          </section>
        )}

        {/* ═══ SECTION 4 — FORMAL INVITATION ═══ */}
        <section className="scroll-section section-olive" data-section="4">
          {settings.invitationBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.invitationBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content max-w-2xl transition-all duration-1000 delay-200 ${sectionVisible(4) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Top ornamental gold crown */}
            <svg className="w-56 sm:w-72 h-10 mx-auto mb-6" viewBox="0 0 280 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Left extending line with taper */}
              <line x1="0" y1="22" x2="90" y2="22" stroke="#546A50" strokeWidth="0.4" opacity="0.6" />
              <line x1="60" y1="22" x2="95" y2="22" stroke="#546A50" strokeWidth="0.7" />
              {/* Right extending line with taper */}
              <line x1="190" y1="22" x2="280" y2="22" stroke="#546A50" strokeWidth="0.4" opacity="0.6" />
              <line x1="185" y1="22" x2="220" y2="22" stroke="#546A50" strokeWidth="0.7" />
              {/* Left scroll — outer curl */}
              <path d="M95 22 C90 22 86 18 88 14 C90 10 96 10 98 14 C99 16 97 18 95 17" stroke="#546A50" strokeWidth="0.7" fill="none" />
              {/* Left scroll — inner spiral */}
              <path d="M95 17 C93 16 93 14 95 13 C97 12 98 14 97 15" stroke="#546A50" strokeWidth="0.5" fill="none" />
              {/* Right scroll — outer curl (mirrored) */}
              <path d="M185 22 C190 22 194 18 192 14 C190 10 184 10 182 14 C181 16 183 18 185 17" stroke="#546A50" strokeWidth="0.7" fill="none" />
              {/* Right scroll — inner spiral */}
              <path d="M185 17 C187 16 187 14 185 13 C183 12 182 14 183 15" stroke="#546A50" strokeWidth="0.5" fill="none" />
              {/* Center fleur — left petal */}
              <path d="M130 22 C128 18 125 14 128 10 C130 7 134 6 136 9 C138 12 136 16 140 14" stroke="#546A50" strokeWidth="0.7" fill="none" />
              {/* Center fleur — right petal (mirrored) */}
              <path d="M150 22 C152 18 155 14 152 10 C150 7 146 6 144 9 C142 12 144 16 140 14" stroke="#546A50" strokeWidth="0.7" fill="none" />
              {/* Center spike */}
              <path d="M140 14 L140 5" stroke="#546A50" strokeWidth="0.6" />
              <circle cx="140" cy="4" r="1.2" fill="#546A50" />
              {/* Small leaf flourishes from center */}
              <path d="M137 10 C135 8 133 9 134 11" stroke="#546A50" strokeWidth="0.4" fill="none" />
              <path d="M143 10 C145 8 147 9 146 11" stroke="#546A50" strokeWidth="0.4" fill="none" />
              {/* Connecting arcs from scrolls to center */}
              <path d="M98 20 C110 16 125 20 130 22" stroke="#546A50" strokeWidth="0.5" fill="none" />
              <path d="M182 20 C170 16 155 20 150 22" stroke="#546A50" strokeWidth="0.5" fill="none" />
              {/* Tiny dots accent */}
              <circle cx="108" cy="19" r="0.6" fill="#546A50" opacity="0.5" />
              <circle cx="172" cy="19" r="0.6" fill="#546A50" opacity="0.5" />
            </svg>

            {/* Invitation — structured fields */}
            {(() => {
              const nameFont = isRtl ? 'font-arabicDisplay' : 'font-script';
              const prefix1 = isRtl ? settings.invPrefix1Ar : settings.invPrefix1En;
              const father1 = isRtl ? settings.invFather1Ar : settings.invFather1En;
              const conn1 = isRtl ? settings.invConnector1Ar : settings.invConnector1En;
              const mother1 = isRtl ? settings.invMother1Ar : settings.invMother1En;
              const prefix2 = isRtl ? settings.invPrefix2Ar : settings.invPrefix2En;
              const father2 = isRtl ? settings.invFather2Ar : settings.invFather2En;
              const conn2 = isRtl ? settings.invConnector2Ar : settings.invConnector2En;
              const mother2 = isRtl ? settings.invMother2Ar : settings.invMother2En;
              const body = isRtl ? settings.invBodyAr : settings.invBodyEn;
              const couple = isRtl ? settings.invCoupleAr : settings.invCoupleEn;
              const date = isRtl ? settings.invDateAr : settings.invDateEn;

              return (
                <div className={`${isRtl ? 'font-arabic' : 'font-body'} space-y-4`} dir={isRtl ? 'rtl' : 'ltr'}>
                  {/* Row 1: Prefixes — smallest text */}
                  {(prefix1 || prefix2) && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-8">
                      <p className={`text-center font-bold text-[#546A50] ${isRtl ? 'text-lg sm:text-xl font-arabic' : 'font-trajan text-[clamp(0.8rem,3.5vw,1.4rem)]'}`}>{prefix1}</p>
                      <p className={`text-center font-bold text-[#546A50] ${isRtl ? 'text-lg sm:text-xl font-arabic' : 'font-trajan text-[clamp(0.8rem,3.5vw,1.4rem)]'}`}>{prefix2}</p>
                    </div>
                  )}

                  {/* Row 2: Father names — largest, Trajan/Cinzel */}
                  <div className="grid grid-cols-2 gap-2 sm:gap-8 -mt-2">
                    <p className={`text-center font-bold text-black whitespace-nowrap ${isRtl ? 'font-arabicDisplay text-2xl sm:text-4xl' : 'font-trajan text-[clamp(0.8rem,3.5vw,1.4rem)]'}`}>{father1}</p>
                    <p className={`text-center font-bold text-black whitespace-nowrap ${isRtl ? 'font-arabicDisplay text-2xl sm:text-4xl' : 'font-trajan text-[clamp(0.8rem,3.5vw,1.4rem)]'}`}>{father2}</p>
                  </div>

                  {/* Row 3: Connectors */}
                  {(conn1 || conn2) && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-8 -mt-2">
                      <p className={`text-center text-black/50 ${isRtl ? 'text-base sm:text-lg font-arabic' : 'text-xs sm:text-sm font-body'}`}>{conn1}</p>
                      <p className={`text-center text-black/50 ${isRtl ? 'text-base sm:text-lg font-arabic' : 'text-xs sm:text-sm font-body'}`}>{conn2}</p>
                    </div>
                  )}

                  {/* Row 4: Mother names — slightly smaller than father */}
                  {(mother1 || mother2) && (
                    <div className="grid grid-cols-2 gap-2 sm:gap-8 -mt-2">
                      <p className={`text-center font-bold text-black whitespace-nowrap ${isRtl ? 'font-arabicDisplay text-xl sm:text-3xl' : 'font-trajan text-[clamp(0.75rem,3.2vw,1.25rem)]'}`}>{mother1}</p>
                      <p className={`text-center font-bold text-black whitespace-nowrap ${isRtl ? 'font-arabicDisplay text-xl sm:text-3xl' : 'font-trajan text-[clamp(0.75rem,3.2vw,1.25rem)]'}`}>{mother2}</p>
                    </div>
                  )}

                  {/* Middle ornamental gold divider — simpler flourish */}
                  <svg className="w-40 sm:w-56 h-6 mx-auto my-2" viewBox="0 0 220 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="0" y1="12" x2="80" y2="12" stroke="#546A50" strokeWidth="0.4" opacity="0.6" />
                    <line x1="140" y1="12" x2="220" y2="12" stroke="#546A50" strokeWidth="0.4" opacity="0.6" />
                    <path d="M80 12 C85 12 90 8 95 8 C100 8 105 12 110 12 C115 12 120 8 125 8 C130 8 135 12 140 12" stroke="#546A50" strokeWidth="0.7" fill="none" />
                    <circle cx="110" cy="8" r="1" fill="#546A50" />
                  </svg>

                  {/* Body text */}
                  {body && body.split('\n').map((line, i) => (
                    <p key={i} className={`text-black/80 ${isRtl ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}>{line}</p>
                  ))}

                  {/* Couple names — large bold calligraphy in gold */}
                  {couple && (
                    <p className={`font-bold text-[#546A50] ${nameFont} ${isRtl ? 'text-4xl sm:text-5xl' : 'text-4xl sm:text-5xl'}`}>{couple}</p>
                  )}

                  {/* Date */}
                  {date && (
                    <p className={`text-black/80 ${isRtl ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}>{date}</p>
                  )}
                </div>
              );
            })()}

            {/* Bottom ornamental gold crown (flipped) */}
            <svg className="w-56 sm:w-72 h-10 mx-auto mt-6 rotate-180" viewBox="0 0 280 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <line x1="0" y1="22" x2="90" y2="22" stroke="#546A50" strokeWidth="0.4" opacity="0.6" />
              <line x1="60" y1="22" x2="95" y2="22" stroke="#546A50" strokeWidth="0.7" />
              <line x1="190" y1="22" x2="280" y2="22" stroke="#546A50" strokeWidth="0.4" opacity="0.6" />
              <line x1="185" y1="22" x2="220" y2="22" stroke="#546A50" strokeWidth="0.7" />
              <path d="M95 22 C90 22 86 18 88 14 C90 10 96 10 98 14 C99 16 97 18 95 17" stroke="#546A50" strokeWidth="0.7" fill="none" />
              <path d="M95 17 C93 16 93 14 95 13 C97 12 98 14 97 15" stroke="#546A50" strokeWidth="0.5" fill="none" />
              <path d="M185 22 C190 22 194 18 192 14 C190 10 184 10 182 14 C181 16 183 18 185 17" stroke="#546A50" strokeWidth="0.7" fill="none" />
              <path d="M185 17 C187 16 187 14 185 13 C183 12 182 14 183 15" stroke="#546A50" strokeWidth="0.5" fill="none" />
              <path d="M130 22 C128 18 125 14 128 10 C130 7 134 6 136 9 C138 12 136 16 140 14" stroke="#546A50" strokeWidth="0.7" fill="none" />
              <path d="M150 22 C152 18 155 14 152 10 C150 7 146 6 144 9 C142 12 144 16 140 14" stroke="#546A50" strokeWidth="0.7" fill="none" />
              <path d="M140 14 L140 5" stroke="#546A50" strokeWidth="0.6" />
              <circle cx="140" cy="4" r="1.2" fill="#546A50" />
              <path d="M137 10 C135 8 133 9 134 11" stroke="#546A50" strokeWidth="0.4" fill="none" />
              <path d="M143 10 C145 8 147 9 146 11" stroke="#546A50" strokeWidth="0.4" fill="none" />
              <path d="M98 20 C110 16 125 20 130 22" stroke="#546A50" strokeWidth="0.5" fill="none" />
              <path d="M182 20 C170 16 155 20 150 22" stroke="#546A50" strokeWidth="0.5" fill="none" />
              <circle cx="108" cy="19" r="0.6" fill="#546A50" opacity="0.5" />
              <circle cx="172" cy="19" r="0.6" fill="#546A50" opacity="0.5" />
            </svg>
          </div>
          <ScrollArrow />
        </section>

        {/* ═══ SECTION 5 — COUNTDOWN (Calendar Style) ═══ */}
        <section className="scroll-section" data-section="5">
          {settings.countdownBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.countdownBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(5) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {(() => {
              const weddingDate = new Date(settings.countdownDate);
              const dayNum = weddingDate.getDate();
              const year = weddingDate.getFullYear();
              const dayName = weddingDate.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long' });
              const monthName = weddingDate.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', { month: 'long' });

              const firstOfMonth = new Date(year, weddingDate.getMonth(), 1);
              const daysInMonth = new Date(year, weddingDate.getMonth() + 1, 0).getDate();
              const startDay = (firstOfMonth.getDay() + 6) % 7;
              const dayHeaders = locale === 'ar'
                ? ['ن','ث','ر','خ','ج','س','ح']
                : ['Mo','Tu','We','Th','Fr','Sa','Su'];

              return (
                <>
                  <div className="divider-gold-wide" />

                  <p className={`text-sm sm:text-base uppercase tracking-[0.3em] text-black/40 mb-3 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {dayName}
                  </p>

                  <div className="flex items-center justify-center gap-3 sm:gap-5 mb-3">
                    <span className="text-[#546A50] text-4xl sm:text-5xl font-light select-none">|</span>
                    <span className={`text-6xl sm:text-8xl md:text-9xl font-light text-black leading-none ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                      {dayNum}
                    </span>
                    <span className="text-[#546A50] text-4xl sm:text-5xl font-light select-none">|</span>
                  </div>

                  <p className={`text-base sm:text-lg uppercase tracking-[0.2em] text-black/60 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {monthName}
                  </p>
                  <p className={`text-base tracking-[0.15em] text-black/40 mb-8 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {year}
                  </p>

                  <div className="divider-gold" />

                  <p className={`text-sm sm:text-base uppercase tracking-[0.25em] text-olive-400 mt-6 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {t(locale, 'countdownTo')}
                  </p>

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
                          <span className="text-[#546A50]/50 text-xl sm:text-2xl font-light select-none mx-1 sm:mx-2 -mt-4">:</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="divider-gold mt-8 mb-6" />

                  <p className={`text-sm uppercase tracking-[0.25em] text-olive-400 mb-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                    {t(locale, 'theGreatDay')}
                  </p>
                  <p className={`text-sm uppercase tracking-[0.15em] text-black/40 mb-3 ${isRtl ? 'font-arabic' : 'font-body'}`}>
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
          <ScrollArrow />
        </section>

        {/* ═══ SECTION 6 — LOCATION ═══ */}
        <section className="scroll-section section-olive" data-section="6">
          {settings.locationBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.locationBg})` }} />
              <div className="section-overlay" />
            </>
          )}
          <div className={`section-content transition-all duration-1000 delay-200 ${sectionVisible(6) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {/* Decorative top */}
            <div className="mb-8">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mx-auto text-olive-400 mb-4">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>

            <div className="space-y-6">
              <div>
                <p className={`text-sm sm:text-base uppercase tracking-[0.25em] text-olive-400 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'dateLabel')}
                </p>
                <p className={`text-2xl sm:text-3xl font-medium text-black ${isRtl ? 'font-arabic' : 'font-display'}`}>
                  {settings.eventDate}
                </p>
              </div>

              <div>
                <p className={`text-sm sm:text-base uppercase tracking-[0.25em] text-olive-400 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'timeLabel')}
                </p>
                <p className={`text-2xl sm:text-3xl font-medium text-black ${isRtl ? 'font-arabic' : 'font-display'}`}>
                  {settings.eventTime}
                </p>
              </div>

              <div className="divider-gold" />

              <div>
                <p className={`text-sm sm:text-base uppercase tracking-[0.25em] text-olive-400 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'venueLabel')}
                </p>
                <p className={`text-3xl sm:text-4xl font-semibold text-black ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                  {isRtl ? settings.venueNameAr : settings.venueNameEn}
                </p>
              </div>

              <div>
                <p className={`text-sm sm:text-base uppercase tracking-[0.25em] text-olive-400 mb-1 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'addressLabel')}
                </p>
                <p className={`text-lg sm:text-xl text-black/60 ${isRtl ? 'font-arabic' : 'font-body'}`}>
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
          <ScrollArrow />
        </section>

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
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mx-auto text-olive-400 mb-6">
              <polyline points="20 12 20 22 4 22 4 12" />
              <rect x="2" y="7" width="20" height="5" />
              <line x1="12" y1="22" x2="12" y2="7" />
              <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
              <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
            </svg>

            <h2 className={`text-base sm:text-lg uppercase tracking-[0.3em] text-olive-400 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'giftTitle')}
            </h2>

            <div className={`text-lg sm:text-xl text-black/60 mb-8 leading-relaxed ${isRtl ? 'font-arabic' : 'font-body italic'}`}>
              {(isRtl ? settings.giftTextAr : settings.giftTextEn).split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-2' : ''}>{line}</p>
              ))}
            </div>

            <div className="divider-gold mb-8" />

            <div className="bg-black/5 backdrop-blur-sm rounded-lg p-4 sm:p-6 max-w-sm mx-auto border border-black/10">
              <div className="flex items-center justify-center gap-3 mb-4">
                <img src="/images/whish.png" alt="Whish Money" className="h-9 sm:h-10 w-auto object-contain" />
                <p className={`text-xl sm:text-2xl font-semibold text-black ${isRtl ? 'font-arabicDisplay' : 'font-display'}`}>
                  {settings.giftProviderName}
                </p>
              </div>
              <div className={`space-y-3 text-base ${isRtl ? 'text-right font-arabic' : 'text-left font-body'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-black/40">Account ID</span>
                  <div className="flex items-center gap-2">
                    <span className="text-black font-mono text-base">{settings.giftAccountId}</span>
                    <button
                      onClick={() => copyToClipboard(settings.giftAccountId, 'accountId')}
                      className="p-1.5 rounded-md hover:bg-black/10 transition-colors"
                      aria-label={t(locale, 'copyToClipboard')}
                    >
                      {copiedField === 'accountId' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/40">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                <div className="border-t border-black/10" />
                <div className="flex justify-between items-center">
                  <span className="text-black/40">Phone</span>
                  <div className="flex items-center gap-2">
                    <span className="text-black font-mono text-base">{settings.giftPhone}</span>
                    <button
                      onClick={() => copyToClipboard(settings.giftPhone, 'phone')}
                      className="p-1.5 rounded-md hover:bg-black/10 transition-colors"
                      aria-label={t(locale, 'copyToClipboard')}
                    >
                      {copiedField === 'phone' ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-black/40">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ScrollArrow />
        </section>

        {/* ═══ SECTION 8 — RSVP ═══ */}
        <section className="scroll-section section-olive" data-section="8" style={{ minHeight: 'max(100dvh, 700px)', height: 'auto' }}>
          {settings.rsvpBg && (
            <>
              <div className="section-bg" style={{ backgroundImage: `url(${settings.rsvpBg})`, position: 'fixed' }} />
              <div className="section-overlay" style={{ position: 'fixed' }} />
            </>
          )}
          <div className={`section-content py-12 transition-all duration-1000 delay-200 ${sectionVisible(8) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h2 className={`text-base sm:text-lg uppercase tracking-[0.3em] text-black/60 mb-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'rsvpTitle')}
            </h2>

            {/* Deadline */}
            <p className={`text-lg sm:text-xl text-black/70 mb-8 ${isRtl ? 'font-arabic' : 'font-body'}`}>
              {t(locale, 'confirmBy')}: <span className="font-semibold text-black">
                {isRtl ? settings.rsvpDeadlineAr : settings.rsvpDeadlineEn}
              </span>
            </p>

            {!rsvpData?.groupCode ? (
              <div className="bg-black/5 backdrop-blur-sm rounded-lg p-8 border border-black/10">
                <p className={`text-black/60 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {locale === 'en'
                    ? 'Please use your personal invitation link to RSVP.'
                    : 'يرجى استخدام رابط الدعوة الشخصي للتأكيد.'}
                </p>
              </div>
            ) : guestAttendance.length === 0 ? (
              <div className="bg-black/5 backdrop-blur-sm rounded-lg p-8 border border-black/10">
                <p className={`text-black/60 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'noGuestsRegistered')}
                </p>
              </div>
            ) : rsvpSubmitted && !isEditing ? (
              /* ═══ SUBMITTED STATE — show summary ═══ */
              <div className="bg-black/5 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-black/10 max-w-lg mx-auto">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto text-green-400 mb-3">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <p className={`text-xl text-black/80 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {rsvpMessage || t(locale, 'rsvpAlreadySubmitted')}
                </p>

                {/* Per-guest summary */}
                <div className="space-y-3 mb-6">
                  {guestAttendance.map((g, i) => (
                    <div key={i} className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        g.attending ? 'bg-green-500/20' : 'bg-red-500/20'
                      }`}>
                        {g.attending ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-lg text-black/80 ${isRtl ? 'font-arabic' : 'font-body'}`}>{g.name}</span>
                    </div>
                  ))}
                </div>

                <p className={`text-base text-black/50 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {attendingCount} / {guestAttendance.length} {t(locale, 'perGuestAttending').toLowerCase()}
                </p>

                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-gold w-full"
                >
                  {t(locale, 'rsvpUpdatePrompt')}
                </button>
              </div>
            ) : (
              /* ═══ EDITING STATE — per-guest toggle form ═══ */
              <div className="bg-black/5 backdrop-blur-sm rounded-lg p-6 sm:p-8 border border-black/10 max-w-lg mx-auto">
                {/* Per-guest attendance toggles */}
                <div className="space-y-4 mb-6">
                  {guestAttendance.map((g, i) => (
                    <div key={i} className={`flex items-center gap-3 ${isRtl ? 'flex-row-reverse' : ''}`}>
                      {/* Attending toggle */}
                      <button
                        onClick={() => toggleGuestAttendance(i)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          g.attending
                            ? 'bg-green-500 text-white shadow-md shadow-green-500/30'
                            : 'bg-black/5 border-2 border-black/20 text-black/30 hover:border-green-400'
                        }`}
                        aria-label={g.attending ? t(locale, 'perGuestAttending') : t(locale, 'perGuestNotAttending')}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>

                      {/* Guest name */}
                      <span className={`flex-1 text-lg text-black/80 ${isRtl ? 'text-right font-arabic' : 'font-body'}`}>
                        {g.name}
                      </span>

                      {/* Not attending toggle */}
                      <button
                        onClick={() => toggleGuestAttendance(i)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                          !g.attending
                            ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                            : 'bg-black/5 border-2 border-black/20 text-black/30 hover:border-red-400'
                        }`}
                        aria-label={!g.attending ? t(locale, 'perGuestNotAttending') : t(locale, 'perGuestAttending')}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>

                {/* Attendance summary */}
                <p className={`text-base text-black/50 mb-6 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {attendingCount} / {guestAttendance.length} {t(locale, 'perGuestAttending').toLowerCase()}
                </p>

                {/* Confirm button */}
                <button
                  onClick={handleRsvpSubmit}
                  disabled={rsvpLoading}
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
              <div className="mt-8 flex flex-col items-center gap-3">
                <p className={`text-sm text-black/50 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                  {t(locale, 'whatsappRsvp')}
                </p>
                <a
                  href={settings.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white shadow-lg shadow-[#25D366]/30 hover:shadow-[#25D366]/50 transition-all duration-300 hover:scale-110"
                  aria-label="WhatsApp"
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                </a>
              </div>
            )}

            {/* Footer */}
            <div className="mt-8">
              <div className="divider-gold" />
              <p className={`text-xs text-black/40 mt-4 ${isRtl ? 'font-arabic' : 'font-body'}`}>
                {isRtl ? `${settings.groomNameAr} & ${settings.brideNameAr}` : `${settings.groomNameEn} & ${settings.brideNameEn}`} — {settings.weddingDate}
              </p>
            </div>
          </div>
        </section>

      </div> {/* close scroll-container */}

      {/* ═══ RING ANIMATION OVERLAY ═══ */}
      {showRings && (
        <div className="rings-viewport">
          {/* Ring A — falls from top-left */}
          <div className={`ring-single ring-a ${ringsPhase === 'falling' ? 'ring-fall-left' : 'ring-hidden'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ring1.png" alt="" draggable={false} />
          </div>

          {/* Ring B — falls from top-right */}
          <div className={`ring-single ring-b ${ringsPhase === 'falling' ? 'ring-fall-right' : 'ring-hidden'}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/ring1.png" alt="" draggable={false} />
          </div>
        </div>
      )}

      {/* ═══ ENVELOPE SPLASH — full-screen envelope image ═══ */}
      {!envelopeOpened && (
        <div
          className={`seal-viewport ${flapsOpening ? 'seal-transitioning' : ''}`}
          onClick={!sealBreaking ? handleOpenEnvelope : undefined}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') !sealBreaking && handleOpenEnvelope(); }}
          aria-label="Open invitation"
        >
          {/* Full-screen envelope image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/envelope-start.png"
            alt="Wedding envelope"
            className={`envelope-start-img ${flapsOpening ? 'envelope-start-fade' : ''}`}
            draggable={false}
          />

          {/* High-res seal overlay */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/seal.png"
            alt=""
            className={`envelope-seal-overlay ${flapsOpening ? 'envelope-start-fade' : ''}`}
            draggable={false}
          />

          {/* Light burst on break */}
          {flapsOpening && <div className="seal-light-burst" />}

          {/* Shimmer particles */}
          {flapsOpening && (
            <div className="seal-particles">
              {Array.from({ length: 15 }).map((_, i) => (
                <span key={i} className="seal-particle" style={{
                  left: `${10 + Math.random() * 80}%`,
                  animationDelay: `${Math.random() * 0.8}s`,
                  animationDuration: `${1 + Math.random() * 1}s`,
                }} />
              ))}
            </div>
          )}

          {/* Tap hint */}
          {!sealBreaking && (
            <p className={`seal-tap-hint ${isRtl ? 'font-arabic' : ''}`}>
              {isRtl ? 'انقر لفتح الدعوة' : 'Tap to open'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
