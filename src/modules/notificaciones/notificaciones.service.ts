import mongoose from 'mongoose';
import { pool } from '../../config/db.js';
import { NotificacionModel } from './notificaciones.model.js';

const TTL_DAYS = 30;

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

function getExpirationDate(ttlDays = TTL_DAYS) {
  return new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
}

async function getMysqlDateContext() {
  const [rows] = await pool.query(
    `SELECT 
       DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS fecha,
       HOUR(CURTIME()) AS hora`
  );

  const row = (rows as any[])[0];

  return {
    fecha: row?.fecha ?? new Date().toISOString().slice(0, 10),
    hora: Number(row?.hora ?? new Date().getHours()),
  };
}

function getEntradaMessage(hora: number) {
  if (hora < 12) {
    return {
      titulo: 'Recordatorio de entrada',
      mensaje: 'Buen día. Recuerda registrar tu entrada para comenzar tu jornada laboral.',
    };
  }

  if (hora < 18) {
    return {
      titulo: 'Registrar entrada',
      mensaje: 'Recuerda registrar tu entrada para mantener actualizado tu control de asistencia.',
    };
  }

  return {
    titulo: 'Entrada pendiente',
    mensaje:
      'Aún no tienes entrada registrada. Registra tu asistencia para mantener tu jornada actualizada.',
  };
}

function getSalidaMessage(hora: number) {
  if (hora >= 18) {
    return {
      titulo: 'Recordatorio de salida',
      mensaje: 'Tu jornada está por concluir. No olvides registrar tu salida antes de retirarte.',
    };
  }

  if (hora >= 14) {
    return {
      titulo: 'Salida pendiente',
      mensaje:
        'Ya registraste tu entrada. Recuerda registrar tu salida al finalizar tu jornada laboral.',
    };
  }

  return {
    titulo: 'Registro de salida',
    mensaje:
      'Entrada registrada correctamente. Recuerda registrar tu salida cuando finalice tu jornada.',
  };
}

function getDiaCompletoMessage(hora: number) {
  if (hora >= 18) {
    return {
      titulo: 'Día completado',
      mensaje:
        'Has completado tu jornada laboral correctamente. Descansa y nos vemos mañana.',
    };
  }

  return {
    titulo: 'Jornada completa',
    mensaje:
      'Entrada y salida registradas correctamente. Tu jornada quedó completa.',
  };
}

export async function crearNotificacion(data: {
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  metadata?: Record<string, any>;
  ttlDays?: number;
  reemplazarPendienteMismoTipo?: boolean;
}) {
  try {
    if (!isMongoConnected()) return null;

    const reemplazarPendienteMismoTipo =
      data.reemplazarPendienteMismoTipo ?? true;

    if (reemplazarPendienteMismoTipo) {
      await NotificacionModel.deleteMany({
        usuario_id: data.usuario_id,
        tipo: data.tipo,
        leida: false,
      });
    }

    const notificacion = await NotificacionModel.create({
      usuario_id: data.usuario_id,
      tipo: data.tipo,
      titulo: data.titulo,
      mensaje: data.mensaje,
      leida: false,
      metadata: data.metadata ?? {},
      expiresAt: getExpirationDate(data.ttlDays ?? TTL_DAYS),
    });

    return notificacion;
  } catch (error) {
    console.error('[MONGO] Error creando notificación:', error);
    return null;
  }
}

export async function crearNotificacionSoporte(data: {
  usuario_id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  ticket_id: string;
  estado?: string;
  categoria?: string;
  prioridad?: string;
  respuesta_admin?: string;
  admin_id?: number;
}) {
  return crearNotificacion({
    usuario_id: data.usuario_id,
    tipo: data.tipo,
    titulo: data.titulo,
    mensaje: data.mensaje,
    ttlDays: 30,
    reemplazarPendienteMismoTipo: false,
    metadata: {
      origen: 'soporte',
      ticket_id: data.ticket_id,
      estado: data.estado,
      categoria: data.categoria,
      prioridad: data.prioridad,
      respuesta_admin: data.respuesta_admin,
      admin_id: data.admin_id,
    },
  });
}

export async function eliminarNotificacionesAsistenciaUsuario(usuario_id: number) {
  try {
    if (!isMongoConnected()) return null;

    return await NotificacionModel.deleteMany({
      usuario_id,
      tipo: {
        $in: ['RECORDATORIO_ENTRADA', 'RECORDATORIO_SALIDA'],
      },
      leida: false,
    });
  } catch (error) {
    console.error('[MONGO] Error eliminando notificaciones de asistencia:', error);
    return null;
  }
}

export async function crearNotificacionDiaCompleto(data: {
  usuario_id: number;
  asistencia_id?: number;
}) {
  try {
    if (!isMongoConnected()) return null;

    await eliminarNotificacionesAsistenciaUsuario(data.usuario_id);

    const { fecha, hora } = await getMysqlDateContext();
    const mensaje = getDiaCompletoMessage(hora);

    return await crearNotificacion({
      usuario_id: data.usuario_id,
      tipo: 'DIA_COMPLETO',
      titulo: mensaje.titulo,
      mensaje: mensaje.mensaje,
      metadata: {
        origen: 'scan',
        asistencia_id: data.asistencia_id,
        fecha,
      },
    });
  } catch (error) {
    console.error('[MONGO] Error creando notificación de día completo:', error);
    return null;
  }
}

export async function generarRecordatorioAsistenciaLogin(usuario_id: number) {
  try {
    if (!isMongoConnected()) return;

    await eliminarNotificacionesAsistenciaUsuario(usuario_id);

    const { fecha, hora } = await getMysqlDateContext();

    const [rows] = await pool.query(
      `SELECT 
         id, 
         hora_entrada, 
         hora_salida, 
         estado
       FROM asistencias
       WHERE usuario_id = ?
         AND DATE(fecha) = CURDATE()
       ORDER BY id DESC
       LIMIT 1`,
      [usuario_id]
    );

    const asistencia = (rows as any[])[0];

    if (!asistencia || !asistencia.hora_entrada) {
      const mensaje = getEntradaMessage(hora);

      await crearNotificacion({
        usuario_id,
        tipo: 'RECORDATORIO_ENTRADA',
        titulo: mensaje.titulo,
        mensaje: mensaje.mensaje,
        metadata: {
          origen: 'login',
          fecha,
        },
      });

      return;
    }

    if (asistencia.hora_entrada && !asistencia.hora_salida) {
      const mensaje = getSalidaMessage(hora);

      await crearNotificacion({
        usuario_id,
        tipo: 'RECORDATORIO_SALIDA',
        titulo: mensaje.titulo,
        mensaje: mensaje.mensaje,
        metadata: {
          origen: 'login',
          asistencia_id: asistencia.id,
          hora_entrada: asistencia.hora_entrada,
          fecha,
        },
      });

      return;
    }

    if (asistencia.hora_entrada && asistencia.hora_salida) {
      const mensaje = getDiaCompletoMessage(hora);

      await crearNotificacion({
        usuario_id,
        tipo: 'DIA_COMPLETO',
        titulo: mensaje.titulo,
        mensaje: mensaje.mensaje,
        metadata: {
          origen: 'login',
          asistencia_id: asistencia.id,
          hora_entrada: asistencia.hora_entrada,
          hora_salida: asistencia.hora_salida,
          fecha,
        },
      });
    }
  } catch (error) {
    console.error('[MONGO] Error generando recordatorio de asistencia:', error);
  }
}

export async function obtenerNotificacionesUsuario(
  usuario_id: number,
  incluirLeidas = true
) {
  try {
    if (!isMongoConnected()) return [];

    const query: any = { usuario_id };

    if (!incluirLeidas) {
      query.leida = false;
    }

    return await NotificacionModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
  } catch (error) {
    console.error('[MONGO] Error obteniendo notificaciones:', error);
    return [];
  }
}

export async function listarNotificacionesUsuario(usuario_id: number) {
  return obtenerNotificacionesUsuario(usuario_id, true);
}

export async function marcarNotificacionLeida(id: string, usuario_id: number) {
  try {
    if (!isMongoConnected()) return null;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return null;
    }

    return await NotificacionModel.updateOne(
      {
        _id: id,
        usuario_id,
      },
      {
        $set: {
          leida: true,
        },
      }
    );
  } catch (error) {
    console.error('[MONGO] Error marcando notificación como leída:', error);
    return null;
  }
}