require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Setting up Waitlist Test ---');
  
  // 1. Create a fresh event with exactly 1 ticket
  const event = await prisma.event.create({
    data: {
      title: 'Waitlist Test Event',
      description: 'Testing waitlist flow',
      venue: 'Test Venue',
      startsAt: new Date(),
      tickets: {
        create: [{ seatLabel: 'WL-1', basePrice: 100, status: 'AVAILABLE' }]
      }
    },
    include: { tickets: true }
  });
  
  const ticket = event.tickets[0];
  console.log(`Created event ${event.id} and ticket ${ticket.id}`);

  // 2. Sell out the event (Reserve the ticket)
  console.log('\n--- Reserving ticket to sell out event ---');
  const res1 = await fetch(`http://localhost:3000/api/tickets/${ticket.id}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'other_user' })
  });
  const bookingData = await res1.json();
  console.log('Reservation response:', res1.status, bookingData);

  // 3. Join waitlist
  console.log('\n--- Joining waitlist ---');
  const res2 = await fetch(`http://localhost:3000/api/events/${event.id}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'user_demo_001' })
  });
  const waitlistData = await res2.json();
  console.log('Waitlist response:', res2.status, waitlistData);
  const entryId = waitlistData.id;

  // 4. Force expire the booking in DB to simulate time passing
  console.log('\n--- Simulating time passing (expiring booking) ---');
  await prisma.booking.update({
    where: { id: bookingData.id },
    data: { holdExpiresAt: new Date(Date.now() - 1000) }
  });

  // 5. Run Cleanup Job
  console.log('\n--- Running Cleanup Job ---');
  const res3 = await fetch(`http://localhost:3000/api/cron/cleanup`, { method: 'POST' });
  const cleanupData = await res3.json();
  console.log('Cleanup response:', res3.status, cleanupData);

  // Verify waitlist entry is OFFERED
  const checkEntry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
  console.log('\nWaitlist entry status after cleanup:', checkEntry.status, '(offeredTicketId:', checkEntry.offeredTicketId, ')');

  // 6. Concurrency test for Claim
  console.log('\n--- Step 6: Concurrency test for Claim (20 requests) ---');
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(
      fetch(`http://localhost:3000/api/waitlist/${entryId}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'user_demo_001' }) // must match waitlist user
      }).then(r => r.json().then(data => ({ status: r.status, data })))
    );
  }

  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.status === 201).length;
  const conflictCount = results.filter(r => r.status === 409).length;
  const otherCount = results.length - successCount - conflictCount;

  console.log(`\nTotal Claim Requests: ${results.length}`);
  console.log(`Successful (201): ${successCount}`);
  console.log(`Conflict (409): ${conflictCount}`);
  if (otherCount > 0) {
    console.log(`Other Statuses: ${results.filter(r => r.status !== 201 && r.status !== 409).map(r => r.status).join(', ')}`);
    console.log(results.filter(r => r.status !== 201 && r.status !== 409));
  }

  console.log('\nSuccess Details:', results.find(r => r.status === 201));

  // 7. Verify History
  console.log('\n--- Step 7: Verifying Booking History ---');
  const allBookings = await prisma.booking.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Found ${allBookings.length} total bookings for ticket ${ticket.id}:`);
  allBookings.forEach(b => console.log(` - Booking ${b.id}: userId=${b.userId}, status=${b.status}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
