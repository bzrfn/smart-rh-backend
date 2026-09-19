import jwt, {
  type SignOptions,
} from 'jsonwebtoken';

import {
  env,
} from './env.js';


export type JwtPayload = {
  userId: number;

  role: string;
};


function getSessionJwtSecret():
string {
  const secret =
    String(
      env.jwt.secret ||
      ''
    );

  if (
    secret.length < 32
  ) {
    throw new Error(
      'JWT_SECRET no está configurado de forma segura'
    );
  }

  return secret;
}


// ============================================================
// GENERAR JWT
// ============================================================

export function signJwt(
  payload: JwtPayload
): string {
  const options:
    SignOptions = {
      expiresIn:
        env.jwt.expiresIn as
          SignOptions['expiresIn'],
    };

  return jwt.sign(
    payload,
    getSessionJwtSecret(),
    options
  );
}


// ============================================================
// VERIFICAR JWT
// ============================================================

export function verifyJwt(
  token: string
): JwtPayload {
  return jwt.verify(
    token,
    getSessionJwtSecret()
  ) as JwtPayload;
}
