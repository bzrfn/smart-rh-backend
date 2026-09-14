import { pool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

import {
  getBusinessDateTime,
  getBusinessWeekRange,
} from '../../utils/businessTime.js';

import { v4 as uuid } from 'uuid';
import QRCode from 'qrcode';

import {
  QrLogModel,
} from './qr-log.model.js';

import {
  findAsistenciaById,
  listAllAsistencias,
  listMisAsistencias,
  listMisAsistenciasByDateRange,
  listPendientes,
  setAsistenciaEstado,
} from './asistencia.repository.js';

import {
  crearNotificacion,
  crearNotificacionDiaCompleto,
  eliminarNotificacionesAsistenciaUsuario,
} from '../notificaciones/notificaciones.service.js';


type ScanResult = {
  id: number;

  tipo:
    'entrada' |
    'salida';

  message: string;

  fecha: string;
};


// ============================================================
// LOG DE EFECTOS NO CRÍTICOS
// ============================================================

function logNonCriticalError(
  operation: string,
  error: unknown
) {
  console.error(
    `[ASISTENCIA] Falló efecto secundario ${operation}:`,
    error
  );
}


// ============================================================
// QR - LIMPIEZA
// ============================================================

export async function cleanupExpiredQrs() {

  const result =
    await QrLogModel.deleteMany({
      fecha_expiracion: {
        $lt:
          new Date(),
      },
    });


  return Number(
    result.deletedCount ||
    0
  );
}


// ============================================================
// QR - GENERACIÓN
// ============================================================

export async function generateDynamicQr() {

  const token =
    `QR-${uuid()}`;


  const gen =
    new Date();


  const exp =
    new Date(
      Date.now() +
      env.qr.ttlMinutes *
        60_000
    );


  await QrLogModel.create({
    token,

    fecha_generacion:
      gen,

    fecha_expiracion:
      exp,

    usos: [],
  });


  const dataUrl =
    await QRCode.toDataURL(
      token
    );


  return {
    token,

    expiresAt:
      exp.toISOString(),

    dataUrl,
  };
}


// ============================================================
// QR - REGISTRAR USO EN MONGODB
//
// Esta operación es de auditoría.
//
// La asistencia crítica vive en RDS. Si Mongo falla después
// del COMMIT SQL, no debemos reportar al empleado que su
// asistencia falló.
// ============================================================

async function registerQrUsage(
  qrId: unknown,
  usuarioId: number
) {
  try {

    await QrLogModel.updateOne(
      {
        _id:
          qrId,

        'usos.usuario_id': {
          $ne:
            usuarioId,
        },
      },
      {
        $push: {
          usos: {
            usuario_id:
              usuarioId,

            fecha_uso:
              new Date(),
          },
        },
      }
    );

  } catch (error) {

    logNonCriticalError(
      'REGISTRAR_USO_QR',
      error
    );
  }
}


// ============================================================
// NOTIFICACIONES POST-ASISTENCIA
//
// Son efectos secundarios.
//
// Nunca deben convertir un COMMIT SQL exitoso en un error
// visible para el empleado.
// ============================================================

async function processAttendanceNotifications(
  usuarioId: number,
  result: ScanResult
) {

  try {

    await eliminarNotificacionesAsistenciaUsuario(
      usuarioId
    );

  } catch (error) {

    logNonCriticalError(
      'LIMPIAR_NOTIFICACIONES',
      error
    );
  }


  if (
    result.tipo ===
    'entrada'
  ) {

    try {

      await crearNotificacion({
        usuario_id:
          usuarioId,

        tipo:
          'RECORDATORIO_SALIDA',

        titulo:
          'Registrar salida',

        mensaje:
          'Entrada registrada correctamente. Recuerda registrar tu salida al finalizar tu jornada.',

        metadata: {
          origen:
            'scan',

          asistencia_id:
            result.id,

          fecha:
            result.fecha,
        },
      });

    } catch (error) {

      logNonCriticalError(
        'CREAR_RECORDATORIO_SALIDA',
        error
      );
    }
  }


  if (
    result.tipo ===
    'salida'
  ) {

    try {

      await crearNotificacionDiaCompleto({
        usuario_id:
          usuarioId,

        asistencia_id:
          result.id,
      });

    } catch (error) {

      logNonCriticalError(
        'CREAR_NOTIFICACION_DIA_COMPLETO',
        error
      );
    }
  }
}


// ============================================================
// QR - ESCANEO
// ============================================================

export async function scanQr(
  usuario_id: number,
  token: string
): Promise<ScanResult> {

  if (
    !usuario_id ||
    usuario_id <= 0
  ) {
    throw new AppError(
      'Usuario inválido',
      400
    );
  }


  if (!token) {
    throw new AppError(
      'Token QR requerido',
      400
    );
  }


  // ----------------------------------------------------------
  // VALIDAR QR
  //
  // El QR ya NO se invalida globalmente después del primer
  // empleado.
  //
  // Distintos empleados pueden utilizarlo mientras siga
  // vigente.
  // ----------------------------------------------------------

  const qr =
    await QrLogModel.findOne({
      token,
    });


  if (!qr) {
    throw new AppError(
      'Token inválido',
      400
    );
  }


  if (
    new Date(
      qr.fecha_expiracion
    ).getTime() <
    Date.now()
  ) {
    throw new AppError(
      'Token expirado',
      410
    );
  }


  // ----------------------------------------------------------
  // FECHA / HORA DE NEGOCIO
  //
  // No dependemos de:
  //
  // - zona horaria EC2
  // - zona horaria RDS
  //
  // Ambas pueden permanecer en UTC.
  // ----------------------------------------------------------

  const businessNow =
    getBusinessDateTime();


  const fecha =
    businessNow.date;


  const hora =
    businessNow.time;


  const connection =
    await pool.getConnection();


  let result:
    ScanResult;


  try {

    await connection
      .beginTransaction();


    // --------------------------------------------------------
    // BLOQUEO DEL REGISTRO DE HOY
    //
    // uq_asistencias_usuario_fecha protege también desde RDS
    // contra dobles registros.
    // --------------------------------------------------------

    const [
      asistenciaRows,
    ] =
      await connection.query(
        `
          SELECT *
          FROM asistencias
          WHERE usuario_id = ?
            AND fecha = ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          usuario_id,
          fecha,
        ]
      );


    const asistenciaHoy =
      (
        asistenciaRows as any[]
      )[0] ||
      null;


    // --------------------------------------------------------
    // ENTRADA
    // --------------------------------------------------------

    if (!asistenciaHoy) {

      const [
        insertResult,
      ] =
        await connection.query(
          `
            INSERT INTO asistencias (
              usuario_id,
              fecha,
              hora_entrada,
              hora_salida,
              estado,
              qr_token
            )
            VALUES (
              ?,
              ?,
              ?,
              NULL,
              'pendiente',
              ?
            )
          `,
          [
            usuario_id,
            fecha,
            hora,
            token,
          ]
        );


      result = {
        id:
          Number(
            (
              insertResult as any
            ).insertId
          ),

        tipo:
          'entrada',

        message:
          'Entrada registrada correctamente',

        fecha,
      };

    } else {

      // ------------------------------------------------------
      // DÍA COMPLETO
      // ------------------------------------------------------

      if (
        asistenciaHoy
          .hora_salida
      ) {
        throw new AppError(
          'Ya registraste tu entrada y salida el día de hoy',
          409
        );
      }


      // ------------------------------------------------------
      // MISMO EMPLEADO + MISMO QR
      //
      // Un mismo QR sí puede ser usado por otros empleados,
      // pero no debe convertir inmediatamente la entrada de
      // este empleado en una salida.
      // ------------------------------------------------------

      if (
        String(
          asistenciaHoy
            .qr_token ||
          ''
        ) === token
      ) {
        throw new AppError(
          'Este código QR ya fue utilizado por este usuario',
          409
        );
      }


      // ------------------------------------------------------
      // SALIDA CON QR NUEVO
      // ------------------------------------------------------

      await connection.query(
        `
          UPDATE asistencias
          SET
            hora_salida = ?,
            qr_token = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND hora_salida IS NULL
        `,
        [
          hora,
          token,
          asistenciaHoy.id,
        ]
      );


      result = {
        id:
          Number(
            asistenciaHoy.id
          ),

        tipo:
          'salida',

        message:
          'Salida registrada correctamente',

        fecha,
      };
    }


    await connection.commit();

  } catch (error: any) {

    await connection
      .rollback();


    // --------------------------------------------------------
    // CARRERA ENTRE DOS PRIMEROS ESCANEOS
    //
    // RDS tiene:
    //
    // UNIQUE(usuario_id, fecha)
    //
    // Si dos solicitudes intentan crear la entrada al mismo
    // tiempo, la base es la última barrera.
    // --------------------------------------------------------

    if (
      error?.code ===
      'ER_DUP_ENTRY'
    ) {
      throw new AppError(
        'Ya existe un registro de asistencia para este usuario el día de hoy',
        409
      );
    }


    throw error;

  } finally {

    connection.release();
  }


  // ----------------------------------------------------------
  // TODO LO QUE SIGUE ES POST-COMMIT
  // ----------------------------------------------------------

  await registerQrUsage(
    qr._id,
    usuario_id
  );


  await processAttendanceNotifications(
    usuario_id,
    result
  );


  return result;
}


// ============================================================
// CONSULTAS
// ============================================================

export const getMisAsistencias =
  (
    userId: number
  ) =>
    listMisAsistencias(
      userId
    );


export const getAsistencias =
  () =>
    listAllAsistencias();


export const getPendientes =
  () =>
    listPendientes();


// ============================================================
// ASISTENCIA SEMANAL
// ============================================================

export async function getMisAsistenciasWeekly(
  userId: number
) {

  if (
    !userId ||
    userId <= 0
  ) {
    throw new AppError(
      'Usuario inválido',
      400
    );
  }


  const week =
    getBusinessWeekRange();


  const asistencias =
    await listMisAsistenciasByDateRange(
      userId,
      week.start,
      week.end
    );


  return {
    week,
    asistencias,
  };
}


// ============================================================
// REPORTE SEMANAL
// ============================================================

export async function getMisAsistenciasWeeklyReport(
  userId: number
) {

  if (
    !userId ||
    userId <= 0
  ) {
    throw new AppError(
      'Usuario inválido',
      400
    );
  }


  const week =
    getBusinessWeekRange();


  const asistencias =
    await listMisAsistenciasByDateRange(
      userId,
      week.start,
      week.end
    );


  const pendientes =
    asistencias.filter(
      (a) =>
        a.estado ===
        'pendiente'
    ).length;


  const aprobadas =
    asistencias.filter(
      (a) =>
        a.estado ===
        'aprobada'
    ).length;


  const rechazadas =
    asistencias.filter(
      (a) =>
        a.estado ===
        'rechazada'
    ).length;


  const diasUnicos =
    new Set(
      asistencias.map(
        (a) =>
          String(
            a.fecha
          )
            .slice(
              0,
              10
            )
      )
    );


  return {
    week,

    summary: {
      total:
        asistencias.length,

      pendientes,

      aprobadas,

      rechazadas,

      dias_con_asistencia:
        diasUnicos.size,
    },

    dias:
      asistencias.map(
        (a) => ({
          id:
            a.id,

          fecha:
            String(
              a.fecha
            )
              .slice(
                0,
                10
              ),

          hora_entrada:
            a.hora_entrada,

          hora_salida:
            a.hora_salida,

          estado:
            a.estado,
        })
      ),
  };
}


// ============================================================
// APROBAR
// ============================================================

export async function approveAsistencia(
  id: number
) {

  if (
    !id ||
    id <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  const asistencia =
    await findAsistenciaById(
      id
    );


  if (!asistencia) {
    throw new AppError(
      'Asistencia no encontrada',
      404
    );
  }


  if (
    asistencia.estado !==
    'pendiente'
  ) {
    throw new AppError(
      'Solo se pueden aprobar asistencias pendientes',
      409
    );
  }


  await setAsistenciaEstado(
    id,
    'aprobada'
  );
}


// ============================================================
// RECHAZAR
// ============================================================

export async function rejectAsistencia(
  id: number
) {

  if (
    !id ||
    id <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  const asistencia =
    await findAsistenciaById(
      id
    );


  if (!asistencia) {
    throw new AppError(
      'Asistencia no encontrada',
      404
    );
  }


  if (
    asistencia.estado !==
    'pendiente'
  ) {
    throw new AppError(
      'Solo se pueden rechazar asistencias pendientes',
      409
    );
  }


  await setAsistenciaEstado(
    id,
    'rechazada'
  );
}
