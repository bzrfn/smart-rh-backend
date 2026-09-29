import {
  NextFunction,
  Request,
  Response,
} from 'express';

import {
  AppError,
} from '../utils/AppError.js';

import {
  AdminAccessTokenPayload,
  verifyAdminAccessToken,
} from '../modules/auth/adminAccess.token.js';


export type AdminAccessRequest =
  Request & {
    adminAccess?:
      AdminAccessTokenPayload;
  };


function getBearerToken(
  authorizationHeader:
    string | undefined
): string {
  const header =
    String(
      authorizationHeader ||
      ''
    ).trim();

  if (
    !header.startsWith(
      'Bearer '
    )
  ) {
    return '';
  }

  return header
    .slice(7)
    .trim();
}


export function requireAdminAccess(
  req: AdminAccessRequest,
  _res: Response,
  next: NextFunction
) {
  const token =
    getBearerToken(
      req.headers.authorization
    );

  if (!token) {
    return next(
      new AppError(
        'Acceso administrativo requerido',
        401
      )
    );
  }

  try {
    req.adminAccess =
      verifyAdminAccessToken(
        token
      );

    return next();
  } catch (error) {
    return next(error);
  }
}
