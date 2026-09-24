import {
  NextFunction,
  Response,
  Router,
} from 'express';

import {
  AuthRequest,
  authJwt,
} from '../../middlewares/authJwt.js';

import {
  AppError,
} from '../../utils/AppError.js';

import {
  all,
  attachComprobante,
  create,
  detail,
  mine,
  review,
} from './incapacidades.controller.js';


export const incapacidadesRoutes =
  Router();


function requireAdmin(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) {
  const role =
    String(
      req.auth?.role ||
      ''
    )
      .trim()
      .toLowerCase();

  if (role !== 'admin') {
    return next(
      new AppError(
        'Forbidden',
        403
      )
    );
  }

  return next();
}


/*
 * Empleado autenticado:
 *
 * POST /incapacidades
 * GET  /incapacidades/mias
 *
 * El usuario se obtiene SIEMPRE del JWT.
 * Nunca se acepta usuario_id desde el body.
 */
incapacidadesRoutes.post(
  '/',
  authJwt,
  create
);

incapacidadesRoutes.get(
  '/mias',
  authJwt,
  mine
);


/*
 * GI-HU02 — comprobante médico.
 *
 * Body JSON:
 * {
 *   base64,
 *   filename
 * }
 *
 * Ownership se valida contra JWT
 * dentro del service.
 */
incapacidadesRoutes.patch(
  '/:id/comprobante',
  authJwt,
  attachComprobante
);


/*
 * Administración:
 *
 * GET /incapacidades
 * PATCH /incapacidades/:id/revision
 */
incapacidadesRoutes.get(
  '/',
  authJwt,
  requireAdmin,
  all
);

incapacidadesRoutes.patch(
  '/:id/revision',
  authJwt,
  requireAdmin,
  review
);


/*
 * Detalle:
 *
 * admin -> cualquiera
 * empleado -> únicamente propio
 *
 * La autorización final de ownership
 * se ejecuta en service.
 */
incapacidadesRoutes.get(
  '/:id',
  authJwt,
  detail
);
