import request from 'supertest';
import { app } from '../../src/app.js';
test('POST /auth/login missing body -> 400', async () => {
  const res = await request(app).post('/auth/login').send({});
  expect(res.status).toBe(400);
});
