const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find the prospect
  const prospect = await prisma.prospect.findFirst({
    where: { firstName: 'Prospect', lastName: 'Joe' }
  });

  console.log('=== Prospect ===');
  console.log('ID:', prospect.id);
  console.log('Email:', prospect.email);
  console.log('Status:', prospect.status);
  console.log('Orientation Token:', prospect.orientationToken);

  // Find the booking with similar email
  const booking = await prisma.calendarBooking.findFirst({
    where: {
      bookerEmail: { contains: 'joe', mode: 'insensitive' }
    },
    include: { calendar: true }
  });

  if (booking) {
    console.log('\n=== Found Booking ===');
    console.log('Booker Email:', booking.bookerEmail);
    console.log('Prospect ID on booking:', booking.prospectId);
    console.log('Booking Date:', booking.bookingDate);
    console.log('Start Time:', booking.startTime);

    // Link the booking to the prospect and update prospect status
    if (!booking.prospectId) {
      console.log('\n=== Fixing... ===');

      // Update the booking with the prospect ID
      await prisma.calendarBooking.update({
        where: { id: booking.id },
        data: { prospectId: prospect.id }
      });
      console.log('Linked booking to prospect');

      // Update prospect status
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: {
          orientationScheduledAt: booking.startTime,
          status: 'ORIENTATION_SCHEDULED'
        }
      });
      console.log('Updated prospect status to ORIENTATION_SCHEDULED');

      // Add status history
      await prisma.prospectStatusHistory.create({
        data: {
          prospectId: prospect.id,
          fromStatus: 'ASSESSMENT_COMPLETED',
          toStatus: 'ORIENTATION_SCHEDULED',
          notes: 'Linked to existing booking (manual fix)'
        }
      });
      console.log('Added status history');

      console.log('\n=== Done! ===');
    }
  } else {
    console.log('\nNo booking found with "joe" in email');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
