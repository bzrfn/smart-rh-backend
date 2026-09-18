import { pool } from '../../config/db.js';
import {
  ModuloPermiso,
  PermisosUsuario,
} from './permisos.types.js';

export async function getPermisosByUserId(
  userId: number
) {
  const [rows] = await pool.query(
    `SELECT modulo, habilitado
     FROM usuario_modulos
     WHERE usuario_id = ?`,
    [userId]
  );

  return rows as {
    modulo: string;
    habilitado: number;
  }[];
}

export async function isModuloEnabledForUser(
  userId: number,
  modulo: ModuloPermiso
): Promise<boolean> {
  const [rows] = await pool.query(
    `SELECT habilitado
     FROM usuario_modulos
     WHERE usuario_id = ?
       AND modulo = ?
     LIMIT 1`,
    [
      userId,
      modulo,
    ]
  );

  const row =
    (rows as {
      habilitado: number;
    }[])[0];

  return Boolean(
    row?.habilitado
  );
}

export async function updatePermisos(
  userId: number,
  permisos: PermisosUsuario
) {
  const conn =
    await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (
      const [
        modulo,
        habilitado,
      ] of Object.entries(permisos)
    ) {
      await conn.query(
        `INSERT INTO usuario_modulos (
           usuario_id,
           modulo,
           habilitado,
           created_at,
           updated_at
         )
         VALUES (?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           habilitado =
             VALUES(habilitado),
           updated_at = NOW()`,
        [
          userId,
          modulo,
          habilitado ? 1 : 0,
        ]
      );
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
