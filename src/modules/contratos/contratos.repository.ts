import { pool } from '../../config/db.js';

type CreateContratoInput = {
  usuario_id: number;
  tipo_contrato: string;
  salario_base: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado: 'activo' | 'inactivo' | 'finalizado';
};

export async function listContratosByUser(usuario_id: number) {
  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       c.tipo_contrato,
       c.salario_base,
       c.fecha_inicio,
       c.fecha_fin,
       c.estado,
       c.contrato_pdf_url,
       c.created_at,
       c.updated_at
     FROM contratos c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.usuario_id = ?
     ORDER BY c.id DESC`,
    [usuario_id]
  );

  return rows as any[];
}

export async function listAllContratos() {
  const [rows] = await pool.query(
    `SELECT
       c.id,
       c.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       c.tipo_contrato,
       c.salario_base,
       c.fecha_inicio,
       c.fecha_fin,
       c.estado,
       c.contrato_pdf_url,
       c.created_at,
       c.updated_at
     FROM contratos c
     JOIN usuarios u ON u.id = c.usuario_id
     ORDER BY c.id DESC`
  );

  return rows as any[];
}

export async function findContratoActivoByUserId(usuario_id: number) {
  const [rows] = await pool.query(
    `SELECT *
     FROM contratos
     WHERE usuario_id = ?
       AND estado = 'activo'
     LIMIT 1`,
    [usuario_id]
  );

  return (rows as any[])[0] || null;
}

export async function findContratoById(id: number) {
  const [rows] = await pool.query(
    `SELECT *
     FROM contratos
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return (rows as any[])[0] || null;
}

export async function createContrato(p: CreateContratoInput) {
  const [r] = await pool.query(
    `INSERT INTO contratos (
      usuario_id,
      tipo_contrato,
      salario_base,
      fecha_inicio,
      fecha_fin,
      estado
    ) VALUES (?, ?, ?, ?, ?, ?)`,
    [p.usuario_id, p.tipo_contrato, p.salario_base, p.fecha_inicio, p.fecha_fin, p.estado]
  );

  return (r as any).insertId as number;
}

export async function updateContrato(id: number, p: CreateContratoInput) {
  await pool.query(
    `UPDATE contratos
     SET tipo_contrato = ?,
         salario_base = ?,
         fecha_inicio = ?,
         fecha_fin = ?,
         estado = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [p.tipo_contrato, p.salario_base, p.fecha_inicio, p.fecha_fin, p.estado, id]
  );
}

export async function updateContratoEstado(
  id: number,
  estado: 'activo' | 'inactivo' | 'finalizado'
) {
  await pool.query(
    `UPDATE contratos
     SET estado = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [estado, id]
  );
}

export async function updateUserDiasVacacionesDisponibles(usuario_id: number, dias: number) {
  await pool.query(
    `UPDATE usuarios
     SET dias_vacaciones_disponibles = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [dias, usuario_id]
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

  return Number((rows as any[])[0]?.dias_vacaciones_disponibles ?? 0);
}