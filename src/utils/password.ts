import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(value: string) {
  return bcrypt.hash(value, SALT_ROUNDS);
}

export async function verifyPassword(value: string, hashed: string) {
  return bcrypt.compare(value, hashed);
}