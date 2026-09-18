import jwt, {
  type JwtPayload as JsonWebTokenPayload,
  type SignOptions,
} from 'jsonwebtoken';

import {
  env,
} from '../../config/env.js';

import {
  AppError,
} from '../../utils/AppError.js';


export const ADMIN_ACCESS_TOKEN_KIND =
  'ADMIN_PORTAL_ACCESS' as const;

export const ADMIN_ACCESS_TOKEN_SCOPE =
  'portal_admin_entry' as const;

export const ADMIN_ACCESS_TOKEN_AUDIENCE =
  'smart-rh-admin-portal';

export const ADMIN_ACCESS_TOKEN_ISSUER =
  'smart-rh-api';

export const ADMIN_ACCESS_TOKEN_TTL =
  '10m';


export type AdminAccessTokenPayload = {
  kind:
    typeof ADMIN_ACCESS_TOKEN_KIND;

  scope:
    typeof ADMIN_ACCESS_TOKEN_SCOPE;

  sponsorAdminId:
    number;

  sponsorEmail:
    string;
};


function normalizeEmail(
  value: unknown
): string {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase();
}


function isValidAdminId(
  value: unknown
): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) > 0
  );
}


function isValidEmail(
  value: string
): boolean {
  return (
    value.length > 3 &&
    value.includes('@')
  );
}


export function signAdminAccessToken(
  input: {
    sponsorAdminId: number;
    sponsorEmail: string;
  }
): string {
  const sponsorAdminId =
    Number(
      input.sponsorAdminId
    );

  const sponsorEmail =
    normalizeEmail(
      input.sponsorEmail
    );

  if (
    !isValidAdminId(
      sponsorAdminId
    ) ||
    !isValidEmail(
      sponsorEmail
    )
  ) {
    throw new AppError(
      'No se pudo crear la autorización administrativa',
      500
    );
  }

  const payload:
    AdminAccessTokenPayload = {
      kind:
        ADMIN_ACCESS_TOKEN_KIND,

      scope:
        ADMIN_ACCESS_TOKEN_SCOPE,

      sponsorAdminId,

      sponsorEmail,
    };

  const options:
    SignOptions = {
      expiresIn:
        ADMIN_ACCESS_TOKEN_TTL,

      audience:
        ADMIN_ACCESS_TOKEN_AUDIENCE,

      issuer:
        ADMIN_ACCESS_TOKEN_ISSUER,
    };

  return jwt.sign(
    payload,
    env.jwt.secret,
    options
  );
}


export function verifyAdminAccessToken(
  token: string
): AdminAccessTokenPayload {
  const rawToken =
    String(
      token || ''
    )
      .trim();

  if (!rawToken) {
    throw new AppError(
      'Acceso administrativo requerido',
      401
    );
  }

  let decoded:
    string |
    JsonWebTokenPayload;

  try {
    decoded =
      jwt.verify(
        rawToken,
        env.jwt.secret,
        {
          audience:
            ADMIN_ACCESS_TOKEN_AUDIENCE,

          issuer:
            ADMIN_ACCESS_TOKEN_ISSUER,
        }
      );
  } catch {
    throw new AppError(
      'Acceso administrativo inválido o expirado',
      401
    );
  }

  if (
    typeof decoded ===
    'string'
  ) {
    throw new AppError(
      'Acceso administrativo inválido o expirado',
      401
    );
  }

  const kind =
    String(
      decoded.kind || ''
    );

  const scope =
    String(
      decoded.scope || ''
    );

  const sponsorAdminId =
    Number(
      decoded.sponsorAdminId
    );

  const sponsorEmail =
    normalizeEmail(
      decoded.sponsorEmail
    );

  if (
    kind !==
      ADMIN_ACCESS_TOKEN_KIND ||
    scope !==
      ADMIN_ACCESS_TOKEN_SCOPE ||
    !isValidAdminId(
      sponsorAdminId
    ) ||
    !isValidEmail(
      sponsorEmail
    )
  ) {
    throw new AppError(
      'Acceso administrativo inválido o expirado',
      401
    );
  }

  return {
    kind:
      ADMIN_ACCESS_TOKEN_KIND,

    scope:
      ADMIN_ACCESS_TOKEN_SCOPE,

    sponsorAdminId,

    sponsorEmail,
  };
}
