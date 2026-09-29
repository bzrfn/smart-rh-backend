import { pool } from '../../config/db.js';

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
       a.duracion_minima_aplicada_minutos,
       a.duracion_registrada_segundos,
       a.qr_token
     FROM asistencias a
     JOIN usuarios u ON u.id = a.usuario_id
     WHERE a.estado IN ('pendiente', 'INVALIDA_PENDIENTE_REVISION')
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
       a.duracion_minima_aplicada_minutos,
       a.duracion_registrada_segundos,
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
       a.duracion_minima_aplicada_minutos,
       a.duracion_registrada_segundos,
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
       a.duracion_minima_aplicada_minutos,
       a.duracion_registrada_segundos,
       a.qr_token
     FROM asistencias a
     JOIN usuarios u ON u.id = a.usuario_id
     ORDER BY a.fecha DESC, a.id DESC`
  );

  return rows as any[];
}

// ============================================================
// CAMBIO3_REPOSITORY_HISTORIAL_REVISIONES
// HISTORIAL DURABLE DE REVISION ADMINISTRATIVA
// ============================================================

export async function listAsistenciaRevisiones(
  asistenciaId: number
) {

  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          r.id,
          r.asistencia_id,
          r.admin_usuario_id,

          u.nombre
            AS admin_nombre,

          u.apellido
            AS admin_apellido,

          u.correo
            AS admin_correo,

          r.accion,
          r.motivo,
          r.estado_anterior,
          r.estado_nuevo,
          r.hora_entrada_anterior,
          r.hora_salida_anterior,
          r.hora_entrada_nueva,
          r.hora_salida_nueva,
          r.created_at

        FROM asistencia_revisiones r

        JOIN usuarios u
          ON u.id = r.admin_usuario_id

        WHERE r.asistencia_id = ?

        ORDER BY
          r.created_at ASC,
          r.id ASC
      `,
      [
        asistenciaId,
      ]
    );


  return rows as any[];
}
