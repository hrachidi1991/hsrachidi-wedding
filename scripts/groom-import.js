/* Groom guest-list import + bride-circle rename.
 * Dry-run by default; pass --commit to write to the DB.
 *   node scripts/groom-import.js            # preview
 *   node scripts/groom-import.js --commit   # execute
 */
require('dotenv').config();
const crypto = require('crypto');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COMMIT = process.argv.includes('--commit');
const FILE = 'C:/Users/hrach/OneDrive - Rachidi Home S.A.R.L/Wedding/Guest List/Groom_guest-list_up - v1.xlsx';

const SHEET_CIRCLE = {
  'Main': 'G.Family',
  'Al RAchidi': 'G.Father',
  'Al Hadi ': 'G.Mother',
  'Freinds': 'G.Friends',
  'FAdis': 'G.Fadi',
  'Ahmads': 'G.Ahmad',
  'Social': 'G.Social',
};

// Rename bride circles to the B.* convention (scoped to side='bride').
const BRIDE_RENAME = {
  'Immediate Fam': 'B.Family',
  'Fathers': 'B.Father',
  'Mothers': 'B.Mother',
  'Ghassan Guests': 'B.Ghassan',
  'Ranas Guests': 'B.Rana',
  'Friends': 'B.Friends',
  'Social': 'B.Social',
};

const NEW_CIRCLES = [
  'B.Family', 'B.Father', 'B.Mother', 'B.Ghassan', 'B.Rana', 'B.Friends', 'B.Social',
  'G.Family', 'G.Father', 'G.Mother', 'G.Ahmad', 'G.Fadi', 'G.Friends', 'G.Social',
];

function readGroom() {
  const wb = XLSX.readFile(FILE);
  const guests = [];
  for (const [sheet, circle] of Object.entries(SHEET_CIRCLE)) {
    const ws = wb.Sheets[sheet];
    if (!ws) throw new Error('Missing sheet: ' + sheet);
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    for (let i = 6; i < rows.length; i++) {
      const name = String(rows[i][1] ?? '').trim();
      const phone = String(rows[i][2] ?? '').trim();
      const groupNum = rows[i][5];
      if (!name) continue;
      if (groupNum === '' || groupNum == null) throw new Error('Guest with no group #: ' + sheet + ' / ' + name);
      guests.push({ name, phone, groupNum: Number(groupNum), circle });
    }
  }
  return guests;
}

(async () => {
  const guests = readGroom();

  // distinct group numbers → g001.. codes (sorted numerically)
  const nums = [...new Set(guests.map((g) => g.groupNum))].sort((a, b) => a - b);
  const codeOf = new Map();
  nums.forEach((n, i) => codeOf.set(n, 'g' + String(i + 1).padStart(3, '0')));

  // build groups + guests payloads
  const groupsData = nums.map((n) => {
    const members = guests.filter((g) => g.groupNum === n);
    return { groupCode: codeOf.get(n), maxGuests: members.length, side: 'groom', token: crypto.randomUUID(), inRsvp: false };
  });
  let order = 0;
  const guestsData = [];
  for (const n of nums) {
    for (const g of guests.filter((x) => x.groupNum === n)) {
      guestsData.push({
        name: g.name, phone: g.phone || null, side: 'groom', relation: 'Guest',
        circle: g.circle, groupCode: codeOf.get(n), sortOrder: order++,
      });
    }
  }

  // idempotency guard: refuse if groom g0* groups already exist
  const existing = await prisma.guestGroup.count({ where: { groupCode: { startsWith: 'g0' } } });
  console.log('=== GROOM IMPORT ' + (COMMIT ? '(COMMIT)' : '(DRY-RUN)') + ' ===');
  console.log('guests:', guestsData.length, '| groups:', groupsData.length, '| codes:', groupsData[0].groupCode, '→', groupsData.at(-1).groupCode);
  const perCircle = {};
  for (const g of guestsData) perCircle[g.circle] = (perCircle[g.circle] || 0) + 1;
  console.log('groom circles:', JSON.stringify(perCircle));
  console.log('existing g0* groups already in DB:', existing);

  // bride rename preview
  console.log('\nbride circle renames (scoped side=bride):');
  for (const [from, to] of Object.entries(BRIDE_RENAME)) {
    const c = await prisma.guest.count({ where: { circle: from, side: 'bride' } });
    console.log(`   "${from}" → "${to}"  (${c} bride guests)`);
  }
  console.log('\nsettings.circles will become:', JSON.stringify(NEW_CIRCLES));

  if (existing > 0) {
    console.log('\n!! ABORT: groom groups already exist — refusing to double-import. (delete g0* first to re-run)');
    await prisma.$disconnect();
    return;
  }

  if (!COMMIT) {
    console.log('\nDRY-RUN only. Re-run with --commit to write.');
    await prisma.$disconnect();
    return;
  }

  // ── EXECUTE atomically ──
  const record = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
  const mergedData = { ...(record?.data || {}), circles: NEW_CIRCLES };

  const ops = [
    prisma.guestGroup.createMany({ data: groupsData }),
    prisma.guest.createMany({ data: guestsData }),
    ...Object.entries(BRIDE_RENAME).map(([from, to]) =>
      prisma.guest.updateMany({ where: { circle: from, side: 'bride' }, data: { circle: to } })
    ),
    prisma.siteSettings.upsert({ where: { id: 'main' }, update: { data: mergedData }, create: { id: 'main', data: mergedData } }),
  ];
  await prisma.$transaction(ops);

  const totalGroups = await prisma.guestGroup.count();
  const totalGuests = await prisma.guest.count();
  console.log('\n✅ COMMITTED. DB now has', totalGroups, 'groups and', totalGuests, 'guests.');
  await prisma.$disconnect();
})().catch(async (e) => { console.error('IMPORT ERROR:', e.message); try { await prisma.$disconnect(); } catch {} process.exit(1); });
