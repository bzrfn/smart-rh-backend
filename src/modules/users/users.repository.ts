import {
  pool,
} from '../../config/db.js';

export type UserAccessState = {
  id: number;
  activo: number;
  role: string;
};

export async function listUsers() {
  const [rows] =
    await pool.query(
      `SELECT
         u.id,
         u.nombre,
         u.apellido,
         u.correo,
         u.rol_id,
         r.nombre AS role,
         r.nombre AS rol_nombre,
         u.activo,
         u.created_at,
         u.updated_at,
         u.foto_perfil_url,
         u.credencial_url,
         u.telefono,
         u.direccion,
         u.fecha_ingreso,
         u.dias_vacaciones_disponibles
       FROM usuarios u
       JOIN roles r
         ON r.id = u.rol_id
       ORDER BY u.id DESC`
    );

  return rows as any[];
}

export async function findUserById(
  id: number
) {
  const [rows] =
    await pool.query(
      `SELECT *
       FROM usuarios
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

  return (
    rows as any[]
  )[0] || null;
}

export async function findUserAccessState(
  id: number
): Promise<UserAccessState | null> {
  const [rows] =
    await pool.query(
      `SELECT
         u.id,
         u.activo,
         r.nombre AS role
       FROM usuarios u
       JOIN roles r
         ON r.id = u.rol_id
       WHERE u.id = ?
       LIMIT 1`,
      [id]
    );

  return (
    rows as UserAccessState[]
  )[0] || null;
}

export async function roleExists(
  roleId: number
) {
  const [rows] =
    await pool.query(
      `SELECT id
       FROM roles
       WHERE id = ?
       LIMIT 1`,
      [roleId]
    );

  return (
    rows as any[]
  ).length > 0;
}

export async function createUser(
  p: any
) {
  const [r] =
    await pool.query(
      `INSERT INTO usuarios (
         nombre,
         apellido,
         correo,
         contrasena,
         rol_id,
         activo,
         telefono,
         direccion,
         fecha_ingreso,
         dias_vacaciones_disponibles
       )
       VALUES (
         ?, ?, ?, ?, ?,
         TRUE,
         ?, ?, ?, ?
       )`,
      [
        p.nombre,
        p.apellido,
        p.correo,
        p.contrasena,
        p.rol_id,
        p.telefono || null,
        p.direccion || null,
        p.fecha_ingreso || null,
        p
          .dias_vacaciones_disponibles ??
          12,
      ]
    );

  return (
    r as any
  ).insertId as number;
}

export async function updateUser(
  id: number,
  p: any
) {
  await pool.query(
    `UPDATE usuarios
     SET
       nombre = ?,
       apellido = ?,
       correo = ?,
       rol_id = ?,
       telefono = ?,
       direccion = ?,
       fecha_ingreso = ?,
       dias_vacaciones_disponibles = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [
      p.nombre,
      p.apellido,
      p.correo,
      p.rol_id,
      p.telefono || null,
      p.direccion || null,
      p.fecha_ingreso || null,
      p
        .dias_vacaciones_disponibles ??
        12,
      id,
    ]
  );
}

export async function setUserActive(
  id: number,
  active: boolean
) {
  await pool.query(
    `UPDATE usuarios
     SET
       activo = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [
      active ? 1 : 0,
      id,
    ]
  );
}

export async function setUserVacationDays(
  id: number,
  dias: number
) {
  await pool.query(
    `UPDATE usuarios
     SET
       dias_vacaciones_disponibles = ?,
       updated_at = NOW()
     WHERE id = ?`,
    [
      dias,
      id,
    ]
  );
}

export async function softDeleteUser(
  id: number
) {
  await pool.query(
    `UPDATE usuarios
     SET
       activo = 0,
       updated_at = NOW()
     WHERE id = ?`,
    [id]
  );
}
