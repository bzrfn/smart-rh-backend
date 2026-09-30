import type {
  NextFunction,
  Response,
} from 'express';

import type {
  AuthRequest,
} from '../../middlewares/authJwt.js';

import {
  getCalendarioLaboral,
} from './calendario.service.js';


export async function laboral(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data =
      await getCalendarioLaboral(
        req.auth,
        req.query.inicio,
        req.query.fin
      );

    res.json({
      ok: true,
      ...data,
    });
  } catch (error) {
    next(error);
  }
}
