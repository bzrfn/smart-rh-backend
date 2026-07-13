import { AppError } from '../../utils/AppError.js';
import {
  createNomina,
  findNominaById,
  listAllNominas,
  listNominasByUser,
  updateNomina,
  updateNominaEstado,
} from './nomina.repository.js';

type NominaPayload = {
  usuario_id?: number;
  salario_base?: number;
  deducciones?: number;
  bonos?: number;
  periodo_inicio?: string;
  periodo_fin?: string;
  estado?: 'pendiente' | 'pagado';
};

type NominaEstado = 'pendiente' | 'pagado';

export const getAllNominas = () => listAllNominas();

export const getMisNominas = (userId: number) => listNominasByUser(userId);

export async function getNominasByUser(userId: number) {
  if (!userId || userId <= 0) {
    throw new AppError('usuarioId inválido', 400);
  }

  return listNominasByUser(userId);
}

function validateNominaPayload(payload: NominaPayload) {
  const usuarioId = Number(payload?.usuario_id ?? 0);
  const salarioBase = Number(payload?.salario_base ?? 0);
  const deducciones = Number(payload?.deducciones ?? 0);
  const bonos = Number(payload?.bonos ?? 0);
  const periodoInicio = String(payload?.periodo_inicio ?? '').trim();
  const periodoFin = String(payload?.periodo_fin ?? '').trim();
  const estado = (payload?.estado ?? 'pendiente') as NominaEstado;

  if (!usuarioId || usuarioId <= 0) {
    throw new AppError('usuario_id es requerido y debe ser válido', 400);
  }

  if (!periodoInicio || !periodoFin) {
    throw new AppError('periodo_inicio y periodo_fin son requeridos', 400);
  }

  if (Number.isNaN(salarioBase) || salarioBase <= 0) {
    throw new AppError('salario_base debe ser mayor a 0', 400);
  }

  if (Number.isNaN(deducciones) || deducciones < 0) {
    throw new AppError('deducciones no puede ser negativo', 400);
  }

  if (Number.isNaN(bonos) || bonos < 0) {
    throw new AppError('bonos no puede ser negativo', 400);
  }

  if (!['pendiente', 'pagado'].includes(estado)) {
    throw new AppError('estado inválido', 400);
  }

  const inicio = new Date(periodoInicio);
  const fin = new Date(periodoFin);

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
    throw new AppError('Las fechas del periodo no son válidas', 400);
  }

  if (fin.getTime() < inicio.getTime()) {
    throw new AppError('periodo_fin no puede ser menor que periodo_inicio', 400);
  }

  const total = salarioBase + bonos - deducciones;

  if (total < 0) {
    throw new AppError('El total calculado no puede ser negativo', 400);
  }

  return {
    usuario_id: usuarioId,
    salario_base: salarioBase,
    deducciones,
    bonos,
    total,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    estado,
  };
}

export async function addNomina(payload: NominaPayload) {
  const data = validateNominaPayload(payload);
  return createNomina(data);
}

export async function updateNominaData(id: number, payload: NominaPayload) {
  if (!id || id <= 0) {
    throw new AppError('id inválido', 400);
  }

  const existing = await findNominaById(id);
  if (!existing) {
    throw new AppError('Nómina no encontrada', 404);
  }

  const data = validateNominaPayload({
    usuario_id: existing.usuario_id,
    salario_base: payload.salario_base,
    deducciones: payload.deducciones,
    bonos: payload.bonos,
    periodo_inicio: payload.periodo_inicio,
    periodo_fin: payload.periodo_fin,
    estado: payload.estado ?? existing.estado,
  });

  await updateNomina(id, data);
}

export async function changeNominaEstado(id: number, estadoRaw: string) {
  if (!id || id <= 0) {
    throw new AppError('id inválido', 400);
  }

  const existing = await findNominaById(id);
  if (!existing) {
    throw new AppError('Nómina no encontrada', 404);
  }

  const estado = estadoRaw as NominaEstado;

  if (!['pendiente', 'pagado'].includes(estado)) {
    throw new AppError('estado inválido', 400);
  }

  await updateNominaEstado(id, estado);
}