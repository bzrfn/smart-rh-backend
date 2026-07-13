import { NextFunction, Response, Request } from 'express';
import { verifyJwt } from '../config/jwt.js';
import { AppError } from '../utils/AppError.js';

export type AuthRequest = Request & { auth?: { userId: number; role: string } };

export function authJwt(req: AuthRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    console.error(`[AUTH] Missing token -> ${req.method} ${req.originalUrl}`);
    return next(new AppError('Missing token', 401));
  }

  try {
    req.auth = verifyJwt(token);
    return next();
  } catch {
    console.error(`[AUTH] Invalid token -> ${req.method} ${req.originalUrl}`);
    return next(new AppError('Invalid token', 401));
  }
}