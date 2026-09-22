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
  listAsistenciaRevisiones,
  listMisAsistencias,
  listMisAsistenciasByDateRange,
  listPendientes,
} from './asistencia.repository.js';

import {
  obtenerPoliticaAsistencia,
} from './asistencia.policy.js';

import {
  evaluarDuracionAsistencia,
} from './asistencia.validation.js';

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

function normalizeSqlDate(
  value: unknown
): string {

  if (value instanceof Date) {
    return value
      .toISOString()
      .slice(0, 10);
  }


  const text =
    String(
      value ?? ''
    ).trim();


  const directMatch =
    text.match(
      /^(\d{4}-\d{2}-\d{2})/
    );


  if (directMatch) {
    return directMatch[1];
  }


  const parsed =
    new Date(text);


  if (
    !Number.isNaN(
      parsed.getTime()
    )
  ) {
    return parsed
      .toISOString()
      .slice(0, 10);
  }


  return text.slice(
    0,
    10
  );
}


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


  // ==========================================================
  // VALIDEZ
  //
  // El QR solamente puede utilizarse durante 10 segundos.
  // ==========================================================

  const validUntil =
    new Date(
      gen.getTime() +
      env.qr.validitySeconds *
        1000
    );


  // ==========================================================
  // RETENCIÓN
  //
  // El registro se conserva temporalmente para auditoría.
  //
  // Después de 3 minutos MongoDB lo elimina automáticamente
  // mediante el índice TTL de fecha_expiracion.
  // ==========================================================

  const deleteAt =
    new Date(
      gen.getTime() +
      env.qr.retentionMinutes *
        60_000
    );


  await QrLogModel.create({
    token,

    fecha_generacion:
      gen,

    valido_hasta:
      validUntil,

    fecha_expiracion:
      deleteAt,

    usos: [],
  });


  const dataUrl =
    await QRCode.toDataURL(
      token
    );


  return {
    token,

    // Tiempo real durante el cual puede escanearse.
    expiresAt:
      validUntil.toISOString(),

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
  result: ScanResult,
  estadoAsistencia:
    'pendiente' |
    'INVALIDA_PENDIENTE_REVISION'
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
      'salida' &&
    estadoAsistencia !==
      'INVALIDA_PENDIENTE_REVISION'
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
      qr.valido_hasta
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

  let estadoAsistenciaResultado:
    'pendiente' |
    'INVALIDA_PENDIENTE_REVISION' =
      'pendiente';


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

      const {
        duracionMinimaMinutos,
      } =
        await obtenerPoliticaAsistencia(
          connection
        );


      const evaluacionDuracion =
        evaluarDuracionAsistencia({
          horaEntrada:
            String(
              asistenciaHoy
                .hora_entrada ??
              ''
            ),

          horaSalida:
            hora,

          duracionMinimaMinutos,
        });


      estadoAsistenciaResultado =
        evaluacionDuracion
          .estadoSalida;


      await connection.query(
        `
          UPDATE asistencias
          SET
            hora_salida = ?,
            qr_token = ?,
            estado = ?,
            duracion_minima_aplicada_minutos = ?,
            duracion_registrada_segundos = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
            AND hora_salida IS NULL
        `,
        [
          hora,
          token,
          evaluacionDuracion
            .estadoSalida,
          duracionMinimaMinutos,
          evaluacionDuracion
            .duracionSegundos,
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
    result,
    estadoAsistenciaResultado
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

  const pendientesRevision =
    asistencias.filter(
      (a) =>
        a.estado ===
        'INVALIDA_PENDIENTE_REVISION'
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


      pendientes_revision:
        pendientesRevision,
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
            normalizeSqlDate(
              a.fecha
            ),

          hora_entrada:
            a.hora_entrada,

          hora_salida:
            a.hora_salida,

          estado:
            a.estado,

          ...(Object.prototype.hasOwnProperty.call(
            a,
            'duracion_minima_aplicada_minutos'
          )
            ? {
                duracion_minima_aplicada_minutos:
                  a.duracion_minima_aplicada_minutos,
              }
            : {}),

          ...(Object.prototype.hasOwnProperty.call(
            a,
            'duracion_registrada_segundos'
          )
            ? {
                duracion_registrada_segundos:
                  a.duracion_registrada_segundos,
              }
            : {}),
        })
      ),
  };
}


// ============================================================
// APROBAR
// ============================================================

export async function approveAsistencia(
  id: number,
  adminUsuarioId?: number,
  motivo?: string
) {

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  if (
    !Number.isInteger(
      adminUsuarioId
    ) ||
    Number(
      adminUsuarioId
    ) <= 0
  ) {
    throw new AppError(
      'Administrador requerido para registrar la revisión',
      400
    );
  }


  const motivoNormalizado =
    String(
      motivo ?? ''
    ).trim();


  const connection =
    await pool.getConnection();


  try {

    await connection
      .beginTransaction();


    const [
      rows,
    ] =
      await connection.query(
        `
          SELECT
            id,
            usuario_id,
            fecha,
            hora_entrada,
            hora_salida,
            estado
          FROM asistencias
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          id,
        ]
      );


    const asistencia =
      (
        rows as any[]
      )[0] ||
      null;


    if (!asistencia) {
      throw new AppError(
        'Asistencia no encontrada',
        404
      );
    }


    const estadoAnterior =
      String(
        asistencia.estado ??
        ''
      );


    if (
      estadoAnterior !==
        'pendiente' &&
      estadoAnterior !==
        'INVALIDA_PENDIENTE_REVISION'
    ) {
      throw new AppError(
        'Solo se pueden aprobar asistencias pendientes o pendientes de revisión',
        409
      );
    }


    if (
      estadoAnterior ===
        'INVALIDA_PENDIENTE_REVISION' &&
      !motivoNormalizado
    ) {
      throw new AppError(
        'Motivo requerido para revisar una asistencia inválida',
        400
      );
    }


    const [
      updateResult,
    ] =
      await connection.query(
        `
          UPDATE asistencias
          SET
            estado = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          'aprobada',
          id,
        ]
      );


    if (
      Number(
        (
          updateResult as any
        ).affectedRows ||
        0
      ) !== 1
    ) {
      throw new AppError(
        'No se pudo actualizar la asistencia',
        409
      );
    }


    await connection.query(
      `
        INSERT INTO asistencia_revisiones (
          asistencia_id,
          admin_usuario_id,
          accion,
          motivo,
          estado_anterior,
          estado_nuevo,
          hora_entrada_anterior,
          hora_salida_anterior,
          hora_entrada_nueva,
          hora_salida_nueva
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        id,
        Number(
          adminUsuarioId
        ),
        'APROBAR',
        motivoNormalizado ||
          null,
        estadoAnterior,
        'aprobada',
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
      ]
    );


    await connection
      .commit();

  } catch (error) {

    await connection
      .rollback();

    throw error;

  } finally {

    connection
      .release();
  }
}

// ============================================================
// RECHAZAR
// ============================================================

export async function rejectAsistencia(
  id: number,
  adminUsuarioId?: number,
  motivo?: string
) {

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  if (
    !Number.isInteger(
      adminUsuarioId
    ) ||
    Number(
      adminUsuarioId
    ) <= 0
  ) {
    throw new AppError(
      'Administrador requerido para registrar la revisión',
      400
    );
  }


  const motivoNormalizado =
    String(
      motivo ?? ''
    ).trim();


  const connection =
    await pool.getConnection();


  try {

    await connection
      .beginTransaction();


    const [
      rows,
    ] =
      await connection.query(
        `
          SELECT
            id,
            usuario_id,
            fecha,
            hora_entrada,
            hora_salida,
            estado
          FROM asistencias
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          id,
        ]
      );


    const asistencia =
      (
        rows as any[]
      )[0] ||
      null;


    if (!asistencia) {
      throw new AppError(
        'Asistencia no encontrada',
        404
      );
    }


    const estadoAnterior =
      String(
        asistencia.estado ??
        ''
      );


    if (
      estadoAnterior !==
        'pendiente' &&
      estadoAnterior !==
        'INVALIDA_PENDIENTE_REVISION'
    ) {
      throw new AppError(
        'Solo se pueden rechazar asistencias pendientes o pendientes de revisión',
        409
      );
    }


    if (
      estadoAnterior ===
        'INVALIDA_PENDIENTE_REVISION' &&
      !motivoNormalizado
    ) {
      throw new AppError(
        'Motivo requerido para revisar una asistencia inválida',
        400
      );
    }


    const [
      updateResult,
    ] =
      await connection.query(
        `
          UPDATE asistencias
          SET
            estado = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          'rechazada',
          id,
        ]
      );


    if (
      Number(
        (
          updateResult as any
        ).affectedRows ||
        0
      ) !== 1
    ) {
      throw new AppError(
        'No se pudo actualizar la asistencia',
        409
      );
    }


    await connection.query(
      `
        INSERT INTO asistencia_revisiones (
          asistencia_id,
          admin_usuario_id,
          accion,
          motivo,
          estado_anterior,
          estado_nuevo,
          hora_entrada_anterior,
          hora_salida_anterior,
          hora_entrada_nueva,
          hora_salida_nueva
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        id,
        Number(
          adminUsuarioId
        ),
        'RECHAZAR',
        motivoNormalizado ||
          null,
        estadoAnterior,
        'rechazada',
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
      ]
    );


    await connection
      .commit();

  } catch (error) {

    await connection
      .rollback();

    throw error;

  } finally {

    connection
      .release();
  }
}


// ============================================================
// CAMBIO3_SERVICE_JUSTIFICAR_ASISTENCIA
// JUSTIFICAR
// ============================================================

export async function justifyAsistencia(
  id: number,
  adminUsuarioId?: number,
  motivo?: string
) {

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  if (
    !Number.isInteger(
      adminUsuarioId
    ) ||
    Number(
      adminUsuarioId
    ) <= 0
  ) {
    throw new AppError(
      'Administrador requerido para registrar la revisión',
      400
    );
  }


  const motivoNormalizado =
    String(
      motivo ?? ''
    ).trim();


  if (!motivoNormalizado) {
    throw new AppError(
      'Motivo requerido para justificar una asistencia inválida',
      400
    );
  }


  const connection =
    await pool.getConnection();


  try {

    await connection
      .beginTransaction();


    const [
      rows,
    ] =
      await connection.query(
        `
          SELECT
            id,
            usuario_id,
            fecha,
            hora_entrada,
            hora_salida,
            estado
          FROM asistencias
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          id,
        ]
      );


    const asistencia =
      (
        rows as any[]
      )[0] ||
      null;


    if (!asistencia) {
      throw new AppError(
        'Asistencia no encontrada',
        404
      );
    }


    const estadoAnterior =
      String(
        asistencia.estado ??
        ''
      );


    if (
      estadoAnterior !==
        'INVALIDA_PENDIENTE_REVISION'
    ) {
      throw new AppError(
        'Solo se pueden justificar asistencias pendientes de revisión',
        409
      );
    }


    const [
      updateResult,
    ] =
      await connection.query(
        `
          UPDATE asistencias
          SET
            estado = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          'aprobada',
          id,
        ]
      );


    if (
      Number(
        (
          updateResult as any
        ).affectedRows ||
        0
      ) !== 1
    ) {
      throw new AppError(
        'No se pudo actualizar la asistencia',
        409
      );
    }


    await connection.query(
      `
        INSERT INTO asistencia_revisiones (
          asistencia_id,
          admin_usuario_id,
          accion,
          motivo,
          estado_anterior,
          estado_nuevo,
          hora_entrada_anterior,
          hora_salida_anterior,
          hora_entrada_nueva,
          hora_salida_nueva
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        id,
        Number(
          adminUsuarioId
        ),
        'JUSTIFICAR',
        motivoNormalizado,
        estadoAnterior,
        'aprobada',
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
      ]
    );


    await connection
      .commit();

  } catch (error) {

    await connection
      .rollback();

    throw error;

  } finally {

    connection
      .release();
  }
}


// ============================================================
// CAMBIO3_SERVICE_CORREGIR_ASISTENCIA
// CORREGIR
// ============================================================

export async function correctAsistencia(
  id: number,
  adminUsuarioId: number | undefined,
  motivo: string | undefined,
  horaEntradaNueva: string,
  horaSalidaNueva: string
) {

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  if (
    !Number.isInteger(
      adminUsuarioId
    ) ||
    Number(
      adminUsuarioId
    ) <= 0
  ) {
    throw new AppError(
      'Administrador requerido para registrar la revisión',
      400
    );
  }


  const motivoNormalizado =
    String(
      motivo ?? ''
    ).trim();


  if (!motivoNormalizado) {
    throw new AppError(
      'Motivo requerido para corregir una asistencia inválida',
      400
    );
  }


  const horaEntradaNormalizada =
    String(
      horaEntradaNueva ?? ''
    ).trim();


  const horaSalidaNormalizada =
    String(
      horaSalidaNueva ?? ''
    ).trim();


  if (
    !horaEntradaNormalizada ||
    !horaSalidaNormalizada
  ) {
    throw new AppError(
      'Hora de entrada y hora de salida son requeridas para corregir la asistencia',
      400
    );
  }


  const connection =
    await pool.getConnection();


  try {

    await connection
      .beginTransaction();


    const [
      rows,
    ] =
      await connection.query(
        `
          SELECT
            id,
            usuario_id,
            fecha,
            hora_entrada,
            hora_salida,
            estado,
            duracion_minima_aplicada_minutos,
            duracion_registrada_segundos
          FROM asistencias
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [
          id,
        ]
      );


    const asistencia =
      (
        rows as any[]
      )[0] ||
      null;


    if (!asistencia) {
      throw new AppError(
        'Asistencia no encontrada',
        404
      );
    }


    const estadoAnterior =
      String(
        asistencia.estado ??
        ''
      );


    if (
      estadoAnterior !==
        'INVALIDA_PENDIENTE_REVISION'
    ) {
      throw new AppError(
        'Solo se pueden corregir asistencias pendientes de revisión',
        409
      );
    }


    const duracionMinimaAplicada =
      Number(
        asistencia
          .duracion_minima_aplicada_minutos
      );


    if (
      !Number.isFinite(
        duracionMinimaAplicada
      ) ||
      duracionMinimaAplicada <= 0
    ) {
      throw new AppError(
        'La asistencia no tiene una política de duración válida aplicada',
        409
      );
    }


    let evaluacionDuracion;

    try {

      evaluacionDuracion =
        evaluarDuracionAsistencia({
          horaEntrada:
            horaEntradaNormalizada,

          horaSalida:
            horaSalidaNormalizada,

          duracionMinimaMinutos:
            duracionMinimaAplicada,
        });

    } catch {

      throw new AppError(
        'Las horas corregidas no son válidas',
        400
      );
    }


    const [
      updateResult,
    ] =
      await connection.query(
        `
          UPDATE asistencias
          SET
            hora_entrada = ?,
            hora_salida = ?,
            estado = ?,
            duracion_minima_aplicada_minutos = ?,
            duracion_registrada_segundos = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [
          horaEntradaNormalizada,
          horaSalidaNormalizada,
          evaluacionDuracion.estadoSalida,
          duracionMinimaAplicada,
          evaluacionDuracion.duracionSegundos,
          id,
        ]
      );


    if (
      Number(
        (
          updateResult as any
        ).affectedRows ||
        0
      ) !== 1
    ) {
      throw new AppError(
        'No se pudo actualizar la asistencia',
        409
      );
    }


    await connection.query(
      `
        INSERT INTO asistencia_revisiones (
          asistencia_id,
          admin_usuario_id,
          accion,
          motivo,
          estado_anterior,
          estado_nuevo,
          hora_entrada_anterior,
          hora_salida_anterior,
          hora_entrada_nueva,
          hora_salida_nueva
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `,
      [
        id,
        Number(
          adminUsuarioId
        ),
        'CORREGIR',
        motivoNormalizado,
        estadoAnterior,
        evaluacionDuracion.estadoSalida,
        asistencia
          .hora_entrada ??
          null,
        asistencia
          .hora_salida ??
          null,
        horaEntradaNormalizada,
        horaSalidaNormalizada,
      ]
    );


    await connection
      .commit();

  } catch (error) {

    await connection
      .rollback();

    throw error;

  } finally {

    connection
      .release();
  }
}


// ============================================================
// CAMBIO3_SERVICE_HISTORIAL_REVISIONES
// CONSULTAR HISTORIAL DURABLE DE UNA ASISTENCIA
// ============================================================

export async function getAsistenciaRevisiones(
  asistenciaId: number
) {

  if (
    !Number.isInteger(
      asistenciaId
    ) ||
    asistenciaId <= 0
  ) {
    throw new AppError(
      'ID de asistencia inválido',
      400
    );
  }


  const asistencia =
    await findAsistenciaById(
      asistenciaId
    );


  if (!asistencia) {
    throw new AppError(
      'Asistencia no encontrada',
      404
    );
  }


  return listAsistenciaRevisiones(
    asistenciaId
  );
}
