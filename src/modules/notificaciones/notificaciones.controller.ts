import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import {
  obtenerNotificacionesUsuario,
  marcarNotificacionLeida,
} from './notificaciones.service.js';
import { AppError } from '../../utils/AppError.js';

export async function obtenerMisNotificacionesController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = req.auth?.userId;

    if (!usuarioId) {
      throw new AppError('Usuario no autenticado', 401);
    }

    const notificaciones = await obtenerNotificacionesUsuario(usuarioId);

    res.json({
      ok: true,
      total: notificaciones.length,
      notificaciones,
    });
  } catch (error) {
    next(error);
  }
}

export async function marcarNotificacionLeidaController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const usuarioId = req.auth?.userId;
    const { id } = req.params;

    if (!usuarioId) {
      throw new AppError('Usuario no autenticado', 401);
    }

    await marcarNotificacionLeida(id, usuarioId);

    res.json({
      ok: true,
      message: 'Notificación marcada como leída',
    });
  } catch (error) {
    next(error);
  }
}