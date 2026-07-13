import jwt from 'jsonwebtoken';
import { env } from './env.js';

export type JwtPayload = { userId: number; role: string };

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

export function verifyJwt(token: string) {
  return jwt.verify(token, env.jwt.secret) as JwtPayload;
}
