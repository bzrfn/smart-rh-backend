import { pool } from '../../config/db.js';

export async function findUserDocumentData(usuarioId: number) {
  const [rows] = await pool.query(
    `
      SELECT 
        u.id,
        u.nombre,
        u.apellido,
        u.correo,
        u.rol_id,
        u.activo,
        u.foto_perfil_url,
        u.credencial_url,
        u.telefono,
        u.direccion,
        u.fecha_ingreso,
        r.nombre AS rol_nombre
      FROM usuarios u
      LEFT JOIN roles r ON r.id = u.rol_id
      WHERE u.id = ?
      LIMIT 1
    `,
    [usuarioId]
  );

  return (rows as any[])[0] || null;
}

export async function findLatestContratoByUser(usuarioId: number) {
  const [rows] = await pool.query(
    `
      SELECT *
      FROM contratos
      WHERE usuario_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
    [usuarioId]
  );

  return (rows as any[])[0] || null;
}

export async function findActiveContratoByUser(
  usuarioId: number
) {
  const [rows] =
    await pool.query(
      `
        SELECT *
        FROM contratos
        WHERE usuario_id = ?
          AND estado = 'activo'
        ORDER BY id DESC
        LIMIT 1
      `,
      [usuarioId]
    );

  return (
    rows as any[]
  )[0] || null;
}


export async function setUserFotoPerfil(usuarioId: number, fotoUrl: string) {
  await pool.query(
    `
      UPDATE usuarios
      SET foto_perfil_url = ?
      WHERE id = ?
    `,
    [fotoUrl, usuarioId]
  );
}

export async function setUserCredencial(usuarioId: number, credencialUrl: string) {
  await pool.query(
    `
      UPDATE usuarios
      SET credencial_url = ?
      WHERE id = ?
    `,
    [credencialUrl, usuarioId]
  );
}

export async function setContratoPdf(contratoId: number, contratoPdfUrl: string) {
  await pool.query(
    `
      UPDATE contratos
      SET contrato_pdf_url = ?
      WHERE id = ?
    `,
    [contratoPdfUrl, contratoId]
  );
}
