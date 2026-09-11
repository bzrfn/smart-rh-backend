import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from './env.js';

export type JwtPayload = {
  userId: number;
  role: string;
};


// ============================================================
// GENERAR JWT
// ============================================================

export function signJwt(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(
    payload,
    env.jwt.secret,
    options
  );
}


// ============================================================
// VERIFICAR JWT
// ============================================================

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(
    token,
    env.jwt.secret
  ) as JwtPayload;
}