const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'main' } });
    console.log('Current settings exists:', Boolean(settings));
    if (settings) console.log('Data keys:', Object.keys(settings.data || {}));

    // Try a test upsert with a simple change
    const testData = settings ? settings.data : {};
    const result = await prisma.siteSettings.upsert({
      where: { id: 'main' },
      update: { data: testData },
      create: { id: 'main', data: {} },
    });
    console.log('Upsert succeeded:', Boolean(result));
  } catch (e) {
    console.error('Error:', e.message);
    console.error('Code:', e.code);
    console.error('Full:', e);
  } finally {
    await prisma.$disconnect();
  }
}
test();
