import {
  buscarCodigoVinculacion,
  crearCodigoVinculacion,
  crearNotificacionWearable,
  desvincularDispositivoPorUsuario,
  guardarDispositivoWearable,
  invalidarCodigosVigentes,
  marcarCodigoComoUsado,
  marcarNotificacionLeida,
  obtenerDispositivoPorDeviceId,
  obtenerDispositivosPorUsuarioId,
  obtenerDispositivosWearable,
  obtenerEventosWearable,
  obtenerNotificacionesPorDeviceId,
  obtenerSensoresPorDeviceId,
  registrarEventoWearable,
  registrarSensoresWearable,
  sincronizarEventoConAsistencia,
  WearableEventoInput,
  WearableNotificacionInput,
  WearableSensorInput,
} from './wearables.repository.js';

function generarCodigoNumerico() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function fechaMysql(date: Date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function crearError(message: string, statusCode = 400) {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

export async function generarCodigoPairing(usuarioId: number) {
  if (!usuarioId || Number.isNaN(usuarioId)) {
    throw crearError('Usuario no autenticado.', 401);
  }

  await invalidarCodigosVigentes(usuarioId);

  const codigo = generarCodigoNumerico();
  const minutosExpiracion = 5;
  const fechaExpiracion = new Date(Date.now() + minutosExpiracion * 60 * 1000);

  await crearCodigoVinculacion({
    usuario_id: usuarioId,
    codigo,
    fecha_expiracion: fechaMysql(fechaExpiracion),
  });

  return {
    codigo,
    expiresInMinutes: minutosExpiracion,
    fecha_expiracion: fechaExpiracion,
    message: 'Código de vinculación generado correctamente.',
  };
}

export async function vincularDispositivoWearable(input: {
  codigo: string;
  device_id: string;
  nombre_dispositivo?: string;
  modelo?: string;
  plataforma?: string;
  bateria?: number;
}) {
  const codigo = String(input.codigo || '').trim();
  const deviceId = String(input.device_id || '').trim();

  if (!codigo || codigo.length < 6) {
    throw crearError('Código de vinculación inválido.');
  }

  if (!deviceId) {
    throw crearError('El identificador del dispositivo es obligatorio.');
  }

  const codigoGuardado = await buscarCodigoVinculacion(codigo);

  if (!codigoGuardado) {
    throw crearError('El código no existe, ya fue usado o es inválido.');
  }

  const expiracion = new Date(codigoGuardado.fecha_expiracion);

  if (expiracion.getTime() < Date.now()) {
    throw crearError('El código de vinculación expiró. Genera uno nuevo.');
  }

  await guardarDispositivoWearable({
    device_id: deviceId,
    usuario_id: codigoGuardado.usuario_id,
    nombre_dispositivo: input.nombre_dispositivo || 'SMART RH Watch',
    modelo: input.modelo || 'Wear OS Emulator',
    plataforma: input.plataforma || 'Wear OS',
    estado: 'ACTIVO',
    bateria: input.bateria ?? 100,
  });

  await marcarCodigoComoUsado(codigoGuardado.id, deviceId);

  await registrarEventoWearable({
    device_id: deviceId,
    usuario_id: codigoGuardado.usuario_id,
    tipo_evento: 'SINCRONIZACION',
    bateria: input.bateria ?? 100,
    mensaje: 'Dispositivo Wear OS vinculado correctamente con SMART RH.',
  });

  const dispositivo = await obtenerDispositivoPorDeviceId(deviceId);

  return {
    message: 'Reloj vinculado correctamente.',
    dispositivo,
  };
}

export async function obtenerDispositivoWearable(deviceId: string) {
  if (!deviceId) {
    throw crearError('El device_id es obligatorio.');
  }

  const dispositivo = await obtenerDispositivoPorDeviceId(deviceId);

  return {
    vinculado: Boolean(dispositivo?.usuario_id),
    dispositivo,
  };
}

export async function listarDispositivosWearable() {
  const dispositivos = await obtenerDispositivosWearable();

  return {
    total: dispositivos.length,
    dispositivos,
  };
}

export async function listarMisDispositivosWearable(usuarioId: number) {
  if (!usuarioId || Number.isNaN(usuarioId)) {
    throw crearError('Usuario no autenticado.', 401);
  }

  const dispositivos = await obtenerDispositivosPorUsuarioId(usuarioId);

  return {
    total: dispositivos.length,
    dispositivos,
  };
}

export async function desvincularDispositivoWearable(input: {
  usuario_id: number;
  device_id: string;
}) {
  if (!input.usuario_id || Number.isNaN(input.usuario_id)) {
    throw crearError('Usuario no autenticado.', 401);
  }

  if (!input.device_id) {
    throw crearError('El device_id es obligatorio.');
  }

  const affectedRows = await desvincularDispositivoPorUsuario({
    usuario_id: input.usuario_id,
    device_id: input.device_id,
  });

  if (!affectedRows) {
    throw crearError('No se encontró un dispositivo vinculado a tu cuenta.', 404);
  }

  await registrarEventoWearable({
    device_id: input.device_id,
    usuario_id: input.usuario_id,
    tipo_evento: 'SINCRONIZACION',
    mensaje: 'Dispositivo Wear OS desvinculado de la cuenta SMART RH.',
  });

  return {
    message: 'Dispositivo desvinculado correctamente.',
  };
}

export async function crearEventoWearable(input: WearableEventoInput) {
  if (!input.device_id) {
    throw crearError('El device_id es obligatorio.');
  }

  if (!input.tipo_evento) {
    throw crearError('El tipo_evento es obligatorio.');
  }

  const dispositivo = await obtenerDispositivoPorDeviceId(input.device_id);

  if (!dispositivo?.usuario_id) {
    throw crearError('El reloj no está vinculado a ningún usuario.', 401);
  }

  const eventoId = await registrarEventoWearable({
    ...input,
    usuario_id: dispositivo.usuario_id,
  });

  const asistencia = await sincronizarEventoConAsistencia({
    usuario_id: dispositivo.usuario_id,
    device_id: input.device_id,
    tipo_evento: input.tipo_evento,
  });

  return {
    message: asistencia.sincronizado
      ? asistencia.message
      : 'Evento registrado correctamente.',
    id: eventoId,
    asistencia,
  };
}

export async function listarEventosWearable() {
  const eventos = await obtenerEventosWearable();

  return {
    total: eventos.length,
    eventos,
  };
}

export async function crearSensoresWearable(input: WearableSensorInput) {
  if (!input.device_id) {
    throw crearError('El device_id es obligatorio.');
  }

  const dispositivo = await obtenerDispositivoPorDeviceId(input.device_id);

  if (!dispositivo?.usuario_id) {
    throw crearError('El reloj no está vinculado a ningún usuario.', 401);
  }

  const id = await registrarSensoresWearable({
    ...input,
    usuario_id: dispositivo.usuario_id,
  });

  return {
    message: 'Lectura de sensores registrada correctamente.',
    id,
  };
}

export async function listarSensoresWearable(deviceId: string) {
  const sensores = await obtenerSensoresPorDeviceId(deviceId);

  return {
    total: sensores.length,
    sensores,
  };
}

export async function enviarNotificacionWearable(input: WearableNotificacionInput) {
  if (!input.device_id) {
    throw crearError('El device_id es obligatorio.');
  }

  if (!input.titulo || !input.mensaje) {
    throw crearError('El título y el mensaje son obligatorios.');
  }

  const id = await crearNotificacionWearable(input);

  return {
    message: 'Notificación enviada correctamente.',
    id,
  };
}

export async function listarNotificacionesWearable(deviceId: string) {
  const notificaciones = await obtenerNotificacionesPorDeviceId(deviceId);

  return {
    total: notificaciones.length,
    notificaciones,
  };
}

export async function leerNotificacionWearable(id: number) {
  if (!id || Number.isNaN(id)) {
    throw crearError('ID de notificación inválido.');
  }

  await marcarNotificacionLeida(id);

  return {
    message: 'Notificación marcada como leída.',
  };
}