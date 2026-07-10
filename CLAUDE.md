# CLAUDE.md

Guidance for Claude Code (claude.ai/code) working in this repository.

> **Canonical repo.** This folder (`C:\hsrachidi-wedding`) is the source of truth that deploys **GitHub (`hrachidi1991/hsrachidi-wedding`, branch `main`) → Vercel → https://www.therachidis.com**. A stale earlier snapshot exists at `…\OneDrive - Rachidi Home S.A.R.L\Documents\hsrachidi-wedding` (Prisma 5, framer-motion, multer, no Blob/xlsx) — **do NOT edit that copy; it is not production.**

## Project Overview

Bilingual (English / Arabic with RTL) **single-page wedding invitation + RSVP** for **Hussein & Suzan**. Digital-envelope entry animation, full-page scroll sections, a leading Quran-aya blessing, countdown, per-guest RSVP via personal link, per-language background music, and an admin CMS dashboard for content/guest/RSVP management. Deployed on Vercel with PostgreSQL + Vercel Blob.

- **Wedding date: August 25, 2026** (postponed from June 12). ⚠️ Code *defaults* still say June 12 — the live value is the DB `SiteSettings` row. See TODO.
- **Live domain:** https://www.therachidis.com

## Tech Stack (verified)

- **Framework:** Next.js 14.2 (App Router), TypeScript strict
- **Styling:** Tailwind CSS 3.4, custom theme — ⚠️ token names are misleading (`gold` holds green, `sage` holds gray); see `docs/DESIGN.md`
- **Database:** PostgreSQL via Prisma **6.19**. `src/lib/db.ts` uses a plain `new PrismaClient()` singleton — **no driver adapter** (`@prisma/adapter-neon`/`-pg`, `pg`, `@neondatabase/serverless` are installed but **unused**; this is standard TCP Postgres, not Neon serverless).
- **Auth:** JWT (httpOnly cookie, 7-day) + bcrypt
- **Uploads:** **Vercel Blob** client-upload flow (`@vercel/blob`) — needs `BLOB_READ_WRITE_TOKEN`
- **Import/export:** `xlsx` (Excel guest import), `csv-parse`/`csv-stringify`
- **Fonts:** Google Fonts `@import` (Cormorant Garamond, Lora, Amiri, Aref Ruqaa, Great Vibes, Cinzel). `public/fonts` is empty (no `next/font`/self-host).
- **Animation:** **CSS keyframes + one IntersectionObserver only. `framer-motion` is NOT installed.**

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run db:push      # Push Prisma schema (no migration files)
npm run db:migrate   # Deploy pending migrations
npm run db:seed      # Seed DB (npx tsx prisma/seed.ts) — ⚠️ seed.ts is stale (June 12, old gold color); prefer editing the live DB row
npm run db:studio    # Prisma Studio GUI
npm run db:generate  # Regenerate Prisma client
```

No linter, formatter, or test runner is configured yet. (The current redesign adds Playwright smoke tests.)

## Architecture

- **`app/page.tsx`** — public entry, `export const dynamic = 'force-dynamic'` (SSR per request). Resolves the RSVP link `?g=<groupCode>` (new short link) or `?token=<uuid>` (legacy) against `guestGroup` + `guest`, and passes `settings` + `rsvpData` to the client component.
- **`components/WeddingPage.tsx`** (~1037 lines) — the entire guest experience as one client component: envelope gate, scroll sections, countdown, per-guest RSVP, music/language toggles. Language is React **state** (not routing); `dir` is applied to an inner wrapper div; **`<html lang="en">` is hardcoded** in `app/layout.tsx:21` (does not follow the toggle — a11y/SEO TODO).
- **`app/admin/`** — route-group dashboard. `admin/layout.tsx` is a pass-through; the auth guard lives in **`admin/(dashboard)/layout.tsx`** (`isAdminAuthenticated()` → redirect to `/admin/login`). `admin/login/page.tsx` is a **sibling of the group (unguarded)** → no redirect loop.
- **`app/api/`** — 9 REST routes. Mutations call `requireAdmin()` (`lib/auth.ts`). Public by design: `settings` GET, `timeline` GET, `rsvp` GET + POST.
- **`lib/`** — `db.ts` (Prisma singleton), `auth.ts` (JWT/bcrypt), `settings.ts` (`SiteContent` interface + `defaultSettings`, merged over the DB row), `i18n.ts` (EN/AR strings).

### Database (Prisma) — 5 models

`SiteSettings` (single row `id="main"`, `data` JSON blob = all content) · `TimelineItem` (vestigial; not rendered) · `Guest` (`name`, `phone?`, `side`, `groupCode`) · `GuestGroup` (`groupCode @unique`, `maxGuests`, `token @unique`) · `RsvpResponse` (`attending`, `numberAttending`, `guestNames` JSON, `language`).

**Per-guest attendance is stored inside `RsvpResponse.guestNames` JSON** as `GuestAttendance[] { name, attending }` (see `types/index.ts`) — not columns. `Guest.groupCode` is a plain string, **not** a foreign key.

### Real public section order (as rendered)

Envelope Gate (`/images/envelope-start.png`) → **Quran Aya** (`data-section=2`, the lead) → Hero (`=3`, optional via `settings.showHeroNames`) → Formal Invitation (`=4`) → Countdown (`=5`) → Location (`=6`) → Gift Registry / Whish (`=7`) → RSVP + footer (`=8`). **No Program/Timeline section** (only vestigial `TimelineItem` model, `/api/timeline`, `timelineBg`, `programTitle` remain).

## Scope boundaries (current work: storytelling reskin + security hardening)

**MAY touch:** visual theme, typography, layout, motion, `components/WeddingPage.tsx`, design tokens, the seed/settings date, accessibility, media assets, and the security fixes in `docs/SECURITY.md`.

**MUST NOT touch without asking:** the Prisma schema shape, the 9 API route request/response contracts, the token/short-link RSVP flow, and the admin CMS structure.

## Known Issues / TODO

- **Security (open):** JWT secret fallback `auth.ts:5`; `admin123` password fallback `auth.ts:12-15`; CSV formula injection in `api/export`. **(partial):** `rsvp` accepts negative/NaN counts + stores raw names. **(done):** Vercel Blob upload, admin redirect-loop. Full status → `docs/SECURITY.md`.
- **Design/a11y:** `gold` token holds green; `gold`≈`olive` duplicate ramps; `sage`=gray; the only real gold left is `#B8965A` in splash animations; pervasive hardcoded `#546A50`; `<html lang>`/`dir` don't follow the language toggle; small green-on-near-white text risks failing WCAG AA. Detail → `docs/DESIGN.md`.
- **Content:** wedding date defaults still `June 12, 2026` across 5 keys in `lib/settings.ts` (+ `seed.ts`); the authoritative live value is the DB `SiteSettings.data` row → change to **Aug 25, 2026** there. Decide the new RSVP deadline separately.
- **Ops:** a GitHub PAT is embedded in `.git/config` (rotate it); `.env.example` is missing `BLOB_READ_WRITE_TOKEN`; unused Neon/pg adapters can be dropped.

## Environment Variables

`DATABASE_URL`, `ADMIN_JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `NEXT_PUBLIC_BASE_URL`, `BLOB_READ_WRITE_TOKEN`.

Generate password hash: `node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"`
