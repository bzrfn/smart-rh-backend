import { pool } from '../../config/db.js';

export type UsuarioML = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  activo: number;
  rol_nombre: string;
  fecha_ingreso?: string | null;
  dias_vacaciones_disponibles?: number | null;
  es_cuenta_sistema?: number;
};

export async function obtenerUsuariosParaML(): Promise<UsuarioML[]> {
  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.nombre,
      u.apellido,
      u.correo,
      u.activo,
      u.fecha_ingreso,
      u.dias_vacaciones_disponibles,
      COALESCE(u.es_cuenta_sistema, 0) AS es_cuenta_sistema,
      r.nombre AS rol_nombre
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE COALESCE(u.es_cuenta_sistema, 0) = 0
    ORDER BY u.id ASC
    `
  );

  return rows as UsuarioML[];
}

export async function limpiarPrediccionesML() {
  await pool.query(`DELETE FROM ml_predicciones`);
}

export async function guardarPrediccionML(data: {
  usuario_id: number;
  nombre_completo: string;
  correo: string;
  tipo_modelo: string;
  riesgo: string;
  probabilidad: number;
  prediccion_ausencias: number;
  mae: number;
  mse: number;
  accuracy: number;
  recomendacion: string;
}) {
  await pool.query(
    `
    INSERT INTO ml_predicciones (
      usuario_id,
      nombre_completo,
      correo,
      tipo_modelo,
      riesgo,
      probabilidad,
      prediccion_ausencias,
      mae,
      mse,
      accuracy,
      recomendacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.usuario_id,
      data.nombre_completo,
      data.correo,
      data.tipo_modelo,
      data.riesgo,
      data.probabilidad,
      data.prediccion_ausencias,
      data.mae,
      data.mse,
      data.accuracy,
      data.recomendacion,
    ]
  );
}

export async function obtenerPrediccionesGuardadas() {
  const [rows] = await pool.query(
    `
    SELECT 
      p.*
    FROM ml_predicciones p
    JOIN usuarios u ON u.id = p.usuario_id
    WHERE COALESCE(u.es_cuenta_sistema, 0) = 0
    ORDER BY p.creado_en DESC
    `
  );

  return rows as any[];
}