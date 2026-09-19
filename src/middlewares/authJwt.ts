import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  verifyJwt,
} from '../config/jwt.js';

import {
  AppError,
} from '../utils/AppError.js';

import {
  findUserAccessState,
  UserAccessState,
} from '../modules/users/users.repository.js';

export type AuthRequest =
  Request & {
    auth?: {
      userId: number;
      role: string;
    };
  };

type JwtClaims = {
  userId: number;
  role?: string;
  sessionVersion?: number;
};

export function resolveAuthContext(
  claims: JwtClaims,
  state: UserAccessState | null
) {
  const userId =
    Number(
      claims?.userId
    );

  if (
    !Number.isInteger(userId) ||
    userId <= 0
  ) {
    throw new AppError(
      'Invalid token',
      401
    );
  }

  if (!state) {
    throw new AppError(
      'Usuario no encontrado',
      401
    );
  }

  if (
    Number(
      state.activo
    ) !== 1
  ) {
    throw new AppError(
      'Usuario inactivo',
      403
    );
  }

  const currentSessionVersion =
    Number(
      state.session_version
    );

  const tokenSessionVersion =
    claims.sessionVersion ===
      undefined
      ? 1
      : Number(
          claims.sessionVersion
        );

  if (
    !Number.isInteger(
      currentSessionVersion
    ) ||
    currentSessionVersion < 1 ||
    !Number.isInteger(
      tokenSessionVersion
    ) ||
    tokenSessionVersion < 1 ||
    tokenSessionVersion !==
      currentSessionVersion
  ) {
    throw new AppError(
      'Sesión expirada. Inicia sesión nuevamente',
      401
    );
  }


  const role =
    String(
      state.role || ''
    )
      .trim()
      .toLowerCase();

  if (!role) {
    throw new AppError(
      'Rol de usuario inválido',
      401
    );
  }

  return {
    userId:
      Number(state.id),
    role,
  };
}

export async function authJwt(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  const header =
    req.headers.authorization ||
    '';

  const token =
    header.startsWith(
      'Bearer '
    )
      ? header.slice(7)
      : '';

  if (!token) {
    console.error(
      `[AUTH] Missing token -> ${req.method} ${req.originalUrl}`
    );

    return next(
      new AppError(
        'Missing token',
        401
      )
    );
  }

  let claims:
    JwtClaims;

  try {
    claims =
      verifyJwt(
        token
      );
  } catch {
    console.error(
      `[AUTH] Invalid token -> ${req.method} ${req.originalUrl}`
    );

    return next(
      new AppError(
        'Invalid token',
        401
      )
    );
  }

  try {
    const state =
      await findUserAccessState(
        claims.userId
      );

    req.auth =
      resolveAuthContext(
        claims,
        state
      );

    return next();
  } catch (error) {
    return next(error);
  }
}
