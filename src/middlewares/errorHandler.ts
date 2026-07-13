import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      console.error('[ERROR]', err);
    } else {
      console.warn(`[WARN] ${err.message}`);
    }

    return res.status(err.statusCode).json({
      ok: false,
      message: err.message,
    });
  }

  console.error('[ERROR]', err);

  return res.status(500).json({
    ok: false,
    message: 'Internal Server Error',
  });
}