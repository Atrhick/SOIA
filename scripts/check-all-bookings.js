const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check all bookings
  const bookings = await prisma.calendarBooking.findMany({
    include: { calendar: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('=== Recent Bookings ===');
  if (bookings.length > 0) {
    bookings.forEach(b => {
      console.log('---');
      console.log('Booker:', b.bookerName, '(' + b.bookerEmail + ')');
      console.log('Calendar:', b.calendar?.name, '(type:', b.calendar?.type, ')');
      console.log('Date:', b.bookingDate);
      console.log('Status:', b.status);
      console.log('Prospect ID:', b.prospectId);
    });
  } else {
    console.log('No bookings found');
  }

  // Check orientation calendar
  const orientationCal = await prisma.adminCalendar.findFirst({
    where: { type: 'ORIENTATION' },
    include: {
      events: { take: 10, orderBy: { startTime: 'desc' } },
      slots: { take: 10 },
      bookings: { take: 10 }
    }
  });

  console.log('\n=== Orientation Calendar ===');
  if (orientationCal) {
    console.log('ID:', orientationCal.id);
    console.log('Name:', orientationCal.name);
    console.log('Slug:', orientationCal.slug);
    console.log('Events count:', orientationCal.events.length);
    console.log('Slots count:', orientationCal.slots.length);
    console.log('Bookings count:', orientationCal.bookings.length);

    if (orientationCal.events.length > 0) {
      console.log('\nEvents:');
      orientationCal.events.forEach(e => {
        console.log('-', e.title, e.startTime);
      });
    }
  } else {
    console.log('No orientation calendar found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
