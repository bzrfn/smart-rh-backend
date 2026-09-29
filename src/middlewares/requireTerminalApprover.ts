import {
  NextFunction,
  Response,
} from 'express';

import {
  env,
} from '../config/env.js';

import {
  AppError,
} from '../utils/AppError.js';

import {
  AuthRequest,
} from './authJwt.js';

import {
  findEligibleTerminalApproverById,
} from '../modules/auth/terminalAccessApprover.repository.js';


function normalizeEmail(
  value:
    unknown
): string {
  return String(
    value ??
    ''
  )
    .trim()
    .toLowerCase();
}


function looksLikeEmail(
  value:
    string
): boolean {
  return (
    value.length >= 3 &&
    value.length <= 254 &&
    value.includes(
      '@'
    )
  );
}


export async function requireTerminalApprover(
  req:
    AuthRequest,

  _res:
    Response,

  next:
    NextFunction
) {
  try {
    const approverEmail =
      normalizeEmail(
        env.terminalAccess.approverEmail
      );

    if (
      !looksLikeEmail(
        approverEmail
      )
    ) {
      return next(
        new AppError(
          'Aprobador de terminal no configurado',
          503
        )
      );
    }


    const userId =
      Number(
        req.auth?.userId
      );

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      return next(
        new AppError(
          'Sesión administrativa inválida',
          401
        )
      );
    }


    const admin =
      await findEligibleTerminalApproverById(
        userId
      );

    if (!admin) {
      return next(
        new AppError(
          'Administrador no autorizado para aprobar esta terminal',
          403
        )
      );
    }


    const authenticatedEmail =
      normalizeEmail(
        admin.correo
      );

    if (
      !authenticatedEmail ||
      authenticatedEmail !==
        approverEmail
    ) {
      return next(
        new AppError(
          'Administrador no autorizado para aprobar esta terminal',
          403
        )
      );
    }


    return next();

  } catch (error) {
    return next(
      error
    );
  }
}
