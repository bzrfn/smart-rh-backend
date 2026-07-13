import { pool } from '../../config/db.js';

type CreateNominaInput = {
  usuario_id: number;
  salario_base: number;
  deducciones: number;
  bonos: number;
  total: number;
  periodo_inicio: string;
  periodo_fin: string;
  estado: 'pendiente' | 'pagado';
};

export async function listNominasByUser(usuario_id: number) {
  const [rows] = await pool.query(
    `SELECT
       n.id,
       n.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       n.salario_base,
       n.deducciones,
       n.bonos,
       n.total,
       n.estado,
       n.periodo_inicio,
       n.periodo_fin,
       n.created_at,
       n.updated_at
     FROM nominas n
     JOIN usuarios u ON u.id = n.usuario_id
     WHERE n.usuario_id = ?
     ORDER BY n.id DESC`,
    [usuario_id]
  );

  return rows as any[];
}

export async function listAllNominas() {
  const [rows] = await pool.query(
    `SELECT
       n.id,
       n.usuario_id,
       u.nombre,
       u.apellido,
       u.correo,
       n.salario_base,
       n.deducciones,
       n.bonos,
       n.total,
       n.estado,
       n.periodo_inicio,
       n.periodo_fin,
       n.created_at,
       n.updated_at
     FROM nominas n
     JOIN usuarios u ON u.id = n.usuario_id
     ORDER BY n.id DESC`
  );

  return rows as any[];
}

export async function findNominaById(id: number) {
  const [rows] = await pool.query(
    `SELECT *
     FROM nominas
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  const list = rows as any[];
  return list[0] || null;
}

export async function createNomina(p: CreateNominaInput) {
  const [r] = await pool.query(
    `INSERT INTO nominas (
      usuario_id,
      salario_base,
      deducciones,
      bonos,
      total,
      estado,
      periodo_inicio,
      periodo_fin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.usuario_id,
      p.salario_base,
      p.deducciones,
      p.bonos,
      p.total,
      p.estado,
      p.periodo_inicio,
      p.periodo_fin,
    ]
  );

  return (r as any).insertId as number;
}

export async function updateNomina(id: number, p: CreateNominaInput) {
  await pool.query(
    `UPDATE nominas
     SET salario_base = ?,
         deducciones = ?,
         bonos = ?,
         total = ?,
         estado = ?,
         periodo_inicio = ?,
         periodo_fin = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      p.salario_base,
      p.deducciones,
      p.bonos,
      p.total,
      p.estado,
      p.periodo_inicio,
      p.periodo_fin,
      id,
    ]
  );
}

export async function updateNominaEstado(id: number, estado: 'pendiente' | 'pagado') {
  await pool.query(
    `UPDATE nominas
     SET estado = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [estado, id]
  );
}