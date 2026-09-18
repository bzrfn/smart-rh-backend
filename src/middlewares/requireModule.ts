import {
  NextFunction,
  Response,
} from 'express';

import {
  AuthRequest,
} from './authJwt.js';

import {
  isModuloEnabledForUser,
} from '../modules/permisos/permisos.repository.js';

import {
  ModuloPermiso,
} from '../modules/permisos/permisos.types.js';

import {
  AppError,
} from '../utils/AppError.js';

function normalizeRole(
  value?: string | null
) {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase();
}

export function canAccessModule(
  role: string,
  enabled: boolean
): boolean {
  const normalizedRole =
    normalizeRole(role);

  if (
    normalizedRole ===
    'admin'
  ) {
    return true;
  }

  return (
    normalizedRole ===
      'empleado' &&
    enabled === true
  );
}

export function requireModule(
  modulo: ModuloPermiso
) {
  return async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
  ) => {
    const auth =
      req.auth;

    if (
      !auth ||
      !Number.isInteger(
        auth.userId
      ) ||
      auth.userId <= 0
    ) {
      return next(
        new AppError(
          'Unauthorized',
          401
        )
      );
    }

    const role =
      normalizeRole(
        auth.role
      );

    if (
      role === 'admin'
    ) {
      return next();
    }

    if (
      role !== 'empleado'
    ) {
      return next(
        new AppError(
          'Forbidden',
          403
        )
      );
    }

    try {
      const enabled =
        await isModuloEnabledForUser(
          auth.userId,
          modulo
        );

      if (
        !canAccessModule(
          role,
          enabled
        )
      ) {
        return next(
          new AppError(
            `El módulo ${modulo} no está habilitado para este usuario`,
            403
          )
        );
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
