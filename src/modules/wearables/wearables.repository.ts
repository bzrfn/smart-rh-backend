import { pool } from '../../config/db.js';

export type WearablePairingCode = {
  id: number;
  usuario_id: number;
  codigo: string;
  device_id?: string | null;
  usado: number;
  fecha_expiracion: Date | string;
  creado_en: Date | string;
  usado_en?: Date | string | null;
};

export type WearableDeviceInput = {
  device_id: string;
  usuario_id?: number | null;
  nombre_dispositivo: string;
  modelo?: string | null;
  plataforma?: string | null;
  estado?: 'ACTIVO' | 'INACTIVO' | 'SINCRONIZANDO';
  bateria?: number;
};

export type WearableEventoTipo =
  | 'REGISTRO'
  | 'ENTRADA'
  | 'SALIDA'
  | 'ALERTA'
  | 'SINCRONIZACION';

export type WearableEventoInput = {
  device_id: string;
  usuario_id?: number | null;
  tipo_evento: WearableEventoTipo;
  latitud?: number | null;
  longitud?: number | null;
  movimiento?: number | null;
  bateria?: number | null;
  mensaje?: string | null;
};

export type WearableSensorInput = {
  device_id: string;
  usuario_id?: number | null;
  acelerometro_x?: number;
  acelerometro_y?: number;
  acelerometro_z?: number;
  latitud?: number | null;
  longitud?: number | null;
  bateria?: number;
  conectado?: number;
};

export type WearableNotificacionInput = {
  device_id: string;
  titulo: string;
  mensaje: string;
  tipo?: 'INFO' | 'ASISTENCIA' | 'ALERTA' | 'SISTEMA';
};

export async function invalidarCodigosVigentes(usuarioId: number) {
  await pool.query(
    `
    UPDATE wearable_pairing_codes
    SET usado = 1,
        usado_en = NOW()
    WHERE usuario_id = ?
      AND usado = 0
      AND fecha_expiracion > NOW()
    `,
    [usuarioId]
  );
}

export async function crearCodigoVinculacion(data: {
  usuario_id: number;
  codigo: string;
  fecha_expiracion: string;
}) {
  const [result]: any = await pool.query(
    `
    INSERT INTO wearable_pairing_codes (
      usuario_id,
      codigo,
      fecha_expiracion
    ) VALUES (?, ?, ?)
    `,
    [data.usuario_id, data.codigo, data.fecha_expiracion]
  );

  return result.insertId as number;
}

export async function buscarCodigoVinculacion(codigo: string) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      usuario_id,
      codigo,
      device_id,
      usado,
      fecha_expiracion,
      creado_en,
      usado_en
    FROM wearable_pairing_codes
    WHERE codigo = ?
      AND usado = 0
    ORDER BY id DESC
    LIMIT 1
    `,
    [codigo]
  );

  return (rows as WearablePairingCode[])[0] || null;
}

export async function marcarCodigoComoUsado(id: number, deviceId: string) {
  await pool.query(
    `
    UPDATE wearable_pairing_codes
    SET usado = 1,
        device_id = ?,
        usado_en = NOW()
    WHERE id = ?
    `,
    [deviceId, id]
  );
}

export async function guardarDispositivoWearable(data: WearableDeviceInput) {
  await pool.query(
    `
    INSERT INTO wearable_dispositivos (
      device_id,
      usuario_id,
      nombre_dispositivo,
      modelo,
      plataforma,
      estado,
      bateria,
      ultima_conexion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      usuario_id = VALUES(usuario_id),
      nombre_dispositivo = VALUES(nombre_dispositivo),
      modelo = VALUES(modelo),
      plataforma = VALUES(plataforma),
      estado = VALUES(estado),
      bateria = VALUES(bateria),
      ultima_conexion = NOW()
    `,
    [
      data.device_id,
      data.usuario_id || null,
      data.nombre_dispositivo,
      data.modelo || null,
      data.plataforma || 'Wear OS',
      data.estado || 'ACTIVO',
      data.bateria ?? 100,
    ]
  );
}

export async function obtenerDispositivoPorDeviceId(deviceId: string) {
  const [rows] = await pool.query(
    `
    SELECT
      d.id,
      d.device_id,
      d.usuario_id,
      d.nombre_dispositivo,
      d.modelo,
      d.plataforma,
      d.estado,
      d.bateria,
      d.ultima_conexion,
      d.creado_en,
      d.actualizado_en,
      u.nombre,
      u.apellido,
      u.correo
    FROM wearable_dispositivos d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    WHERE d.device_id = ?
    LIMIT 1
    `,
    [deviceId]
  );

  return (rows as any[])[0] || null;
}

export async function obtenerDispositivosWearable() {
  const [rows] = await pool.query(
    `
    SELECT
      d.id,
      d.device_id,
      d.usuario_id,
      d.nombre_dispositivo,
      d.modelo,
      d.plataforma,
      d.estado,
      d.bateria,
      d.ultima_conexion,
      d.creado_en,
      d.actualizado_en,
      u.nombre,
      u.apellido,
      u.correo
    FROM wearable_dispositivos d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    ORDER BY d.actualizado_en DESC
    `
  );

  return rows as any[];
}

export async function obtenerDispositivosPorUsuarioId(usuarioId: number) {
  const [rows] = await pool.query(
    `
    SELECT
      d.id,
      d.device_id,
      d.usuario_id,
      d.nombre_dispositivo,
      d.modelo,
      d.plataforma,
      d.estado,
      d.bateria,
      d.ultima_conexion,
      d.creado_en,
      d.actualizado_en,
      u.nombre,
      u.apellido,
      u.correo
    FROM wearable_dispositivos d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    WHERE d.usuario_id = ?
    ORDER BY d.actualizado_en DESC
    `,
    [usuarioId]
  );

  return rows as any[];
}

export async function desvincularDispositivoPorUsuario(data: {
  usuario_id: number;
  device_id: string;
}) {
  const [result]: any = await pool.query(
    `
    UPDATE wearable_dispositivos
    SET usuario_id = NULL,
        estado = 'INACTIVO',
        ultima_conexion = NOW()
    WHERE device_id = ?
      AND usuario_id = ?
    `,
    [data.device_id, data.usuario_id]
  );

  return result.affectedRows as number;
}

export async function registrarEventoWearable(data: WearableEventoInput) {
  const [result]: any = await pool.query(
    `
    INSERT INTO wearable_eventos (
      device_id,
      usuario_id,
      tipo_evento,
      latitud,
      longitud,
      movimiento,
      bateria,
      mensaje
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.device_id,
      data.usuario_id || null,
      data.tipo_evento,
      data.latitud ?? null,
      data.longitud ?? null,
      data.movimiento ?? null,
      data.bateria ?? null,
      data.mensaje ?? null,
    ]
  );

  await pool.query(
    `
    UPDATE wearable_dispositivos
    SET bateria = COALESCE(?, bateria),
        ultima_conexion = NOW()
    WHERE device_id = ?
    `,
    [data.bateria ?? null, data.device_id]
  );

  return result.insertId as number;
}

export async function sincronizarEventoConAsistencia(data: {
  usuario_id: number;
  device_id: string;
  tipo_evento: WearableEventoTipo;
}) {
  if (!['ENTRADA', 'SALIDA'].includes(data.tipo_evento)) {
    return {
      sincronizado: false,
      asistencia_id: null,
      message: 'El evento no requiere sincronización con asistencias.',
    };
  }

  const qrToken = `WEAR-${data.device_id}-${Date.now()}`;

  const [rows] = await pool.query(
    `
    SELECT
      id,
      usuario_id,
      fecha,
      hora_entrada,
      hora_salida,
      estado,
      qr_token
    FROM asistencias
    WHERE usuario_id = ?
      AND fecha = CURDATE()
    ORDER BY id DESC
    LIMIT 1
    `,
    [data.usuario_id]
  );

  const asistenciaActual = (rows as any[])[0];

  if (!asistenciaActual) {
    if (data.tipo_evento === 'ENTRADA') {
      const [result]: any = await pool.query(
        `
        INSERT INTO asistencias (
          usuario_id,
          fecha,
          hora_entrada,
          estado,
          qr_token
        ) VALUES (?, CURDATE(), CURTIME(), 'aprobada', ?)
        `,
        [data.usuario_id, qrToken]
      );

      return {
        sincronizado: true,
        asistencia_id: result.insertId,
        message: 'Entrada registrada también en asistencias.',
      };
    }

    const [result]: any = await pool.query(
      `
      INSERT INTO asistencias (
        usuario_id,
        fecha,
        hora_salida,
        estado,
        qr_token
      ) VALUES (?, CURDATE(), CURTIME(), 'aprobada', ?)
      `,
      [data.usuario_id, qrToken]
    );

    return {
      sincronizado: true,
      asistencia_id: result.insertId,
      message: 'Salida registrada también en asistencias.',
    };
  }

  if (data.tipo_evento === 'ENTRADA') {
    await pool.query(
      `
      UPDATE asistencias
      SET hora_entrada = COALESCE(hora_entrada, CURTIME()),
          estado = 'aprobada',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [asistenciaActual.id]
    );

    return {
      sincronizado: true,
      asistencia_id: asistenciaActual.id,
      message: 'Entrada actualizada en asistencias.',
    };
  }

  await pool.query(
    `
    UPDATE asistencias
    SET hora_salida = CURTIME(),
        estado = 'aprobada',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [asistenciaActual.id]
  );

  return {
    sincronizado: true,
    asistencia_id: asistenciaActual.id,
    message: 'Salida actualizada en asistencias.',
  };
}

export async function obtenerEventosWearable(limit = 100) {
  const [rows] = await pool.query(
    `
    SELECT
      e.id,
      e.device_id,
      e.usuario_id,
      e.tipo_evento,
      e.latitud,
      e.longitud,
      e.movimiento,
      e.bateria,
      e.mensaje,
      e.creado_en,
      u.nombre,
      u.apellido,
      u.correo
    FROM wearable_eventos e
    LEFT JOIN usuarios u ON u.id = e.usuario_id
    ORDER BY e.creado_en DESC
    LIMIT ?
    `,
    [limit]
  );

  return rows as any[];
}

export async function registrarSensoresWearable(data: WearableSensorInput) {
  const [result]: any = await pool.query(
    `
    INSERT INTO wearable_sensores (
      device_id,
      usuario_id,
      acelerometro_x,
      acelerometro_y,
      acelerometro_z,
      latitud,
      longitud,
      bateria,
      conectado
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      data.device_id,
      data.usuario_id || null,
      data.acelerometro_x ?? 0,
      data.acelerometro_y ?? 0,
      data.acelerometro_z ?? 0,
      data.latitud ?? null,
      data.longitud ?? null,
      data.bateria ?? 100,
      data.conectado ?? 1,
    ]
  );

  await pool.query(
    `
    UPDATE wearable_dispositivos
    SET bateria = ?,
        ultima_conexion = NOW()
    WHERE device_id = ?
    `,
    [data.bateria ?? 100, data.device_id]
  );

  return result.insertId as number;
}

export async function obtenerSensoresPorDeviceId(deviceId: string, limit = 30) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      device_id,
      usuario_id,
      acelerometro_x,
      acelerometro_y,
      acelerometro_z,
      latitud,
      longitud,
      bateria,
      conectado,
      creado_en
    FROM wearable_sensores
    WHERE device_id = ?
    ORDER BY creado_en DESC
    LIMIT ?
    `,
    [deviceId, limit]
  );

  return rows as any[];
}

export async function crearNotificacionWearable(data: WearableNotificacionInput) {
  const [result]: any = await pool.query(
    `
    INSERT INTO wearable_notificaciones (
      device_id,
      titulo,
      mensaje,
      tipo
    ) VALUES (?, ?, ?, ?)
    `,
    [data.device_id, data.titulo, data.mensaje, data.tipo || 'INFO']
  );

  return result.insertId as number;
}

export async function obtenerNotificacionesPorDeviceId(deviceId: string) {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      device_id,
      titulo,
      mensaje,
      tipo,
      leida,
      creado_en,
      leida_en
    FROM wearable_notificaciones
    WHERE device_id = ?
    ORDER BY creado_en DESC
    LIMIT 30
    `,
    [deviceId]
  );

  return rows as any[];
}

export async function marcarNotificacionLeida(id: number) {
  await pool.query(
    `
    UPDATE wearable_notificaciones
    SET leida = 1,
        leida_en = NOW()
    WHERE id = ?
    `,
    [id]
  );
}