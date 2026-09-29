import {
  Request,
  Response,
  NextFunction,
} from 'express';

import {
  AuthRequest,
} from '../../middlewares/authJwt.js';

import {
  approveAsistencia,
  correctAsistencia,
  getAsistenciaRevisiones,
  cleanupExpiredQrs,
  generateDynamicQr,
  getAsistencias,
  getMisAsistencias,
  getMisAsistenciasWeekly,
  getMisAsistenciasWeeklyReport,
  getPendientes,
  justifyAsistencia,
  rejectAsistencia,
  scanQr,
} from './asistencia.service.js';

import {
  registrarActividadEmpleado,
} from '../actividad/actividad.service.js';


// ============================================================
// GENERAR QR
// ============================================================

export async function generateQrController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {

    const qr =
      await generateDynamicQr();


    res.json({
      ok: true,
      ...qr,
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// LIMPIAR QR EXPIRADOS
// ============================================================

export async function cleanupQrController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {

    const deleted =
      await cleanupExpiredQrs();


    res.json({
      ok: true,

      deleted,

      message:
        'QR expirados eliminados correctamente',
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// ESCANEAR QR
// ============================================================

export async function scanController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    const result =
      await scanQr(
        req.auth!.userId,

        String(
          req.body?.token ||
          ''
        ).trim()
      );


    // --------------------------------------------------------
    // ACTIVIDAD NO CRÍTICA
    //
    // La asistencia ya fue confirmada en RDS.
    //
    // Una falla de auditoría/actividad no debe provocar que
    // el cliente piense que la asistencia falló.
    // --------------------------------------------------------

    try {

      await registrarActividadEmpleado({
        usuario_id:
          req.auth!.userId,

        tipo:
          'ESCANEO_QR',

        titulo:
          result.tipo ===
          'entrada'
            ? 'Entrada registrada'
            : 'Salida registrada',

        descripcion:
          result.message ||
          'El usuario registró asistencia mediante código QR.',

        modulo:
          'asistencia',

        origen:
          'mobile',

        metadata: {
          asistencia_id:
            result.id,

          tipo:
            result.tipo,

          fecha:
            result.fecha,
        },
      });

    } catch (activityError) {

      console.error(
        '[ASISTENCIA] No se pudo registrar actividad post-asistencia:',
        activityError
      );
    }


    res
      .status(201)
      .json({
        ok: true,

        id:
          result.id,

        tipo:
          result.tipo,

        fecha:
          result.fecha,

        message:
          result.message,
      });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// MIS ASISTENCIAS
// ============================================================

export async function listMineController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    const asistencias =
      await getMisAsistencias(
        req.auth!.userId
      );


    res.json({
      ok: true,

      asistencias,
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// MI SEMANA
// ============================================================

export async function listMineWeeklyController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    const data =
      await getMisAsistenciasWeekly(
        req.auth!.userId
      );


    res.json({
      ok: true,

      week:
        data.week,

      asistencias:
        data.asistencias,
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// REPORTE SEMANAL
// ============================================================

export async function weeklyReportMineController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    const report =
      await getMisAsistenciasWeeklyReport(
        req.auth!.userId
      );


    res.json({
      ok: true,

      report,
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// TODAS - ADMIN
// ============================================================

export async function listAllController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {

    const asistencias =
      await getAsistencias();


    res.json({
      ok: true,

      asistencias,
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// PENDIENTES - ADMIN
// ============================================================

export async function listPendientesController(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {

    const asistencias =
      await getPendientes();


    res.json({
      ok: true,

      asistencias,
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// APROBAR
// ============================================================

export async function approveController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    await approveAsistencia(
      Number(
        req.params.id
      ),

      req.auth!.userId,

      String(
        req.body?.motivo ??
        ''
      ).trim()
    );


    res.json({
      ok: true,

      message:
        'Asistencia aprobada correctamente',
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// RECHAZAR
// ============================================================

export async function rejectController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    await rejectAsistencia(
      Number(
        req.params.id
      ),

      req.auth!.userId,

      String(
        req.body?.motivo ??
        ''
      ).trim()
    );


    res.json({
      ok: true,

      message:
        'Asistencia rechazada correctamente',
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// CAMBIO3_CONTROLLER_JUSTIFICAR_ASISTENCIA
// JUSTIFICAR ASISTENCIA
// ============================================================

export async function justifyController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    await justifyAsistencia(
      Number(
        req.params.id
      ),

      req.auth!.userId,

      String(
        req.body?.motivo ??
        ''
      ).trim()
    );


    res.json({
      ok: true,

      message:
        'Asistencia justificada correctamente',
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// CAMBIO3_CONTROLLER_CORREGIR_ASISTENCIA
// CORREGIR ASISTENCIA
// ============================================================

export async function correctController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    await correctAsistencia(
      Number(
        req.params.id
      ),

      req.auth!.userId,

      String(
        req.body?.motivo ??
        ''
      ).trim(),

      String(
        req.body?.hora_entrada ??
        ''
      ).trim(),

      String(
        req.body?.hora_salida ??
        ''
      ).trim()
    );


    res.json({
      ok: true,

      message:
        'Asistencia corregida correctamente',
    });

  } catch (e) {

    next(e);
  }
}


// ============================================================
// CAMBIO3_CONTROLLER_HISTORIAL_REVISIONES
// CONSULTAR HISTORIAL ADMINISTRATIVO DE UNA ASISTENCIA
// ============================================================

export async function listRevisionesController(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {

    const historial =
      await getAsistenciaRevisiones(
        Number(
          req.params.id
        )
      );


    res.json({
      ok: true,
      data: historial,
    });

  } catch (e) {

    next(e);
  }
}
