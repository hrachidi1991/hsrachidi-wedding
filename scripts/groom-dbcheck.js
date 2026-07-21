require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const groups = await prisma.guestGroup.findMany({ select: { groupCode: true, side: true, maxGuests: true } });
  const guests = await prisma.guest.findMany({ select: { groupCode: true, side: true, circle: true } });
  const byPrefix = {};
  for (const g of groups) {
    const p = (g.groupCode || '?').replace(/[0-9].*$/, '') || '?';
    byPrefix[p] = (byPrefix[p] || 0) + 1;
  }
  console.log('TOTAL groups:', groups.length, '| TOTAL guests:', guests.length);
  console.log('Groups by code prefix:', JSON.stringify(byPrefix));
  const codes = groups.map(g => g.groupCode).sort();
  console.log('Sample bride codes:', codes.filter(c => /^b/i.test(c)).slice(0, 5).join(', '));
  console.log('Max bride code:', codes.filter(c => /^b/i.test(c)).slice(-1)[0]);
  console.log('Existing GROOM (g*) codes:', codes.filter(c => /^g/i.test(c)).join(', ') || '(none)');
  const sides = {}; for (const g of guests) sides[g.side || '?'] = (sides[g.side||'?']||0)+1;
  console.log('Guests by side:', JSON.stringify(sides));
  const circles = {}; for (const g of guests) circles[g.circle || '(null)'] = (circles[g.circle||'(null)']||0)+1;
  console.log('Existing circles in use:', JSON.stringify(circles));
  await prisma.$disconnect();
})().catch(e => { console.error('DBCHECK ERROR:', e.message); process.exit(1); });
