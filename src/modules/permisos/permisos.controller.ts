import { Request, Response, NextFunction } from 'express';
import { getMyPermisos, getUserPermisos, updateUserPermisos } from './permisos.service.js';
import { AuthRequest } from '../../middlewares/authJwt.js';

export async function getMyPermisosController(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const permisos = await getMyPermisos(req.auth!.userId);

    res.json({
      ok: true,
      permisos,
    });
  } catch (e) {
    next(e);
  }
}

export async function getUserPermisosController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.params.userId);
    const permisos = await getUserPermisos(userId);

    res.json({
      ok: true,
      permisos,
    });
  } catch (e) {
    next(e);
  }
}

export async function updatePermisosController(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = Number(req.params.userId);
    const result = await updateUserPermisos(userId, req.body);

    res.json({
      ok: true,
      ...result,
    });
  } catch (e) {
    next(e);
  }
}