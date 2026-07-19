'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// True once the §2 Blessing has auto-continued its "writing-on" after the Bismillah.
// First open waits for the Bismillah; later re-inits (locale toggle) snap in quickly.
let blessingIntroPlayed = false;

/* ───────────────────────── Markup helpers ─────────────────────────
   These render plain DOM with marker classes/attrs. All scroll-driven
   animation is applied later by initChapterScroll() via GSAP. */

type Tag = 'div' | 'p' | 'span' | 'h1' | 'h2';

export function Stagger({
  children,
  className,
  as: As = 'div',
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  amount?: number;
  style?: React.CSSProperties;
}) {
  const Comp = As as keyof JSX.IntrinsicElements;
  return (
    <Comp className={className} style={style}>
      {children}
    </Comp>
  );
}

export function Item({
  children,
  className,
  as: As = 'div',
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  style?: React.CSSProperties;
}) {
  const Comp = As as keyof JSX.IntrinsicElements;
  return (
    <Comp className={className} style={style} data-reveal="">
      {children}
    </Comp>
  );
}

export function Reveal({
  children,
  className,
  as: As = 'div',
  style,
}: {
  children: ReactNode;
  className?: string;
  as?: Tag;
  amount?: number;
  style?: React.CSSProperties;
}) {
  const Comp = As as keyof JSX.IntrinsicElements;
  return (
    <Comp className={className} style={style} data-reveal="">
      {children}
    </Comp>
  );
}

/* Word-by-word mask container. Each word sits in an overflow-hidden wrapper so
   GSAP can rise it out of the mask on scroll (and un-build on scroll up). */
const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

export function WordsReveal({
  text,
  className,
}: {
  text: string;
  className?: string;
  amount?: number;
  stagger?: number;
}) {
  const raw = text ?? '';
  const isArabic = ARABIC_RE.test(raw);
  const words = raw.split(/\s+/).filter(Boolean);

  return (
    <span
      className={`gsap-words ${className ?? ''}`}
      style={{ display: 'inline-block' }}
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      {words.flatMap((w, i) => {
        const unit = (
          <span key={`w${i}`} className="gsap-unit">
            {isArabic ? (
              /* Arabic stays JOINED — reveal per word, never per letter */
              <span className="gsap-word-wrap">
                <span className="gsap-word">{w}</span>
              </span>
            ) : (
              /* Latin cascades per CHARACTER */
              [...w].map((ch, j) => (
                <span key={j} className="gsap-char-wrap">
                  <span className="gsap-char">{ch}</span>
                </span>
              ))
            )}
          </span>
        );
        return i < words.length - 1 ? [unit, ' '] : [unit];
      })}
    </span>
  );
}

/* ───────────────────────── Chapter background ─────────────────────────
   Full-bleed video (in-view autoplay) or still (Ken Burns), each with the
   darkening vignette scrim. §4 passes scrub → GSAP drives currentTime.
   Reduced-motion / Save-Data → poster <img>, no video element. */
function usePosterOnly() {
  const [posterOnly, setPosterOnly] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conn = (navigator as any).connection;
    const compute = () => setPosterOnly(mq.matches || !!(conn && conn.saveData));
    compute();
    mq.addEventListener?.('change', compute);
    return () => mq.removeEventListener?.('change', compute);
  }, []);
  return posterOnly;
}

/* A framed grayscale MEDIA CARD sitting on the paper page. Videos autoplay
   directly in the frame (muted/loop/playsInline); lazy-loaded (load+play when
   near). Reduced-motion / Save-Data → static poster still. */
export function MediaCard({
  kind,
  src,
  poster,
  ratio = 'portrait',
  shape = 'rect',
  fit = 'cover',
}: {
  kind: 'video' | 'still';
  src: string;
  poster: string;
  ratio?: 'portrait' | 'landscape';
  shape?: 'rect' | 'arch';
  fit?: 'cover' | 'contain';
}) {
  const posterOnly = usePosterOnly();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  // Lazy-load + autoplay the video when the card is near (fetch as you approach,
  // play as soon as it's shown). Never force-pause — it just loops.
  useEffect(() => {
    if (kind !== 'video' || posterOnly) return;
    const wrap = wrapRef.current;
    const video = videoRef.current;
    if (!wrap || !video) return;
    let started = false;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            if (!started) {
              video.load();
              started = true;
            }
            video.play().catch(() => {});
          }
        });
      },
      { rootMargin: '120% 0px 120% 0px', threshold: 0 }
    );
    io.observe(wrap);
    return () => io.disconnect();
  }, [kind, posterOnly, src]);

  const showVideo = kind === 'video' && !posterOnly;

  return (
    <div
      ref={wrapRef}
      className={`media-card media-${ratio}${shape === 'arch' ? ' media-arch' : ''}${fit === 'contain' ? ' media-contain' : ''}`}
      aria-hidden="true"
    >
      {/* The poster is ALWAYS rendered underneath so the frame is never blank
          (iOS Safari shows a blank box for a not-yet-loaded <video>). The video
          sits on top and fades in only once it can actually play. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="media-el media-poster" src={poster} alt="" draggable={false} />
      {showVideo && (
        <video
          ref={videoRef}
          className={`media-el media-video${videoReady ? ' is-ready' : ''}`}
          src={src}
          muted
          playsInline
          loop
          preload="none"
          onCanPlay={() => setVideoReady(true)}
          onPlaying={() => setVideoReady(true)}
        />
      )}
    </div>
  );
}

/* Emerald gypsophila thread drawn on scroll (GSAP scrubs strokeDashoffset). */
export function ChapterThread() {
  return (
    <div className="chapter-thread" aria-hidden="true">
      <svg width="26" height="96" viewBox="0 0 26 96" fill="none">
        <path
          className="thread-stem"
          d="M13 2 C 13 26, 11 44, 13 62 C 15 78, 13 84, 13 94"
          stroke="var(--gold)"
          strokeWidth="1.1"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
        />
        <circle className="thread-dot" cx="8" cy="34" r="1.6" fill="var(--gold-light)" />
        <circle className="thread-dot" cx="18" cy="52" r="1.6" fill="var(--gold-light)" />
        <circle className="thread-dot" cx="9" cy="70" r="1.6" fill="var(--gold-light)" />
      </svg>
    </div>
  );
}

/* ───────────────────────── The scroll engine ─────────────────────────
   Lenis + GSAP ScrollTrigger, window-level scroller. Pinned chapters whose
   text builds on scroll (scrub, reversible), dissolve handoff, parallax,
   §4 video scrub, thread draw, scroll-cue fade, and active-chapter tracking. */
export interface ChapterScrollHandle {
  destroy: () => void;
  scrollTo: (target: HTMLElement | number) => void;
  pause: () => void;
  resume: () => void;
  playIntro: () => void; // one-shot Bismillah writing-on, called once on open
}

export function initChapterScroll({
  content,
}: {
  content: HTMLElement;
}): ChapterScrollHandle {
  // Glide + settle: eased momentum, never jumpy or sticky
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t: number) => 1 - Math.pow(1 - t, 3),
    smoothWheel: true,
  });

  lenis.on('scroll', ScrollTrigger.update);
  const ticker = (time: number) => lenis.raf(time * 1000);
  gsap.ticker.add(ticker);
  gsap.ticker.lagSmoothing(0);

  const ctx = gsap.context(() => {
    const sections = gsap.utils.toArray<HTMLElement>('[data-section]');
    const isRtl = document.documentElement.dir === 'rtl';

    // Scroll cue fades out on first scroll
    const cue = content.querySelector<HTMLElement>('[data-scroll-cue]');
    if (cue) {
      gsap.to(cue, {
        autoAlpha: 0,
        ease: 'none',
        scrollTrigger: { start: 60, end: 260, scrub: true },
      });
    }

    // ── Reveal vocabulary — refined entrance motions per element TYPE. fromTo so
    // pieces can be pre-hidden (no FOUC) and revealed to explicit states. Blur is
    // desktop-only (dropped on mobile for 60fps). transform/opacity/filter only. ──
    const EASE_ENTER = 'expo.out';
    const EASE_SOFT = 'quint.out';

    const blur = (mob: boolean, px: number, obj: gsap.TweenVars): gsap.TweenVars =>
      mob ? obj : { ...obj, filter: `blur(${px}px)` };

    // Per-chapter directional variety (some rise, some from a side)
    const dirVec = (dir: string): gsap.TweenVars => {
      switch (dir) {
        case 'left':
          return { x: -50 };
        case 'right':
          return { x: 50 };
        case 'scale':
          return { scale: 0.82 };
        case 'bottom-right':
          return { x: 34, y: 34 };
        default:
          return { y: 40 };
      }
    };

    // Detect an element's ROLE → choose the right entrance animation
    const roleOf = (el: HTMLElement): string => {
      if (el.classList.contains('media-card')) return 'media';
      if (el.querySelector('.gsap-word, .gsap-char')) return 'heading';
      if (el.querySelector('.countdown-unit')) return 'timer';
      if (el.querySelector('.calendar-grid') || el.classList.contains('calendar-grid')) return 'calendar';
      const cls = String(el.className || '');
      if (el.tagName === 'A' || el.querySelector('.btn-gold') || /bg-black\/5|backdrop-blur/.test(cls)) return 'card';
      const txt = (el.textContent || '').replace(/\s+/g, '');
      const isDiv =
        el.classList.contains('divider-gold') ||
        el.classList.contains('divider-gold-wide') ||
        !!el.querySelector('.divider-gold, .divider-gold-wide');
      if (isDiv && txt.length === 0) return 'divider';
      if (el.querySelector('svg') && txt.length < 3) return 'ornament';
      if (/uppercase/.test(cls) && txt.length < 42) return 'kicker';
      return 'block';
    };

    // Each entrance adds its ENTER tweens (hidden → shown) at time 0 of `tl`.
    const REVEAL: Record<string, (tl: gsap.core.Timeline, el: HTMLElement, dir: string, mob: boolean) => void> = {
      // Framed media card: fade + rise + gentle scale settle (video already playing)
      media(tl, el, dir, mob) {
        tl.fromTo(el, blur(mob, 10, { autoAlpha: 0, y: 44, scale: 0.94 }), blur(mob, 0, { autoAlpha: 1, y: 0, scale: 1, duration: 0.85, ease: EASE_ENTER }), 0);
      },
      // Heading / names: container sharpens (blur→0) while text rises out of a mask,
      // EN per-character / AR per-word (joining preserved by the markup).
      heading(tl, el, dir, mob) {
        tl.fromTo(el, blur(mob, 8, { autoAlpha: 0, y: 10 }), blur(mob, 0, { autoAlpha: 1, y: 0, duration: 0.4, ease: EASE_ENTER }), 0);
        const units = el.querySelectorAll<HTMLElement>('.gsap-word, .gsap-char');
        const stg = units.length > 26 ? 0.03 : units.length > 14 ? 0.05 : 0.08;
        tl.fromTo(units, { yPercent: 120, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: stg, duration: 0.5, ease: EASE_ENTER }, 0.05);
      },
      // Kicker / small uppercase label: editorial letter-spacing expand-in
      kicker(tl, el) {
        const ls = gsap.getProperty(el, 'letterSpacing') as number;
        tl.fromTo(el, { autoAlpha: 0, letterSpacing: 0, y: 6 }, { autoAlpha: 1, letterSpacing: ls, y: 0, duration: 0.65, ease: EASE_ENTER }, 0);
      },
      // Body / labeled block: directional rise/side + fade + faint blur; inner label tracks open
      block(tl, el, dir, mob) {
        tl.fromTo(el, blur(mob, 5, { autoAlpha: 0, ...dirVec(dir) }), blur(mob, 0, { autoAlpha: 1, x: 0, y: 0, scale: 1, duration: 0.7, ease: EASE_SOFT }), 0);
        const label = el.querySelector<HTMLElement>('.uppercase, [class*="uppercase"]');
        if (label) {
          const ls = gsap.getProperty(label, 'letterSpacing') as number;
          tl.fromTo(label, { letterSpacing: 0 }, { letterSpacing: ls, duration: 0.55, ease: EASE_ENTER }, 0.1);
        }
      },
      // Divider: draw from the centre outward
      divider(tl, el) {
        const line =
          el.classList.contains('divider-gold') || el.classList.contains('divider-gold-wide')
            ? el
            : el.querySelector<HTMLElement>('.divider-gold, .divider-gold-wide') || el;
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0);
        tl.fromTo(line, { scaleX: 0 }, { scaleX: 1, transformOrigin: 'center center', duration: 0.6, ease: EASE_ENTER }, 0);
      },
      // Ornament / icon: fade + scale-in with a soft back.out overshoot + rotate settle
      ornament(tl, el, dir, mob) {
        const svg = el.querySelector<HTMLElement>('svg') || el;
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0);
        tl.fromTo(svg, blur(mob, 3, { scale: 0.55, rotate: -8, autoAlpha: 0 }), blur(mob, 0, { scale: 1, rotate: 0, autoAlpha: 1, duration: 0.7, ease: 'back.out(1.6)' }), 0);
      },
      // Countdown units: each cell settles with scale+rise+blur overshoot
      timer(tl, el, dir, mob) {
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0);
        const units = el.querySelectorAll<HTMLElement>('.countdown-unit');
        tl.fromTo(units, blur(mob, 4, { autoAlpha: 0, scale: 0.7, yPercent: 24 }), blur(mob, 0, { autoAlpha: 1, scale: 1, yPercent: 0, stagger: 0.1, duration: 0.55, ease: 'back.out(1.4)' }), 0.05);
      },
      // Calendar: quick left-to-right wave of cells
      calendar(tl, el) {
        tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2 }, 0);
        const cells = el.querySelectorAll<HTMLElement>('.cal-header, .cal-day');
        tl.fromTo(cells, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, stagger: 0.01, duration: 0.35, ease: EASE_SOFT }, 0.05);
      },
      // Cards / buttons: fade + rise + settle
      card(tl, el, dir, mob) {
        tl.fromTo(el, blur(mob, 6, { autoAlpha: 0, y: 40, scale: 0.965 }), blur(mob, 0, { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, ease: EASE_ENTER }), 0);
      },
    };

    // ─────────────────────────────────────────────────────────────
    // DOCK-AND-ACCUMULATE MODEL — a chapter's media docks framed at the
    // top (CSS position:sticky) and STAYS; the chapter's data reveals
    // element-by-element below and ACCUMULATES; the WHOLE chapter fades
    // only as you scroll past it (reversible). No GSAP pins anywhere.
    // ─────────────────────────────────────────────────────────────

    // (A) MEDIA — the framed thumbnail reveals ONCE on entry (fade + rise + scale),
    // then FADES OUT as it scrolls up out of view (not sticky). Reversible.
    const buildDockReveals = (mob: boolean) => {
      document.documentElement.classList.add('sm-armed'); // arms the dock CSS
      sections.forEach((sec) => {
        const dock = sec.querySelector<HTMLElement>('[data-dock]');
        const card = dock?.querySelector<HTMLElement>('.media-card');
        if (!dock || !card) return; // §2 has no dock → skip
        gsap.set(card, { autoAlpha: 0 }); // FOUC guard on the exact revealed element
        const t = gsap.timeline({
          scrollTrigger: {
            trigger: sec,
            start: 'top 85%',
            end: 'top 48%',
            scrub: mob ? 0.6 : 0.8,
            invalidateOnRefresh: true,
          },
        });
        REVEAL.media(t, card, 'bottom', mob); // fade + rise + scale settle
        // fade the media OUT as it scrolls up past the top of the viewport
        gsap.fromTo(
          card,
          { autoAlpha: 1 },
          {
            autoAlpha: 0,
            ease: 'none',
            immediateRender: false,
            scrollTrigger: {
              trigger: card,
              start: 'top 14%',
              end: 'top -16%',
              scrub: mob ? 0.5 : 0.8,
              invalidateOnRefresh: true,
            },
          }
        );
      });
    };

    // (B) ACCUMULATE — every data element reveals once, element-by-element, and STAYS
    // (no leave tween → it accumulates beneath the docked media and stays interactive).
    const buildRestReveals = (mob: boolean) => {
      gsap.utils.toArray<HTMLElement>('[data-rest] > *', content).forEach((el) => {
        const secId = (el.closest('[data-section]') as HTMLElement | null)?.dataset.section;
        if (secId === '2') {
          // §2 Blessing is driven by playIntro (Bismillah) + buildBlessingWriteOn
          // (the rest) — never scroll-hide it here. Clear any leftover clip on re-init.
          el.style.clipPath = '';
          (el.style as unknown as { webkitClipPath: string }).webkitClipPath = '';
          return;
        }
        gsap.set(el, { autoAlpha: 0 });
        const dir = (el.closest('[data-section]') as HTMLElement | null)?.dataset.enter || 'bottom';
        const role = (el.dataset.revealAs as keyof typeof REVEAL) || roleOf(el);
        const tl = gsap.timeline({
          scrollTrigger: { trigger: el, start: 'top 85%', end: 'top 55%', scrub: 0.8 },
        });
        REVEAL[role](tl, el, dir, mob);
      });
    };

    // (B2) BLESSING WRITE-ON — §2's data CONTINUES the Bismillah "typing" instead of a
    // plain fade. Per element TYPE:
    //   • single-line text  → stepped clip-path wipe (RTL for Arabic, LTR for Latin),
    //                         one un-split node → Arabic stays JOINED.
    //   • wrapped verses     → brisk per-unit cascade (AR per-word / Latin per-char).
    //   • dividers           → quick centre-out draw.
    // TRIGGER: in-view items auto-continue just after the Bismillah; below-fold items
    // type on as they scroll into view. Pre-hidden before paint (no FOUC), play once.
    const buildBlessingWriteOn = () => {
      const sec = sections.find((s) => s.dataset.section === '2');
      if (!sec) return;
      const els = gsap.utils
        .toArray<HTMLElement>('[data-rest] > *', sec)
        .filter((el) => !el.matches('[data-bismillah]'));
      if (!els.length) return;

      // The blessing "writes on" once, on first open. Any LATER re-init (language
      // toggle, breakpoint change) rebuilds this engine — but re-running the
      // prehide+type choreography is fragile: the prehide (context-bound) offsets
      // each word by yPercent:110, while the reveal tween that pulls it back to 0
      // runs later in an async callback OUTSIDE the GSAP context, so it isn't
      // reliably fired/completed. That strands the words at yPercent:110, clipped
      // inside their overflow-hidden masks — so the aya "disappears" in the other
      // language. On re-init we therefore skip the choreography entirely and just
      // force every §2 line to its final, visible state.
      if (blessingIntroPlayed) {
        els.forEach((el) => {
          const units = el.querySelectorAll<HTMLElement>('.gsap-word, .gsap-char, .wo-word');
          if (units.length) gsap.set(units, { clearProps: 'transform,opacity,visibility' });
          gsap.set(el, { clearProps: 'opacity,visibility' });
          el.style.clipPath = '';
          (el.style as unknown as { webkitClipPath: string }).webkitClipPath = '';
        });
        return;
      }
      blessingIntroPlayed = true;

      // strip harakat / superscript-alef / tatweel / Quranic marks / whitespace for step count
      const STRIP = /[ً-ٰٕـۖ-ۭ\s]/g;
      const stepsOf = (t: string) => Math.max(6, Math.min(38, (t || '').replace(STRIP, '').length));
      const hasArabic = (t: string) => /[؀-ۿ]/.test(t || '');

      type Player = { el: HTMLElement; dur: number; prehide: () => void; play: () => void };

      const makeWriteOn = (el: HTMLElement): Player => {
        const isDivider =
          el.classList.contains('divider-gold') ||
          el.classList.contains('divider-gold-wide') ||
          !!el.querySelector('.divider-gold, .divider-gold-wide');
        const units = el.querySelectorAll<HTMLElement>('.gsap-word, .gsap-char');

        // DIVIDER → quick centre-out draw (short, so it never stalls the sequence)
        if (isDivider) {
          const line =
            (el.classList.contains('divider-gold') || el.classList.contains('divider-gold-wide')
              ? el
              : el.querySelector<HTMLElement>('.divider-gold, .divider-gold-wide')) || el;
          return {
            el,
            dur: 0.4,
            prehide: () => gsap.set(el, { autoAlpha: 0 }),
            play: () => {
              gsap.set(el, { autoAlpha: 1 });
              gsap.fromTo(
                line,
                { scaleX: 0 },
                { scaleX: 1, transformOrigin: 'center center', duration: 0.4, ease: 'power2.out' },
              );
            },
          };
        }

        // WRAPPED VERSE (WordsReveal) → brisk per-unit TYPING cascade; AR words stay joined
        if (units.length) {
          const stg = Math.min(0.055, 1.1 / units.length);
          return {
            el,
            dur: 0.35 + stg * units.length,
            prehide: () => gsap.set(units, { autoAlpha: 0, yPercent: 110 }),
            play: () =>
              gsap.to(units, {
                autoAlpha: 1,
                yPercent: 0,
                stagger: stg,
                duration: 0.32,
                ease: 'power2.out',
              }),
          };
        }

        // PLAIN TEXT: single line → clip wipe (like the Bismillah); multi-line → word cascade
        const txt = el.textContent || '';
        const rtl = (el.getAttribute('dir') || '').toLowerCase() === 'rtl' || hasArabic(txt);
        let oneLine = true;
        try {
          const r = document.createRange();
          r.selectNodeContents(el);
          oneLine = r.getClientRects().length <= 1;
        } catch {
          /* default to clip wipe */
        }

        if (oneLine) {
          const N = stepsOf(txt);
          el.style.display = 'inline-block';
          el.style.maxWidth = '100%';
          el.style.whiteSpace = 'nowrap';
          const clip = (v: number) =>
            rtl ? `inset(-0.35em 0 -0.45em ${v}%)` : `inset(-0.35em ${v}% -0.45em 0)`;
          const apply = (v: number) => {
            const c = clip(v);
            el.style.clipPath = c;
            (el.style as unknown as { webkitClipPath: string }).webkitClipPath = c;
          };
          const dur = Math.min(1.3, N * 0.065);
          return {
            el,
            dur,
            prehide: () => {
              gsap.set(el, { autoAlpha: 1, willChange: 'clip-path' });
              apply(100);
            },
            play: () => {
              const s = { v: 100 };
              gsap.to(s, {
                v: 0,
                duration: dur,
                ease: `steps(${N})`,
                onUpdate: () => apply(s.v),
                onComplete: () => {
                  el.style.clipPath = '';
                  (el.style as unknown as { webkitClipPath: string }).webkitClipPath = '';
                  el.style.willChange = '';
                },
              });
            },
          };
        }

        // MULTI-LINE plain text → split into WORD spans (splits at spaces only, so Arabic
        // joining is preserved) and cascade them → reads as continued writing, no curtain.
        const words = txt.split(/\s+/).filter(Boolean);
        el.textContent = '';
        const spans: HTMLElement[] = [];
        words.forEach((w, i) => {
          const span = document.createElement('span');
          span.className = 'wo-word';
          span.textContent = w;
          el.appendChild(span);
          spans.push(span);
          if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
        });
        const stg = Math.min(0.05, 1.1 / spans.length);
        return {
          el,
          dur: 0.3 + stg * spans.length,
          prehide: () => gsap.set(spans, { autoAlpha: 0, yPercent: 45 }),
          play: () =>
            gsap.to(spans, {
              autoAlpha: 1,
              yPercent: 0,
              stagger: stg,
              duration: 0.3,
              ease: 'power2.out',
            }),
        };
      };

      const players = els.map(makeWriteOn);
      players.forEach((p) => p.prehide()); // pre-paint hide (runs inside the layout effect)

      // Chain the in-view items just AFTER the Bismillah (≈0.25 + ~1.7s). Re-init is
      // handled by the force-visible early return above, so we only reach here on
      // the very first open.
      const vh = window.innerHeight || 800;
      let chain = 2.2;
      players.forEach((p) => {
        const guard = { done: false };
        const fire = () => {
          if (guard.done) return;
          guard.done = true;
          p.play();
        };
        const inView = p.el.getBoundingClientRect().top < vh * 0.92;
        if (inView) {
          gsap.delayedCall(chain, fire);
          chain += Math.min(p.dur, 0.85) + 0.1; // brisk, slight overlap → keeps "writing" flow
        } else {
          ScrollTrigger.create({ trigger: p.el, start: 'top 82%', once: true, onEnter: fire });
        }
      });
    };

    // (C) LEAVE — the WHOLE chapter (docked media + all data) fades only when scrolled
    // PAST it. Reversible via scrub. §8 (live RSVP) is EXCLUDED so the form never dims.
    const buildChapterFade = (mob: boolean) => {
      sections.forEach((sec) => {
        if (sec.dataset.section === '8') return;
        gsap.to(sec, {
          autoAlpha: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: sec,
            start: 'bottom 80%',
            end: 'bottom 20%',
            scrub: mob ? 0.5 : 0.8,
            invalidateOnRefresh: true,
          },
        });
      });
    };

    // Persistent title lockup slides horizontally with the narrative (à la CAPITOLIUM)
    const buildTitleLockup = () => {
      const inner = document.querySelector<HTMLElement>('.title-lockup-inner');
      if (!inner) return;
      gsap.fromTo(
        inner,
        { xPercent: 12 * (isRtl ? -1 : 1) },
        {
          xPercent: -12 * (isRtl ? -1 : 1),
          ease: 'none',
          scrollTrigger: { trigger: content, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
        }
      );
    };

    const mm = gsap.matchMedia();

    // DESKTOP — sticky dock + accumulate + chapter fade-on-leave
    mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
      buildDockReveals(false);
      buildRestReveals(false);
      buildBlessingWriteOn();
      buildChapterFade(false);
      buildTitleLockup();
      ScrollTrigger.refresh();
      return () => document.documentElement.classList.remove('sm-armed');
    });

    // MOBILE — same model, blur dropped, cheaper scrubs (mobile-first)
    mm.add('(max-width: 767px) and (prefers-reduced-motion: no-preference)', () => {
      buildDockReveals(true);
      buildRestReveals(true);
      buildBlessingWriteOn();
      buildChapterFade(true);
      ScrollTrigger.refresh();
      return () => document.documentElement.classList.remove('sm-armed');
    });

    // reduced-motion / no-JS: neither branch runs → sm-armed never added →
    // dock/rest render as a normal, fully-visible vertical column.

    // Recompute trigger positions once web fonts have settled
    if ((document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready) {
      (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready.then(() => ScrollTrigger.refresh());
    }
  }, content);

  return {
    destroy() {
      gsap.ticker.remove(ticker);
      ctx.revert();
      lenis.destroy();
    },
    scrollTo(target) {
      lenis.scrollTo(target, { duration: 1.2 });
    },
    pause() {
      lenis.stop();
    },
    resume() {
      lenis.start();
    },
    playIntro() {
      ctx.add(() => {
        const bism = content.querySelector<HTMLElement>('[data-bismillah]');
        if (!bism) return;
        // Direction: element dir wins, else document dir. Site Bismillah is Arabic → rtl in both locales.
        const rtl = (bism.getAttribute('dir') || document.documentElement.dir || 'rtl') !== 'ltr';
        // steps ≈ base letters: strip harakat, superscript-alef, tatweel, Quranic marks, whitespace.
        const STRIP = /[ً-ٰٕـۖ-ۭ\s]/g;
        const letters = Math.max(10, Math.min(40, (bism.textContent || '').replace(STRIP, '').length));
        // RTL reveals right→left (shrink LEFT inset 100→0); LTR reveals left→right (shrink RIGHT inset).
        // Negative top/bottom insets so harakat + the letterpress shadow are never sheared.
        const clip = (v: number) =>
          rtl ? `inset(-0.35em 0 -0.45em ${v}%)` : `inset(-0.35em ${v}% -0.45em 0)`;
        const apply = (v: number) => {
          const c = clip(v);
          bism.style.clipPath = c;
          (bism.style as unknown as { webkitClipPath: string }).webkitClipPath = c;
        };
        gsap.set(bism, { autoAlpha: 1, willChange: 'clip-path' });
        apply(100); // pre-clip BEFORE first paint (runs in the layout effect)
        const s = { v: 100 };
        gsap.to(s, {
          v: 0,
          duration: Math.min(2.0, letters * 0.09), // ≈1.7s for the ~19-letter Bismillah
          delay: 0.25, // let the gate light settle first
          ease: `steps(${letters})`, // typewriter tick-per-letter; glyphs stay JOINED
          onUpdate: () => apply(s.v),
          onComplete: () => {
            // hand back a pristine, fully-visible <p>
            bism.style.clipPath = '';
            (bism.style as unknown as { webkitClipPath: string }).webkitClipPath = '';
            bism.style.willChange = '';
          },
        });
      });
    },
  };
}
