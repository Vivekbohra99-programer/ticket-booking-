require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Setting up Confirmation Test ---');
  
  // 1. Create a fresh event with exactly 1 ticket
  const event = await prisma.event.create({
    data: {
      title: 'Confirmation Test Event',
      description: 'Testing payment confirmation flow',
      venue: 'Test Venue',
      startsAt: new Date(),
      tickets: {
        create: [{ seatLabel: 'C-1', basePrice: 100, status: 'AVAILABLE' }]
      }
    },
    include: { tickets: true }
  });
  
  const ticket = event.tickets[0];
  console.log(`Created event ${event.id} and ticket ${ticket.id}`);

  // 2. Reserve the ticket
  console.log('\n--- Reserving ticket ---');
  const res1 = await fetch(`http://localhost:3000/api/tickets/${ticket.id}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'user_confirm_001' })
  });
  const bookingData = await res1.json();
  console.log('Reservation response:', res1.status, bookingData);
  const bookingId = bookingData.id;

  // 3. Confirm the booking successfully
  console.log('\n--- Confirming booking (Expected: 200) ---');
  const res2 = await fetch(`http://localhost:3000/api/bookings/${bookingId}/confirm`, {
    method: 'POST'
  });
  const confirmData = await res2.json();
  console.log('Confirmation response:', res2.status, confirmData);

  // 4. Try confirming an already confirmed booking
  console.log('\n--- Try confirming already confirmed booking (Expected: 409) ---');
  const res3 = await fetch(`http://localhost:3000/api/bookings/${bookingId}/confirm`, {
    method: 'POST'
  });
  const confirmData2 = await res3.json();
  console.log('Confirmation response:', res3.status, confirmData2);

  // 5. Expired booking confirmation
  console.log('\n--- Setting up expired booking ---');
  const ticket2 = await prisma.ticket.create({
    data: {
      eventId: event.id,
      seatLabel: 'C-2',
      basePrice: 100,
      status: 'AVAILABLE'
    }
  });

  const res4 = await fetch(`http://localhost:3000/api/tickets/${ticket2.id}/reserve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'user_confirm_002' })
  });
  const bookingData2 = await res4.json();
  console.log('Reservation 2 response:', res4.status, bookingData2);

  // Force expire in DB
  await prisma.booking.update({
    where: { id: bookingData2.id },
    data: { holdExpiresAt: new Date(Date.now() - 1000) }
  });

  console.log('\n--- Try confirming expired booking (Expected: 400) ---');
  const res5 = await fetch(`http://localhost:3000/api/bookings/${bookingData2.id}/confirm`, {
    method: 'POST'
  });
  const confirmData3 = await res5.json();
  console.log('Confirmation response:', res5.status, confirmData3);
}

main().catch(console.error).finally(() => prisma.$disconnect());
