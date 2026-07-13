import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import { obtenerActividadEmpleado } from './actividad.service.js';
import { AppError } from '../../utils/AppError.js';

export async function obtenerMiActividadController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = req.auth?.userId;

    if (!usuarioId) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const actividad = await obtenerActividadEmpleado(usuarioId);

    res.json({
      ok: true,
      total: actividad.length,
      actividad,
    });
  } catch (error) {
    next(error);
  }
}