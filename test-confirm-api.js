async function main() {
  console.log('--- Setting up Confirmation Test (via API) ---');
  
  const setupRes = await fetch('http://localhost:3000/api/test-setup', { method: 'POST' });
  const { booking1, booking2 } = await setupRes.json();
  console.log(`Created test setup with Booking 1 (valid): ${booking1} and Booking 2 (expired): ${booking2}`);

  // 1. Confirm the valid booking successfully
  console.log('\n--- Confirming valid booking (Expected: 200) ---');
  const res1 = await fetch(`http://localhost:3000/api/bookings/${booking1}/confirm`, {
    method: 'POST'
  });
  const data1 = await res1.json();
  console.log('Confirmation response:', res1.status, data1);

  // 2. Try confirming already confirmed booking
  console.log('\n--- Try confirming already confirmed booking (Expected: 409) ---');
  const res2 = await fetch(`http://localhost:3000/api/bookings/${booking1}/confirm`, {
    method: 'POST'
  });
  const data2 = await res2.json();
  console.log('Confirmation response:', res2.status, data2);

  // 3. Try confirming expired booking
  console.log('\n--- Try confirming expired booking (Expected: 400) ---');
  const res3 = await fetch(`http://localhost:3000/api/bookings/${booking2}/confirm`, {
    method: 'POST'
  });
  const data3 = await res3.json();
  console.log('Confirmation response:', res3.status, data3);
}

main().catch(console.error);
