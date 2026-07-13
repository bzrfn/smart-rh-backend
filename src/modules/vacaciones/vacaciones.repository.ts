import { pool } from '../../config/db.js';

type CreateVacacionInput = {
  usuario_id: number;
  dias_disponibles: number;
  dias_solicitados: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
};

export async function listVacaciones(usuario_id?: number) {
  const [rows] = usuario_id
    ? await pool.query(
        `SELECT
           v.id,
           v.usuario_id,
           u.nombre,
           u.apellido,
           u.correo,
           v.dias_disponibles,
           v.dias_solicitados,
           v.fecha_inicio,
           v.fecha_fin,
           v.estado,
           v.created_at,
           v.updated_at
         FROM vacaciones v
         JOIN usuarios u ON u.id = v.usuario_id
         WHERE v.usuario_id = ?
         ORDER BY v.id DESC`,
        [usuario_id]
      )
    : await pool.query(
        `SELECT
           v.id,
           v.usuario_id,
           u.nombre,
           u.apellido,
           u.correo,
           v.dias_disponibles,
           v.dias_solicitados,
           v.fecha_inicio,
           v.fecha_fin,
           v.estado,
           v.created_at,
           v.updated_at
         FROM vacaciones v
         JOIN usuarios u ON u.id = v.usuario_id
         ORDER BY v.id DESC`
      );

  return rows as any[];
}

export async function findVacacionById(id: number) {
  const [rows] = await pool.query(
    `SELECT *
     FROM vacaciones
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  const list = rows as any[];
  return list[0] || null;
}

export async function createVacacion(p: CreateVacacionInput) {
  const [r] = await pool.query(
    `INSERT INTO vacaciones (
      usuario_id,
      dias_disponibles,
      dias_solicitados,
      fecha_inicio,
      fecha_fin,
      estado,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      p.usuario_id,
      p.dias_disponibles,
      p.dias_solicitados,
      p.fecha_inicio,
      p.fecha_fin,
      p.estado,
    ]
  );

  return (r as any).insertId as number;
}

export async function setEstado(id: number, estado: 'aprobada' | 'rechazada') {
  await pool.query(
    `UPDATE vacaciones
     SET estado = ?, updated_at = NOW()
     WHERE id = ?`,
    [estado, id]
  );
}

export async function getUserDiasVacacionesDisponibles(usuario_id: number) {
  const [rows] = await pool.query(
    `SELECT dias_vacaciones_disponibles
     FROM usuarios
     WHERE id = ?
     LIMIT 1`,
    [usuario_id]
  );

  const list = rows as any[];
  return Number(list[0]?.dias_vacaciones_disponibles ?? 0);
}

export async function updateUserDiasVacacionesDisponibles(
  usuario_id: number,
  dias: number
) {
  await pool.query(
    `UPDATE usuarios
     SET dias_vacaciones_disponibles = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [dias, usuario_id]
  );
}