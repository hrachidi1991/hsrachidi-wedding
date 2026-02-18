# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bilingual (English/Arabic with RTL support) wedding website for Hussein & Suzan. Features an envelope-opening entry animation, full-page scroll sections, countdown timer, RSVP system with unique token-based links, background music, and an admin dashboard for content/guest/RSVP management. Deployed on Vercel with PostgreSQL.

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom luxury theme (gold/cream/sage/charcoal palettes)
- **Database**: PostgreSQL via Prisma ORM
- **Auth**: JWT (httpOnly cookies, 7-day expiry) + bcrypt password hashing
- **Animation**: Framer Motion + custom CSS keyframe animations
- **I18n**: Simple object-based translation system in `src/lib/i18n.ts` (not a framework)

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run start        # Start production server
npm run db:push      # Push Prisma schema to database (no migration files)
npm run db:migrate   # Deploy pending Prisma migrations
npm run db:seed      # Seed database (npx tsx prisma/seed.ts)
npm run db:studio    # Open Prisma Studio GUI
npm run db:generate  # Regenerate Prisma client
```

No test runner, linter, or formatter is configured.

## Architecture

### Path alias

`@/*` maps to `./src/*` (configured in tsconfig.json).

### Source layout (`src/`)

- **`app/page.tsx`** — Main wedding page (server component, fetches settings/timeline from DB)
- **`components/WeddingPage.tsx`** — The entire guest-facing experience as a single client component (envelope animation, 8 scroll-snap sections, countdown, RSVP form, music player, language switcher)
- **`app/admin/`** — Admin dashboard pages (dashboard, content editor, guests/groups, RSVP tracker). `admin/layout.tsx` acts as an auth guard redirecting unauthenticated users.
- **`app/api/`** — RESTful API routes. Protected endpoints use `requireAdmin()` from `lib/auth.ts`.
- **`lib/db.ts`** — Prisma client singleton (prevents connection exhaustion in dev hot-reload)
- **`lib/auth.ts`** — JWT utilities, credential verification, admin middleware
- **`lib/settings.ts`** — SiteSettings interface and defaults
- **`lib/i18n.ts`** — All bilingual translations (EN/AR)
- **`types/index.ts`** — Shared TypeScript interfaces

### Database (Prisma)

Schema at `prisma/schema.prisma` with 5 models:
- **SiteSettings** — Single-row JSON blob storing all editable site content
- **TimelineItem** — Wedding program entries (bilingual, sortable)
- **GuestGroup** — Groups with unique code, max capacity, and UUID token for RSVP links
- **Guest** — Individual guests linked to groups
- **RsvpResponse** — RSVP submissions linked to groups

### RSVP Flow

Admin creates a GuestGroup → system generates a UUID token → share link `?token=<uuid>` → guest opens envelope → scrolls site → submits RSVP at the end. Responses can be updated on revisit.

### API Routes

All under `app/api/`. Public: `rsvp` (POST), `settings` (GET). All others require admin JWT auth. File uploads go to `public/uploads/`. CSV import/export supported for guests and RSVP data.

## Environment Variables

See `.env.example`. Required: `DATABASE_URL`, `ADMIN_JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `NEXT_PUBLIC_BASE_URL`.

Generate password hash: `node -e "require('bcryptjs').hash('yourpassword', 12).then(console.log)"`
