import { pool } from '../../config/db.js';

export type EmailCodeType = 'REGISTER' | 'LOGIN_2FA' | 'RESET_PASSWORD';

export function generarCodigoEmail() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function crearCodigoEmail(data: {
  usuario_id?: number | null;
  correo: string;
  codigo: string;
  tipo: EmailCodeType;
  minutosExpiracion?: number;
}) {
  const minutos = data.minutosExpiracion ?? 10;

  await pool.query(
    `INSERT INTO email_verification_codes (
      usuario_id,
      correo,
      codigo,
      tipo,
      usado,
      fecha_expiracion,
      creado_en
    ) VALUES (?, ?, ?, ?, 0, DATE_ADD(NOW(), INTERVAL ? MINUTE), NOW())`,
    [
      data.usuario_id || null,
      data.correo,
      data.codigo,
      data.tipo,
      minutos,
    ]
  );

  return {
    codigo: data.codigo,
    expiresInMinutes: minutos,
  };
}

export async function consumirCodigoEmail(data: {
  correo: string;
  codigo: string;
  tipo: EmailCodeType;
}) {
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT *
       FROM email_verification_codes
       WHERE correo = ?
         AND codigo = ?
         AND tipo = ?
         AND usado = 0
         AND fecha_expiracion > NOW()
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [
        data.correo,
        data.codigo,
        data.tipo,
      ]
    );

    const entry = (rows as any[])[0];

    if (!entry) {
      await conn.rollback();
      return null;
    }

    await conn.query(
      `UPDATE email_verification_codes
       SET usado = 1
       WHERE id = ?`,
      [entry.id]
    );

    await conn.commit();

    return entry as {
      id: number;
      usuario_id: number | null;
      correo: string;
      codigo: string;
      tipo: EmailCodeType;
      usado: number;
      fecha_expiracion: Date;
      creado_en: Date;
    };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export async function invalidarCodigosActivos(data: {
  correo: string;
  tipo: EmailCodeType;
}) {
  await pool.query(
    `UPDATE email_verification_codes
     SET usado = 1
     WHERE correo = ?
       AND tipo = ?
       AND usado = 0`,
    [data.correo, data.tipo]
  );
}