# HSRachidi.com — Wedding Website

A premium bilingual (English/Arabic with RTL) wedding website with full-page immersive scrolling, digital envelope entry, background music, admin dashboard, and complete RSVP management system.

## Tech Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **Styling:** Tailwind CSS with custom luxury theme
- **Database:** PostgreSQL via Prisma ORM
- **Auth:** JWT with bcrypt password hashing
- **Fonts:** Cormorant Garamond, Lora, Amiri, Aref Ruqaa (Google Fonts)

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Database

You need a PostgreSQL database. Options:
- **Local:** Install PostgreSQL, create a database called `hsrachidi_wedding`
- **Supabase:** Create a free project at supabase.com, copy the connection string
- **Neon/Vercel Postgres:** Use any managed PostgreSQL provider

Update `.env` with your database URL:
```
DATABASE_URL="postgresql://user:password@host:5432/hsrachidi_wedding"
```

### 3. Run Migrations & Seed

```bash
npx prisma db push     # Create tables
npm run db:seed         # Seed default data + sample groups
```

### 4. Start Development

```bash
npm run dev
```

Visit:
- **Website:** http://localhost:3000
- **Admin:** http://localhost:3000/admin/login
- **Default login:** username `admin`, password `admin123`

## Project Structure

```
hsrachidi-wedding/
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Database seeder
├── public/
│   ├── uploads/         # User-uploaded files (images, music)
│   ├── audio/           # SFX files
│   └── images/          # Static images
├── src/
│   ├── app/
│   │   ├── page.tsx             # Main wedding page (server component)
│   │   ├── layout.tsx           # Root layout
│   │   ├── globals.css          # Global styles + luxury theme
│   │   ├── admin/
│   │   │   ├── layout.tsx       # Admin auth guard
│   │   │   ├── page.tsx         # Dashboard overview
│   │   │   ├── login/page.tsx   # Login page
│   │   │   ├── content/page.tsx # CMS content editor
│   │   │   ├── guests/page.tsx  # Guest & group management
│   │   │   └── rsvp/page.tsx    # RSVP tracking & export
│   │   └── api/
│   │       ├── auth/route.ts    # Admin authentication
│   │       ├── settings/route.ts # Site settings CRUD
│   │       ├── guests/route.ts  # Guest CRUD
│   │       ├── groups/route.ts  # Group CRUD
│   │       ├── rsvp/route.ts    # RSVP submit & read
│   │       ├── timeline/route.ts # Timeline items CRUD
│   │       ├── upload/route.ts  # File upload handler
│   │       ├── import/route.ts  # CSV guest import
│   │       └── export/route.ts  # CSV RSVP export
│   ├── components/
│   │   ├── WeddingPage.tsx      # Main wedding client component
│   │   └── admin/
│   │       └── AdminShell.tsx   # Admin layout with sidebar
│   ├── lib/
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── auth.ts             # JWT auth utilities
│   │   ├── i18n.ts             # Translations (EN/AR)
│   │   └── settings.ts         # Site settings helper
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── .env.example
├── tailwind.config.ts
└── package.json
```

## Database Schema

### SiteSettings
Stores all editable website content as a JSON blob (hero text, dates, images, etc.)

### TimelineItem
Individual program timeline entries with bilingual labels and sort order.

### Guest
Individual guest records with name, phone, side (bride/groom), relation, and group code.

### GuestGroup
Groups of guests that share one RSVP invitation link. Each group has:
- Unique `groupCode` (human-readable identifier)
- `maxGuests` (capacity for the group)
- Unique `token` (UUID for secure RSVP links)
- `side` (bride/groom)

### RsvpResponse
RSVP submission linked to a group. Stores attendance status, count, guest names, language, and timestamps.

## Admin Dashboard

### Content & Settings
Edit all website text in English and Arabic, upload background images per section, manage music, envelope assets, and all date/time fields.

### Guests & Groups
- Create groups with unique codes and max guest capacity
- Add individual guests to groups
- Generate unique RSVP links per group (copy to clipboard)
- Import guests from CSV

### RSVP Tracking
- View all groups with their RSVP status
- Filter by status (Attending / Not Attending / No Response)
- Filter by side (Bride / Groom)
- Search by name, phone, or group code
- Export full RSVP report as CSV

## RSVP Flow

1. Admin creates a group (e.g., "RACHIDI-FAM") with maxGuests = 4
2. System generates a unique token
3. Admin shares the link: `https://hsrachidi.com/?token=<uuid>`
4. Guest opens link → sees the digital envelope → opens it → scrolls through sections
5. At RSVP section: selects Attending/Not Attending, number of guests, enters names
6. Submission is stored and can be updated if they revisit the same link

## Deployment (Vercel)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-user/hsrachidi-wedding.git
git push -u origin main
```

### 2. Deploy on Vercel

1. Import the repo on [vercel.com](https://vercel.com)
2. Set environment variables:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `ADMIN_JWT_SECRET` — a strong random string (32+ chars)
   - `ADMIN_USERNAME` — your admin username
   - `ADMIN_PASSWORD_HASH` — generate with:
     ```bash
     node -e "require('bcryptjs').hash('your-secure-password', 12).then(console.log)"
     ```
3. Deploy! Vercel will run `prisma generate` via postinstall.

### 3. Run Migrations on Production

```bash
npx prisma db push
```

Or use Vercel's build command:
```
prisma db push && next build
```

### 4. Custom Domain

Add `hsrachidi.com` in Vercel project settings → Domains.

## CSV Import Format

```csv
firstName,familyName,phone,side,relation,groupCode,maxGuests
Hussein,Rachidi,81538385,groom,Groom,RACHIDI-FAM,4
Suzan,Rachidi,,bride,Bride,BRIDE-FAM,4
Ahmad,Khalil,71234567,groom,Friend,FRIENDS-01,2
```

## Customization Notes

### Adding a SFX
Place an MP3 file at `public/audio/seal-open.mp3` for the envelope opening sound effect.

### Fonts
The site loads Google Fonts for both English (Cormorant Garamond, Lora) and Arabic (Amiri, Aref Ruqaa). Modify `src/app/globals.css` to change fonts.

### Colors
The gold/cream luxury palette is defined in `tailwind.config.ts` and `globals.css` CSS variables. Key colors:
- Gold: `#C9A96E` (primary accent)
- Cream: `#FFFDF7` (background)
- Charcoal: `#2a2a2a` (text)

### Sections
All 8 sections are rendered in `src/components/WeddingPage.tsx` with CSS scroll-snap for full-page transitions. Each section supports a background image configurable from the admin panel.

## Security

- Admin routes protected by JWT authentication
- RSVP links use UUID v4 tokens (unguessable, non-sequential)
- Passwords hashed with bcrypt (12 rounds)
- File uploads restricted to authenticated admin
- API routes validate authentication before mutations

## License

Private project for HSRachidi.com wedding.
