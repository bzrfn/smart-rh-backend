import { NextFunction, Response } from 'express';
import { AppError } from '../utils/AppError.js';
import { AuthRequest } from './authJwt.js';

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const role = req.auth?.role;
    if (!role) return next(new AppError('Unauthorized', 401));
    if (!roles.includes(role)) return next(new AppError('Forbidden', 403));
    return next();
  };
}
