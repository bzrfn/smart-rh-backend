import {
  NextFunction,
  Response,
} from 'express';

import {
  normalizeStorageKey,
} from '../config/storage.js';

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
 * Obtiene el propietario de un archivo a partir
 * de la convención oficial de nombres de SMART RH.
 *
 * Formatos soportados:
 *
 * profiles/perfil_<usuarioId>_...
 *
 * credenciales/credencial_<usuarioId>_...
 * credenciales/credencial_<usuarioId>.pdf
 *
 * contratos/contrato_<usuarioId>_<contratoId>_...
 */
function extractOwnerId(
  key: string
): number | null {
  const patterns = [
    /^profiles\/perfil_(\d+)(?:_|\.|$)/i,

    /^credenciales\/credencial_(\d+)(?:_|\.|$)/i,

    /^contratos\/contrato_(\d+)(?:_|\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = key.match(pattern);

    if (!match) {
      continue;
    }

    const userId = Number(match[1]);

    if (
      Number.isInteger(userId) &&
      userId > 0
    ) {
      return userId;
    }
  }

  return null;
}


/**
 * Autoriza acceso a /uploads/*.
 *
 * Reglas:
 *
 * admin:
 *   puede consultar cualquier archivo privado.
 *
 * otros usuarios:
 *   únicamente archivos asociados a su propio ID.
 *
 * claves no reconocidas:
 *   se deniegan para usuarios no administradores.
 */
export function authorizeUploadAccess(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  if (!req.auth) {
    return next(
      new AppError(
        'Unauthorized',
        401
      )
    );
  }

  const params =
    req.params as Record<
      string,
      string
    >;

  const rawKey =
    params['0'];

  if (!rawKey) {
    return next(
      new AppError(
        'Archivo no encontrado',
        404
      )
    );
  }

  let key: string;

  try {
    key =
      normalizeStorageKey(
        rawKey
      );
  } catch {
    return next(
      new AppError(
        'Ruta de archivo inválida',
        400
      )
    );
  }

  const role =
    normalizeRole(
      req.auth.role
    );

  // El administrador puede acceder
  // a todo el repositorio documental.
  if (role === 'admin') {
    return next();
  }

  const ownerId =
    extractOwnerId(key);

  // Para un usuario normal solamente
  // aceptamos archivos cuyo propietario
  // pueda identificarse con seguridad.
  if (ownerId === null) {
    return next(
      new AppError(
        'Forbidden',
        403
      )
    );
  }

  if (
    ownerId !==
    Number(req.auth.userId)
  ) {
    return next(
      new AppError(
        'Forbidden',
        403
      )
    );
  }

  return next();
}
