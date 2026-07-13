import { pool } from '../../config/db.js';

type CreateAsistenciaInput = {
  usuario_id: number;
  fecha: string;
  hora_entrada?: string | null;
  hora_salida?: string | null;
  estado?: 'pendiente' | 'aprobada' | 'rechazada';
  qr_token?: string | null;
};

export async function insertQrLog(token: string, gen: Date, exp: Date) {
  await pool.query(
    `INSERT INTO qr_logs (token, fecha_generacion, fecha_expiracion, usado)
     VALUES (?, ?, ?, FALSE)`,
    [token, gen, exp]
  );
}

export async function consumeQrToken(token: string) {
  const [result] = await pool.query(
    `UPDATE qr_logs
     SET usado = TRUE
     WHERE token = ?
       AND usado = FALSE
       AND fecha_expiracion >= NOW()`,
    [token]
  );

  return Number((result as any).affectedRows || 0) > 0;
}

export async function deleteExpiredQrLogs() {
  const [result] = await pool.query(
    `DELETE FROM qr_logs
     WHERE fecha_expiracion < NOW()
        OR (
          usado = TRUE
          AND fecha_generacion < DATE_SUB(NOW(), INTERVAL 2 MINUTE)
        )`
  );

  return Number((result as any).affectedRows || 0);
}

export async function createAsistencia(p: CreateAsistenciaInput) {
  const [r] = await pool.query(
    `INSERT INTO asistencias (
      usuario_id,
      fecha,
      hora_entrada,
      hora_salida,
      estado,
      qr_token
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      p.usuario_id,
      p.fecha,
      p.hora_entrada ?? null,
      p.hora_salida ?? null,
      p.estado ?? 'pendiente',
      p.qr_token ?? null,
    ]
  );

  return (r as any).insertId as number;
}

export async function findAsistenciaById(id: number) {
  const [rows] = await pool.query(
    `SELECT *
     FROM asistencias
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  const list = rows as any[];
  return list[0] || null;
}

export async function findAsistenciaByUserAndFecha(usuario_id: number, fecha: string) {
  const [rows] = await pool.query(
    `SELECT *
     FROM asistencias
     WHERE usuario_id = ?
       AND fecha = ?
     LIMIT 1`,
    [usuario_id, fecha]
  );

  const list = rows as any[];
  return list[0] || null;
}

export async function findAsistenciaAbiertaByUserAndFecha(usuario_id: number, fecha: string) {
  const [rows] = await pool.query(
    `SELECT *
     FROM asistencias
     WHERE usuario_id = ?
       AND fecha = ?
       AND hora_entrada IS NOT NULL
       AND hora_salida IS NULL
     LIMIT 1`,
    [usuario_id, fecha]
  );

  const list = rows as any[];
  return list[0] || null;
}

export async function setAsistenciaHoraSalida(
  id: number,
  hora_salida: string,
  qr_token?: string | null
) {
  await pool.query(
    `UPDATE asistencias
     SET hora_salida = ?,
         qr_token = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND hora_salida IS NULL`,
    [hora_salida, qr_token ?? null, id]
  );
}

export async function listPendientes() {
  const [rows] = await pool.query(
    `SELECT
       a.id,
       a.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       a.fecha,
       a.hora_entrada,
       a.hora_salida,
       a.estado,
       a.qr_token
     FROM asistencias a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.estado = 'pendiente'
     ORDER BY a.fecha DESC, a.id DESC`
  );

  return rows as any[];
}

export async function listMisAsistencias(usuario_id: number) {
  const [rows] = await pool.query(
    `SELECT
       a.id,
       a.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       a.fecha,
       a.hora_entrada,
       a.hora_salida,
       a.estado,
       a.qr_token
     FROM asistencias a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.usuario_id = ?
     ORDER BY a.fecha DESC, a.id DESC`,
    [usuario_id]
  );

  return rows as any[];
}

export async function listMisAsistenciasByDateRange(
  usuario_id: number,
  fechaInicio: string,
  fechaFin: string
) {
  const [rows] = await pool.query(
    `SELECT
       a.id,
       a.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       a.fecha,
       a.hora_entrada,
       a.hora_salida,
       a.estado,
       a.qr_token
     FROM asistencias a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.usuario_id = ?
       AND a.fecha BETWEEN ? AND ?
     ORDER BY a.fecha DESC, a.id DESC`,
    [usuario_id, fechaInicio, fechaFin]
  );

  return rows as any[];
}

export async function listAllAsistencias() {
  const [rows] = await pool.query(
    `SELECT
       a.id,
       a.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       a.fecha,
       a.hora_entrada,
       a.hora_salida,
       a.estado,
       a.qr_token
     FROM asistencias a
     JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.fecha DESC, a.id DESC`
  );

  return rows as any[];
}

export async function setAsistenciaEstado(id: number, estado: 'aprobada' | 'rechazada') {
  await pool.query(
    `UPDATE asistencias
     SET estado = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [estado, id]
  );
}