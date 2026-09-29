import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  AppError,
} from '../utils/AppError.js';

import {
  TerminalAccessTokenClaims,
  verifyTerminalAccessToken,
} from '../modules/auth/terminalAccess.token.js';


export const TERMINAL_ATTENDANCE_ROLE =
  'terminal_asistencia';

export const TERMINAL_ATTENDANCE_SCOPE =
  'attendance:kiosk';


export type TerminalSessionRequest =
  Request & {
    terminalSession?:
      TerminalAccessTokenClaims;
  };


function getBearerToken(
  req:
    Request
): string | null {
  const authorization =
    String(
      req.headers.authorization ||
      ''
    ).trim();

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  if (!match) {
    return null;
  }

  const token =
    String(
      match[1] ||
      ''
    ).trim();

  return (
    token ||
    null
  );
}


export function requireTerminalSession(
  req:
    TerminalSessionRequest,

  _res:
    Response,

  next:
    NextFunction
) {
  const token =
    getBearerToken(
      req
    );

  if (!token) {
    return next(
      new AppError(
        'Sesión de terminal requerida',
        401
      )
    );
  }

  try {
    const claims =
      verifyTerminalAccessToken(
        token
      );

    req.terminalSession = {
      kind:
        claims.kind,

      role:
        claims.role,

      scope:
        claims.scope,

      terminalId:
        claims.terminalId,
    };

    return next();

  } catch (error) {
    return next(
      error
    );
  }
}
