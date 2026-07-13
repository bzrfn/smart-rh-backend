import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middlewares/authJwt.js';
import {
  approveAsistencia,
  cleanupExpiredQrs,
  generateDynamicQr,
  getAsistencias,
  getMisAsistencias,
  getMisAsistenciasWeekly,
  getMisAsistenciasWeeklyReport,
  getPendientes,
  rejectAsistencia,
  scanQr,
} from './asistencia.service.js';
import { registrarActividadEmpleado } from '../actividad/actividad.service.js';

export async function generateQrController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const qr = await generateDynamicQr();

    res.json({
      ok: true,
      ...qr,
    });
  } catch (e) {
    next(e);
  }
}

export async function cleanupQrController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const deleted = await cleanupExpiredQrs();

    res.json({
      ok: true,
      deleted,
      message: 'QR expirados eliminados correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function scanController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await scanQr(
      req.auth!.userId,
      String(req.body?.token || '').trim()
    );

    await registrarActividadEmpleado({
      usuario_id: req.auth!.userId,
      tipo: 'ESCANEO_QR',
      titulo: result.tipo === 'entrada' ? 'Entrada registrada' : 'Salida registrada',
      descripcion: result.message || 'El usuario registró asistencia mediante código QR.',
      modulo: 'asistencia',
      origen: 'mobile',
      metadata: {
        asistencia_id: result.id,
        tipo: result.tipo,
      },
    });

    res.status(201).json({
      ok: true,
      id: result.id,
      tipo: result.tipo,
      message: result.message,
    });
  } catch (e) {
    next(e);
  }
}

export async function listMineController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const asistencias = await getMisAsistencias(req.auth!.userId);

    res.json({
      ok: true,
      asistencias,
    });
  } catch (e) {
    next(e);
  }
}

export async function listMineWeeklyController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const data = await getMisAsistenciasWeekly(req.auth!.userId);

    res.json({
      ok: true,
      week: data.week,
      asistencias: data.asistencias,
    });
  } catch (e) {
    next(e);
  }
}

export async function weeklyReportMineController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const report = await getMisAsistenciasWeeklyReport(req.auth!.userId);

    res.json({
      ok: true,
      report,
    });
  } catch (e) {
    next(e);
  }
}

export async function listAllController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const asistencias = await getAsistencias();

    res.json({
      ok: true,
      asistencias,
    });
  } catch (e) {
    next(e);
  }
}

export async function listPendientesController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const asistencias = await getPendientes();

    res.json({
      ok: true,
      asistencias,
    });
  } catch (e) {
    next(e);
  }
}

export async function approveController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await approveAsistencia(Number(req.params.id));

    res.json({
      ok: true,
      message: 'Asistencia aprobada correctamente',
    });
  } catch (e) {
    next(e);
  }
}

export async function rejectController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    await rejectAsistencia(Number(req.params.id));

    res.json({
      ok: true,
      message: 'Asistencia rechazada correctamente',
    });
  } catch (e) {
    next(e);
  }
}