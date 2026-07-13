import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import {
  approveVacaciones,
  getDiasDisponibles,
  getMisVacaciones,
  getVacaciones,
  rejectVacaciones,
  requestVacaciones,
} from './vacaciones.service.js';
import { registrarActividadEmpleado } from '../actividad/actividad.service.js';

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const uid = req.query.usuario_id ? Number(req.query.usuario_id) : undefined;

    res.json({
      ok: true,
      vacaciones: await getVacaciones(uid),
    });
  } catch (e) {
    next(e);
  }
}

export async function listMine(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.auth!.userId;

    res.json({
      ok: true,
      dias_disponibles_actuales: await getDiasDisponibles(userId),
      vacaciones: await getMisVacaciones(userId),
    });
  } catch (e) {
    next(e);
  }
}

export async function create(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const id = await requestVacaciones(req.auth!.userId, req.body);

    await registrarActividadEmpleado({
      usuario_id: req.auth!.userId,
      tipo: 'SOLICITUD_VACACIONES',
      titulo: 'Solicitud de vacaciones',
      descripcion: 'El usuario registró una nueva solicitud de vacaciones.',
      modulo: 'vacaciones',
      origen: 'mobile',
      metadata: {
        solicitud_id: id,
        dias_solicitados: req.body?.dias_solicitados,
        fecha_inicio: req.body?.fecha_inicio,
        fecha_fin: req.body?.fecha_fin,
      },
    });

    res.status(201).json({
      ok: true,
      id,
      message: 'Solicitud de vacaciones registrada correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function approve(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await approveVacaciones(Number(req.params.id));

    res.json({
      ok: true,
      message: 'Solicitud aprobada correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function reject(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await rejectVacaciones(Number(req.params.id));

    res.json({
      ok: true,
      message: 'Solicitud rechazada correctamente',
    });
  } catch (e) {
    next(e);
  }
}