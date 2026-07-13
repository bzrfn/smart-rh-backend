import { AppError } from '../../utils/AppError.js';
import {
  createVacacion,
  findVacacionById,
  getUserDiasVacacionesDisponibles,
  listVacaciones,
  setEstado,
  updateUserDiasVacacionesDisponibles,
} from './vacaciones.repository.js';

type VacacionPayload = {
  dias_solicitados?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
};

export const getVacaciones = (uid?: number) => listVacaciones(uid);

export const getMisVacaciones = (userId: number) => listVacaciones(userId);

export const getDiasDisponibles = (userId: number) =>
  getUserDiasVacacionesDisponibles(userId);

export async function requestVacaciones(
  userId: number,
  payload: VacacionPayload
) {
  const diasDisponibles = await getUserDiasVacacionesDisponibles(userId);
  const diasSolicitados = Number(payload?.dias_solicitados ?? 0);
  const fechaInicio = String(payload?.fecha_inicio ?? '').trim();
  const fechaFin = String(payload?.fecha_fin ?? '').trim();

  if (!fechaInicio || !fechaFin) {
    throw new AppError('fecha_inicio y fecha_fin son requeridas', 400);
  }

  if (!diasSolicitados || diasSolicitados <= 0) {
    throw new AppError('dias_solicitados debe ser mayor a 0', 400);
  }

  const start = new Date(fechaInicio);
  const end = new Date(fechaFin);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new AppError('Las fechas proporcionadas no son válidas', 400);
  }

  if (end.getTime() < start.getTime()) {
    throw new AppError('fecha_fin no puede ser menor que fecha_inicio', 400);
  }

  if (diasSolicitados > diasDisponibles) {
    throw new AppError('Los días solicitados exceden los días disponibles', 400);
  }

  return createVacacion({
    usuario_id: userId,
    dias_disponibles: diasDisponibles,
    dias_solicitados: diasSolicitados,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado: 'pendiente',
  });
}

export async function approveVacaciones(id: number) {
  if (!id || id <= 0) {
    throw new AppError('ID de solicitud inválido', 400);
  }

  const vacacion = await findVacacionById(id);

  if (!vacacion) {
    throw new AppError('Solicitud de vacaciones no encontrada', 404);
  }

  if (vacacion.estado !== 'pendiente') {
    throw new AppError('Solo se pueden aprobar solicitudes pendientes', 409);
  }

  const diasActuales = await getUserDiasVacacionesDisponibles(
    Number(vacacion.usuario_id)
  );
  const diasSolicitados = Number(vacacion.dias_solicitados);
  const nuevoSaldo = diasActuales - diasSolicitados;

  if (nuevoSaldo < 0) {
    throw new AppError(
      'El usuario no tiene saldo suficiente para aprobar la solicitud',
      409
    );
  }

  await setEstado(id, 'aprobada');
  await updateUserDiasVacacionesDisponibles(
    Number(vacacion.usuario_id),
    nuevoSaldo
  );
}

export async function rejectVacaciones(id: number) {
  if (!id || id <= 0) {
    throw new AppError('ID de solicitud inválido', 400);
  }

  const vacacion = await findVacacionById(id);

  if (!vacacion) {
    throw new AppError('Solicitud de vacaciones no encontrada', 404);
  }

  if (vacacion.estado !== 'pendiente') {
    throw new AppError('Solo se pueden rechazar solicitudes pendientes', 409);
  }

  await setEstado(id, 'rechazada');
}