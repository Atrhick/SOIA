const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Check bookings for pro@joe.com
  const bookings = await prisma.calendarBooking.findMany({
    where: { bookerEmail: 'pro@joe.com' },
    include: { calendar: true, slot: true, event: true }
  });

  console.log('=== Bookings for pro@joe.com ===');
  if (bookings.length > 0) {
    bookings.forEach(b => {
      console.log('---');
      console.log('ID:', b.id);
      console.log('Calendar:', b.calendar?.name, '(type:', b.calendar?.type, ')');
      console.log('Date:', b.bookingDate);
      console.log('Start:', b.startTime);
      console.log('End:', b.endTime);
      console.log('Status:', b.status);
      console.log('Slot ID:', b.slotId);
      console.log('Event ID:', b.eventId);
      console.log('Prospect ID:', b.prospectId);
    });
  } else {
    console.log('No bookings found');
  }

  // Check if there's an orientation calendar
  const orientationCalendar = await prisma.calendar.findFirst({
    where: { type: 'ORIENTATION' },
    include: { events: true, bookings: true }
  });

  console.log('\n=== Orientation Calendar ===');
  if (orientationCalendar) {
    console.log('Name:', orientationCalendar.name);
    console.log('Events:', orientationCalendar.events.length);
    console.log('Bookings:', orientationCalendar.bookings.length);

    if (orientationCalendar.bookings.length > 0) {
      console.log('\nRecent bookings on orientation calendar:');
      orientationCalendar.bookings.forEach(b => {
        console.log('-', b.bookerName, b.bookerEmail, b.bookingDate, b.status);
      });
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
