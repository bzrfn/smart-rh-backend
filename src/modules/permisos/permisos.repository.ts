import { pool } from '../../config/db.js';

export async function getPermisosByUserId(userId: number) {
  const [rows] = await pool.query(
    `SELECT modulo, habilitado
     FROM usuario_modulos
     WHERE usuario_id = ?`,
    [userId]
  );

  return rows as { modulo: string; habilitado: number }[];
}

export async function updatePermisos(userId: number, permisos: Record<string, boolean>) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const modulo of Object.keys(permisos)) {
      await conn.query(
        `INSERT INTO usuario_modulos (usuario_id, modulo, habilitado, created_at, updated_at)
         VALUES (?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           habilitado = VALUES(habilitado),
           updated_at = NOW()`,
        [userId, modulo, permisos[modulo] ? 1 : 0]
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