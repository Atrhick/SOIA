const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prospects = await prisma.prospect.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Carl', mode: 'insensitive' } },
        { lastName: { contains: 'Malone', mode: 'insensitive' } },
        { lastName: { contains: 'Doe', mode: 'insensitive' } }
      ]
    }
  });

  if (prospects.length > 0) {
    prospects.forEach(p => {
      console.log('---');
      console.log('Name:', p.firstName, p.lastName);
      console.log('Status:', p.status);
      console.log('Business Form Token:', p.businessFormToken || 'None');
      console.log('Orientation Completed:', p.orientationCompletedAt || 'Not yet');
    });
  } else {
    console.log('Prospect not found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
