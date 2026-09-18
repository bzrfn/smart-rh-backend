import {
  pool,
} from '../../config/db.js';

import type {
  PoolConnection,
} from 'mysql2/promise';

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


export async function findRoleNameById(
  roleId: number
): Promise<string | null> {
  const [rows] =
    await pool.query(
      `SELECT nombre
       FROM roles
       WHERE id = ?
       LIMIT 1`,
      [roleId]
    );

  const row =
    (rows as any[])[0];

  return row
    ? String(row.nombre)
    : null;
}



export type AdminMutationLockState = {
  target: UserAccessState | null;
  activeAdminCount: number;
};

type AdminMutationGuard = (
  state: AdminMutationLockState
) => void;

async function withAdminMutationLock(
  targetUserId: number,
  guard: AdminMutationGuard,
  mutation: (
    conn: PoolConnection
  ) => Promise<void>
): Promise<void> {
  const conn =
    await pool.getConnection();

  try {
    await conn.beginTransaction();

    /*
     * Se bloquean primero TODOS los administradores activos.
     *
     * Esto serializa las operaciones que podrían retirar acceso
     * administrativo y evita que dos solicitudes concurrentes
     * desactiven/degraden administradores utilizando el mismo
     * conteo previo.
     */
    const [adminRows] =
      await conn.query(
        `SELECT u.id
         FROM usuarios u
         JOIN roles r
           ON r.id = u.rol_id
         WHERE u.activo = 1
           AND LOWER(TRIM(r.nombre)) = 'admin'
         ORDER BY u.id
         FOR UPDATE`
      );

    /*
     * Después se bloquea el usuario objetivo.
     *
     * El orden de bloqueo siempre es:
     * 1. administradores activos
     * 2. usuario objetivo
     *
     * Esto reduce riesgo de deadlocks entre operaciones
     * administrativas concurrentes.
     */
    const [targetRows] =
      await conn.query(
        `SELECT
           u.id,
           u.activo,
           r.nombre AS role
         FROM usuarios u
         JOIN roles r
           ON r.id = u.rol_id
         WHERE u.id = ?
         LIMIT 1
         FOR UPDATE`,
        [targetUserId]
      );

    const target =
      (
        targetRows as UserAccessState[]
      )[0] || null;

    const state:
      AdminMutationLockState = {
        target,
        activeAdminCount:
          (adminRows as any[]).length,
      };

    /*
     * La regla de negocio se ejecuta DENTRO
     * de la misma transacción y después
     * de adquirir los bloqueos.
     */
    guard(state);

    await mutation(conn);

    await conn.commit();
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // No se reemplaza el error original
      // por un posible error de rollback.
    }

    throw error;
  } finally {
    conn.release();
  }
}

export async function updateUserWithAdminLock(
  id: number,
  p: any,
  guard: AdminMutationGuard
): Promise<void> {
  await withAdminMutationLock(
    id,
    guard,
    async (conn) => {
      await conn.query(
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
          p.dias_vacaciones_disponibles ?? 12,
          id,
        ]
      );
    }
  );
}

export async function setUserActiveWithAdminLock(
  id: number,
  active: boolean,
  guard: AdminMutationGuard
): Promise<void> {
  await withAdminMutationLock(
    id,
    guard,
    async (conn) => {
      await conn.query(
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
  );
}

export async function softDeleteUserWithAdminLock(
  id: number,
  guard: AdminMutationGuard
): Promise<void> {
  await withAdminMutationLock(
    id,
    guard,
    async (conn) => {
      await conn.query(
        `UPDATE usuarios
         SET
           activo = 0,
           updated_at = NOW()
         WHERE id = ?`,
        [id]
      );
    }
  );
}
