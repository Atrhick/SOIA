const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const prospect = await prisma.prospect.findFirst({
    where: { firstName: { contains: 'Joe', mode: 'insensitive' } }
  });

  if (prospect) {
    console.log('=== Prospect ===');
    console.log('Name:', prospect.firstName, prospect.lastName);
    console.log('Email:', prospect.email);
    console.log('Status:', prospect.status);
    console.log('Orientation Token:', prospect.orientationToken || 'None');
    console.log('Orientation Scheduled At:', prospect.orientationScheduledAt || 'Not scheduled');
    console.log('Orientation Completed At:', prospect.orientationCompletedAt || 'Not completed');

    // Check for any bookings with this prospect's email
    const bookings = await prisma.calendarBooking.findMany({
      where: { guestEmail: prospect.email },
      include: { calendar: true, slot: true, event: true }
    });

    console.log('\n=== Bookings ===');
    if (bookings.length > 0) {
      bookings.forEach(b => {
        console.log('---');
        console.log('Calendar:', b.calendar?.name);
        console.log('Date:', b.date);
        console.log('Start:', b.startTime);
        console.log('End:', b.endTime);
        console.log('Status:', b.status);
        console.log('Slot ID:', b.slotId);
        console.log('Event ID:', b.eventId);
      });
    } else {
      console.log('No bookings found for this email');
    }
  } else {
    console.log('Prospect Joe not found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
