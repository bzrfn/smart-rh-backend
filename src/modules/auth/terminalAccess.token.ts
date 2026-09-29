import jwt, {
  SignOptions,
} from 'jsonwebtoken';

import {
  env,
} from '../../config/env.js';

import {
  AppError,
} from '../../utils/AppError.js';


export const TERMINAL_ACCESS_TOKEN_KIND =
  'terminal_attendance_session';

export const TERMINAL_ACCESS_TOKEN_ROLE =
  'terminal_asistencia';

export const TERMINAL_ACCESS_TOKEN_SCOPE =
  'attendance:kiosk';

export const TERMINAL_ACCESS_TOKEN_AUDIENCE =
  'smart-rh-attendance-terminal';

export const TERMINAL_ACCESS_TOKEN_ISSUER =
  'smart-rh-api';


export type TerminalAccessTokenClaims = {
  kind:
    typeof TERMINAL_ACCESS_TOKEN_KIND;

  role:
    typeof TERMINAL_ACCESS_TOKEN_ROLE;

  scope:
    typeof TERMINAL_ACCESS_TOKEN_SCOPE;

  terminalId:
    string;
};


function normalizeTerminalId(
  value:
    unknown
): string {
  return String(
    value ??
    ''
  ).trim();
}


function getTerminalAccessJwtSecret():
  string {
  const secret =
    String(
      env.terminalAccess.jwtSecret ||
      ''
    ).trim();

  if (
    secret.length <
    32
  ) {
    throw new AppError(
      'Configuración de sesión de terminal no disponible',
      503
    );
  }

  return secret;
}


function getTerminalAccessExpiresIn():
  SignOptions['expiresIn'] {
  const value =
    String(
      env.terminalAccess.expiresIn ||
      '8h'
    ).trim();

  return (
    value ||
    '8h'
  ) as
    SignOptions['expiresIn'];
}


export function isTerminalAccessTokenClaims(
  value:
    unknown
): value is TerminalAccessTokenClaims {
  if (
    !value ||
    typeof value !==
      'object'
  ) {
    return false;
  }

  const claims =
    value as Record<
      string,
      unknown
    >;

  return (
    claims.kind ===
      TERMINAL_ACCESS_TOKEN_KIND &&

    claims.role ===
      TERMINAL_ACCESS_TOKEN_ROLE &&

    claims.scope ===
      TERMINAL_ACCESS_TOKEN_SCOPE &&

    typeof claims.terminalId ===
      'string' &&

    claims.terminalId.trim().length >
      0 &&

    claims.terminalId.trim().length <=
      64
  );
}


export function signTerminalAccessToken(
  input: {
    terminalId:
      string;
  }
): string {
  const terminalId =
    normalizeTerminalId(
      input.terminalId
    );

  if (
    !terminalId ||
    terminalId.length > 64
  ) {
    throw new AppError(
      'Identificador de terminal inválido',
      400
    );
  }

  const payload:
    TerminalAccessTokenClaims = {
      kind:
        TERMINAL_ACCESS_TOKEN_KIND,

      role:
        TERMINAL_ACCESS_TOKEN_ROLE,

      scope:
        TERMINAL_ACCESS_TOKEN_SCOPE,

      terminalId,
    };

  return jwt.sign(
    payload,
    getTerminalAccessJwtSecret(),
    {
      algorithm:
        'HS256',

      audience:
        TERMINAL_ACCESS_TOKEN_AUDIENCE,

      issuer:
        TERMINAL_ACCESS_TOKEN_ISSUER,

      expiresIn:
        getTerminalAccessExpiresIn(),
    }
  );
}


export function verifyTerminalAccessToken(
  tokenInput:
    string
): TerminalAccessTokenClaims {
  const token =
    String(
      tokenInput ||
      ''
    ).trim();

  if (!token) {
    throw new AppError(
      'Sesión de terminal inválida o expirada',
      401
    );
  }

  let decoded:
    unknown;

  try {
    decoded =
      jwt.verify(
        token,
        getTerminalAccessJwtSecret(),
        {
          algorithms: [
            'HS256',
          ],

          audience:
            TERMINAL_ACCESS_TOKEN_AUDIENCE,

          issuer:
            TERMINAL_ACCESS_TOKEN_ISSUER,
        }
      );
  } catch {
    throw new AppError(
      'Sesión de terminal inválida o expirada',
      401
    );
  }

  if (
    !isTerminalAccessTokenClaims(
      decoded
    )
  ) {
    throw new AppError(
      'Sesión de terminal inválida o expirada',
      401
    );
  }

  return {
    kind:
      TERMINAL_ACCESS_TOKEN_KIND,

    role:
      TERMINAL_ACCESS_TOKEN_ROLE,

    scope:
      TERMINAL_ACCESS_TOKEN_SCOPE,

    terminalId:
      decoded.terminalId.trim(),
  };
}
