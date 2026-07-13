import { pool } from '../../config/db.js';
export async function listRoles() {
  const [rows] = await pool.query('SELECT id,nombre,descripcion FROM roles ORDER BY id');
  return rows as any[];
}
