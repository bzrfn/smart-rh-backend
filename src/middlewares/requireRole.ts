import {
  NextFunction,
  Response,
} from 'express';

import { AppError } from '../utils/AppError.js';
import { AuthRequest } from './authJwt.js';


function normalizeRole(
  value?: string | null
): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}


export function requireRole(
  ...roles: string[]
) {
  const allowedRoles =
    roles.map(normalizeRole);

  return (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ) => {
    const role =
      normalizeRole(
        req.auth?.role
      );

    if (!role) {
      return next(
        new AppError(
          'Unauthorized',
          401
        )
      );
    }

    if (
      !allowedRoles.includes(
        role
      )
    ) {
      return next(
        new AppError(
          'Forbidden',
          403
        )
      );
    }

    return next();
  };
}
