const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Find an available ticket
  let ticket = await prisma.ticket.findFirst({
    where: { status: 'AVAILABLE' }
  });

  if (!ticket) {
    // Let's create an event and a ticket
    const event = await prisma.event.create({
      data: {
        title: 'Test Event',
        description: 'Testing concurrency',
        venue: 'Test Venue',
        startsAt: new Date(),
      }
    });
    ticket = await prisma.ticket.create({
      data: {
        eventId: event.id,
        seatLabel: 'A1',
        basePrice: 100,
        status: 'AVAILABLE'
      }
    });
  }

  console.log(`Using ticket ID: ${ticket.id}`);

  // 1. Manually test
  console.log('\n--- Step 1: Manually test reserve ---');
  const res1 = await fetch(`http://localhost:3000/api/tickets/${ticket.id}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'user_test_1' })
  });
  const data1 = await res1.json();
  console.log(`Status: ${res1.status}, Data:`, data1);

  // 2. Try reserving same ticket again
  console.log('\n--- Step 2: Try reserving same ticket again ---');
  const res2 = await fetch(`http://localhost:3000/api/tickets/${ticket.id}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'user_test_2' })
  });
  const data2 = await res2.json();
  console.log(`Status: ${res2.status}, Data:`, data2);

  // Reset the ticket for step 3
  // Reset the ticket for step 3 (keeping the previous booking in DB to test history)
  await prisma.booking.updateMany({ where: { ticketId: ticket.id }, data: { status: 'EXPIRED' }});
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'AVAILABLE' } });
  console.log('\nReset ticket to AVAILABLE for concurrency test.');

  // 3. Concurrency test (20 requests)
  console.log('\n--- Step 3: Concurrency test (20 requests) ---');
  const promises = [];
  for (let i = 0; i < 20; i++) {
    promises.push(
      fetch(`http://localhost:3000/api/tickets/${ticket.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: `user_concurrent_${i}` })
      }).then(r => r.json().then(data => ({ status: r.status, data })))
    );
  }

  const results = await Promise.all(promises);
  const successCount = results.filter(r => r.status === 201).length;
  const conflictCount = results.filter(r => r.status === 409).length;
  const otherCount = results.length - successCount - conflictCount;

  console.log(`Total Requests: ${results.length}`);
  console.log(`Successful (201): ${successCount}`);
  console.log(`Conflict (409): ${conflictCount}`);
  if (otherCount > 0) {
    console.log(`Other Statuses: ${results.filter(r => r.status !== 201 && r.status !== 409).map(r => r.status).join(', ')}`);
  }

  console.log('\nSuccess Details:', results.find(r => r.status === 201));

  // 4. Verify History
  console.log('\n--- Step 4: Verifying Booking History ---');
  const allBookings = await prisma.booking.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Found ${allBookings.length} total bookings for ticket ${ticket.id}:`);
  allBookings.forEach(b => console.log(` - Booking ${b.id}: userId=${b.userId}, status=${b.status}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
