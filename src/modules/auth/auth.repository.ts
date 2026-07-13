import { pool } from '../../config/db.js';

export type DbUser = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  contrasena: string;
  activo: number;
  email_verificado: number;
  rol_id: number;
  rol_nombre: string;
  telefono?: string | null;
  direccion?: string | null;
  fecha_ingreso?: string | null;
  dias_vacaciones_disponibles?: number;
  foto_perfil_url?: string | null;
  credencial_url?: string | null;
};

const USER_SELECT = `
  SELECT 
    u.id,
    u.nombre,
    u.apellido,
    u.correo,
    u.contrasena,
    u.activo,
    COALESCE(u.email_verificado, 0) AS email_verificado,
    u.rol_id,
    u.telefono,
    u.direccion,
    u.fecha_ingreso,
    u.dias_vacaciones_disponibles,
    u.foto_perfil_url,
    u.credencial_url,
    r.nombre AS rol_nombre
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
`;

export async function findUserByEmail(correo: string): Promise<DbUser | null> {
  const [rows] = await pool.query(
    `${USER_SELECT}
     WHERE u.correo = ?
     LIMIT 1`,
    [correo]
  );

  return (rows as any[])[0] || null;
}

export async function findUserById(userId: number): Promise<DbUser | null> {
  const [rows] = await pool.query(
    `${USER_SELECT}
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  return (rows as any[])[0] || null;
}

export async function createUser(data: {
  nombre: string;
  apellido: string;
  correo: string;
  contrasena: string;
  rol_id: number;
  telefono?: string | null;
  direccion?: string | null;
  fecha_ingreso?: string | null;
  dias_vacaciones_disponibles?: number;
}): Promise<DbUser> {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO usuarios (
        nombre,
        apellido,
        correo,
        contrasena,
        rol_id,
        activo,
        email_verificado,
        telefono,
        direccion,
        fecha_ingreso,
        dias_vacaciones_disponibles,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, NOW(), NOW())`,
      [
        data.nombre,
        data.apellido,
        data.correo,
        data.contrasena,
        data.rol_id,
        data.telefono || null,
        data.direccion || null,
        data.fecha_ingreso || null,
        data.dias_vacaciones_disponibles ?? 12,
      ]
    );

    const insertedId = (result as any).insertId as number;

    await conn.query(
      `INSERT INTO usuario_modulos (usuario_id, modulo, habilitado, created_at, updated_at)
       VALUES
       (?, 'asistencia', 1, NOW(), NOW()),
       (?, 'contratos', 1, NOW(), NOW()),
       (?, 'nomina', 1, NOW(), NOW()),
       (?, 'vacaciones', 1, NOW(), NOW())`,
      [insertedId, insertedId, insertedId, insertedId]
    );

    const [rows] = await conn.query(
      `${USER_SELECT}
       WHERE u.id = ?
       LIMIT 1`,
      [insertedId]
    );

    await conn.commit();

    return (rows as any[])[0] as DbUser;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function updateUserPasswordById(userId: number, hashedPassword: string) {
  await pool.query(
    `UPDATE usuarios
     SET contrasena = ?, updated_at = NOW()
     WHERE id = ?`,
    [hashedPassword, userId]
  );
}

export async function marcarEmailVerificado(userId: number) {
  await pool.query(
    `UPDATE usuarios
     SET email_verificado = 1, updated_at = NOW()
     WHERE id = ?`,
    [userId]
  );
}