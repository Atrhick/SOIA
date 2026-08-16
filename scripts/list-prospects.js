const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prospects = await prisma.prospect.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  console.log('=== Recent Prospects ===');
  prospects.forEach(p => {
    console.log('---');
    console.log('Name:', p.firstName, p.lastName);
    console.log('Email:', p.email);
    console.log('Status:', p.status);
    console.log('Orientation Token:', p.orientationToken ? 'Yes' : 'No');
    console.log('Orientation Scheduled:', p.orientationScheduledAt ? p.orientationScheduledAt : 'No');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
