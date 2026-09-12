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


/**
 * Permite continuar cuando:
 *
 * 1. El usuario autenticado está actuando sobre su propio ID.
 * 2. O posee uno de los roles privilegiados indicados.
 *
 * Ejemplo:
 *
 * requireSelfOrRole('usuarioId', 'admin')
 *
 * Un empleado 22 puede acceder a:
 *
 * /usuarios/22/...
 *
 * pero no a:
 *
 * /usuarios/23/...
 *
 * Un administrador sí puede operar sobre cualquier usuario.
 */
export function requireSelfOrRole(
  paramName: string,
  ...privilegedRoles: string[]
) {
  const normalizedPrivilegedRoles =
    privilegedRoles.map(normalizeRole);

  return (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ) => {
    if (!req.auth) {
      return next(
        new AppError(
          'Unauthorized',
          401
        )
      );
    }

    const targetUserId = Number(
      req.params[paramName]
    );

    if (
      !Number.isInteger(targetUserId) ||
      targetUserId <= 0
    ) {
      return next(
        new AppError(
          'Usuario inválido',
          400
        )
      );
    }

    const authenticatedUserId =
      Number(req.auth.userId);

    const role = normalizeRole(
      req.auth.role
    );

    const isPrivileged =
      normalizedPrivilegedRoles.includes(
        role
      );

    const isSelf =
      authenticatedUserId ===
      targetUserId;

    if (isPrivileged || isSelf) {
      return next();
    }

    return next(
      new AppError(
        'Forbidden',
        403
      )
    );
  };
}
