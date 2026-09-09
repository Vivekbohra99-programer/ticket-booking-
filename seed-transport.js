const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding flights and trains...');

  const flight1 = await prisma.event.create({
    data: {
      title: 'Indigo 6E-201',
      description: 'Direct flight from Mumbai to Delhi',
      venue: 'Terminal 2, CSMI Airport',
      type: 'FLIGHT',
      origin: 'Mumbai (BOM)',
      destination: 'New Delhi (DEL)',
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), // 3 days from now
      tickets: {
        create: [
          { seatLabel: '1A', basePrice: 550000 },
          { seatLabel: '1B', basePrice: 550000 },
          { seatLabel: '12C', basePrice: 420000 },
          { seatLabel: '12D', basePrice: 420000 },
          { seatLabel: '24E', basePrice: 380000 },
          { seatLabel: '24F', basePrice: 380000 },
        ],
      },
    },
  });
  console.log(`Created flight: ${flight1.title}`);

  const train1 = await prisma.event.create({
    data: {
      title: 'Vande Bharat Express (22221)',
      description: 'High speed premium train service',
      venue: 'Platform 8, CSMT',
      type: 'TRAIN',
      origin: 'Mumbai (CSMT)',
      destination: 'Pune (PUNE)',
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5), // 5 days from now
      tickets: {
        create: [
          { seatLabel: 'C1-45', basePrice: 95000 },
          { seatLabel: 'C1-46', basePrice: 95000 },
          { seatLabel: 'C2-12', basePrice: 95000 },
          { seatLabel: 'E1-05', basePrice: 180000 }, // Executive Class
          { seatLabel: 'E1-06', basePrice: 180000 },
        ],
      },
    },
  });
  console.log(`Created train: ${train1.title}`);

  console.log('Transport seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
