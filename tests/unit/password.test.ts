import { hashPassword, verifyPassword } from '../../src/utils/password.js';
test('hash and verify password', async () => {
  const h = await hashPassword('Admin123!');
  expect(await verifyPassword('Admin123!', h)).toBe(true);
});
