import { pool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { v4 as uuid } from 'uuid';
import QRCode from 'qrcode';
import { QrLogModel } from './qr-log.model.js';
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

type WeeklyRange = {
  start: string;
  end: string;
};

type ScanResult = {
  id: number;
  tipo: 'entrada' | 'salida';
  message: string;
  fecha: string;
};

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentWeekRange(): WeeklyRange {
  const now = new Date();
  const currentDay = now.getDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;

  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: toDateOnly(monday),
    end: toDateOnly(sunday),
  };
}

export async function cleanupExpiredQrs() {
  const result = await QrLogModel.deleteMany({
    fecha_expiracion: {
      $lt: new Date(Date.now() - 2 * 60 * 1000),
    },
  });

  return {
    deleted: result.deletedCount,
  };
}

export async function generateDynamicQr() {
  const token = `QR-${uuid()}`;
  const gen = new Date();
  const exp = new Date(Date.now() + env.qr.ttlMinutes * 60_000);

  await QrLogModel.create({
    token,
    fecha_generacion: gen,
    fecha_expiracion: exp,
    usado: false,
  });

  const dataUrl = await QRCode.toDataURL(token);

  return {
    token,
    expiresAt: exp.toISOString(),
    dataUrl,
  };
}

export async function scanQr(usuario_id: number, token: string): Promise<ScanResult> {
  if (!usuario_id || usuario_id <= 0) {
    throw new AppError('Usuario inválido', 400);
  }

  if (!token) {
    throw new AppError('Token QR requerido', 400);
  }

  const qr = await QrLogModel.findOne({ token });

  if (!qr) {
    throw new AppError('Token inválido', 400);
  }

  if (qr.usado) {
    throw new AppError('Token ya fue usado', 409);
  }

  if (new Date(qr.fecha_expiracion).getTime() < Date.now()) {
    throw new AppError('Token expirado', 410);
  }

  const connection = await pool.getConnection();
  let result: ScanResult;

  try {
    await connection.beginTransaction();

    const [dateRows] = await connection.query(
      `SELECT 
         DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS fecha,
         TIME_FORMAT(CURTIME(), '%H:%i:%s') AS hora`
    );

    const dateData = (dateRows as any[])[0];
    const fecha = dateData.fecha;
    const hora = dateData.hora;

    const [asistenciaRows] = await connection.query(
      `
        SELECT *
        FROM asistencias
        WHERE usuario_id = ?
          AND DATE(fecha) = CURDATE()
        LIMIT 1
        FOR UPDATE
      `,
      [usuario_id]
    );

    const asistenciaHoy = (asistenciaRows as any[])[0] || null;

    if (!asistenciaHoy) {
      const [insertResult] = await connection.query(
        `
          INSERT INTO asistencias (
            usuario_id,
            fecha,
            hora_entrada,
            hora_salida,
            estado,
            qr_token
          ) VALUES (?, ?, ?, NULL, 'pendiente', ?)
        `,
        [usuario_id, fecha, hora, token]
      );

      result = {
        id: Number((insertResult as any).insertId),
        tipo: 'entrada',
        message: 'Entrada registrada correctamente',
        fecha,
      };
    } else {
      if (asistenciaHoy.hora_salida) {
        throw new AppError('Ya registraste tu entrada y salida el día de hoy', 409);
      }

      await connection.query(
        `
          UPDATE asistencias
          SET hora_salida = ?,
              qr_token = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        [hora, token, asistenciaHoy.id]
      );

      result = {
        id: Number(asistenciaHoy.id),
        tipo: 'salida',
        message: 'Salida registrada correctamente',
        fecha,
      };
    }

    await QrLogModel.updateOne(
      { _id: qr._id },
      {
        $set: {
          usado: true,
          usuario_id,
          fecha_uso: new Date(),
        },
      }
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  await eliminarNotificacionesAsistenciaUsuario(usuario_id);

  if (result.tipo === 'entrada') {
    await crearNotificacion({
      usuario_id,
      tipo: 'RECORDATORIO_SALIDA',
      titulo: 'Registrar salida',
      mensaje:
        'Entrada registrada correctamente. Recuerda registrar tu salida al finalizar tu jornada.',
      metadata: {
        origen: 'scan',
        asistencia_id: result.id,
        fecha: result.fecha,
      },
    });
  }

  if (result.tipo === 'salida') {
    await crearNotificacionDiaCompleto({
      usuario_id,
      asistencia_id: result.id,
    });
  }

  return result;
}

export const getMisAsistencias = (userId: number) => listMisAsistencias(userId);
export const getAsistencias = () => listAllAsistencias();
export const getPendientes = () => listPendientes();

export async function getMisAsistenciasWeekly(userId: number) {
  if (!userId || userId <= 0) {
    throw new AppError('Usuario inválido', 400);
  }

  const week = getCurrentWeekRange();
  const asistencias = await listMisAsistenciasByDateRange(userId, week.start, week.end);

  return {
    week,
    asistencias,
  };
}

export async function getMisAsistenciasWeeklyReport(userId: number) {
  if (!userId || userId <= 0) {
    throw new AppError('Usuario inválido', 400);
  }

  const week = getCurrentWeekRange();
  const asistencias = await listMisAsistenciasByDateRange(userId, week.start, week.end);

  const pendientes = asistencias.filter((a) => a.estado === 'pendiente').length;
  const aprobadas = asistencias.filter((a) => a.estado === 'aprobada').length;
  const rechazadas = asistencias.filter((a) => a.estado === 'rechazada').length;

  const diasUnicos = new Set(asistencias.map((a) => String(a.fecha).slice(0, 10)));

  return {
    week,
    summary: {
      total: asistencias.length,
      pendientes,
      aprobadas,
      rechazadas,
      dias_con_asistencia: diasUnicos.size,
    },
    dias: asistencias.map((a) => ({
      id: a.id,
      fecha: String(a.fecha).slice(0, 10),
      hora_entrada: a.hora_entrada,
      hora_salida: a.hora_salida,
      estado: a.estado,
    })),
  };
}

export async function approveAsistencia(id: number) {
  if (!id || id <= 0) {
    throw new AppError('ID de asistencia inválido', 400);
  }

  const asistencia = await findAsistenciaById(id);

  if (!asistencia) {
    throw new AppError('Asistencia no encontrada', 404);
  }

  if (asistencia.estado !== 'pendiente') {
    throw new AppError('Solo se pueden aprobar asistencias pendientes', 409);
  }

  await setAsistenciaEstado(id, 'aprobada');
}

export async function rejectAsistencia(id: number) {
  if (!id || id <= 0) {
    throw new AppError('ID de asistencia inválido', 400);
  }

  const asistencia = await findAsistenciaById(id);

  if (!asistencia) {
    throw new AppError('Asistencia no encontrada', 404);
  }

  if (asistencia.estado !== 'pendiente') {
    throw new AppError('Solo se pueden rechazar asistencias pendientes', 409);
  }

  await setAsistenciaEstado(id, 'rechazada');
}