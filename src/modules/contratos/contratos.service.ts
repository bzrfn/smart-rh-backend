import { AppError } from '../../utils/AppError.js';
import {
  createContrato,
  findContratoActivoByUserId,
  findContratoById,
  listAllContratos,
  listContratosByUser,
  updateContrato,
  updateContratoEstado,
  updateUserDiasVacacionesDisponibles,
} from './contratos.repository.js';

type EstadoContrato = 'activo' | 'inactivo' | 'finalizado';
type TipoContrato = 'indefinido' | 'temporal' | 'practicante' | 'honorarios';

type ContratoPayload = {
  usuario_id?: number;
  tipo_contrato?: string;
  salario_base?: number;
  fecha_inicio?: string;
  fecha_fin?: string | null;
  estado?: string;
};

const ALLOWED_TIPOS: TipoContrato[] = [
  'indefinido',
  'temporal',
  'practicante',
  'honorarios',
];

const ALLOWED_ESTADOS: EstadoContrato[] = [
  'activo',
  'inactivo',
  'finalizado',
];

export const getAllContratos = () => listAllContratos();

export const getMisContratos = (userId: number) => listContratosByUser(userId);

export async function getContratosByUser(usuario_id: number) {
  if (!usuario_id || usuario_id <= 0) {
    throw new AppError('usuarioId inválido', 400);
  }

  return listContratosByUser(usuario_id);
}

function validateContratoPayload(
  p: ContratoPayload,
  options?: { currentId?: number; usuarioIdFallback?: number }
) {
  const usuarioId = Number(p?.usuario_id ?? options?.usuarioIdFallback ?? 0);
  const tipoContratoRaw = String(p?.tipo_contrato ?? '').trim().toLowerCase();
  const salarioBase = Number(p?.salario_base ?? 0);
  const fechaInicio = String(p?.fecha_inicio ?? '').trim();
  const fechaFinRaw = p?.fecha_fin ? String(p.fecha_fin).trim() : null;
  const estadoRaw = String(p?.estado ?? 'activo').trim().toLowerCase();

  if (!usuarioId || usuarioId <= 0) {
    throw new AppError('usuario_id es requerido y debe ser válido', 400);
  }

  if (!tipoContratoRaw) {
    throw new AppError('tipo_contrato es requerido', 400);
  }

  if (!ALLOWED_TIPOS.includes(tipoContratoRaw as TipoContrato)) {
    throw new AppError(
      `tipo_contrato inválido. Valores permitidos: ${ALLOWED_TIPOS.join(', ')}`,
      400
    );
  }

  const tipoContrato = tipoContratoRaw as TipoContrato;

  if (Number.isNaN(salarioBase) || salarioBase <= 0) {
    throw new AppError('salario_base debe ser mayor a 0', 400);
  }

  if (!fechaInicio) {
    throw new AppError('fecha_inicio es requerida', 400);
  }

  if (!ALLOWED_ESTADOS.includes(estadoRaw as EstadoContrato)) {
    throw new AppError(
      `estado inválido. Valores permitidos: ${ALLOWED_ESTADOS.join(', ')}`,
      400
    );
  }

  const estado = estadoRaw as EstadoContrato;

  const start = new Date(fechaInicio);
  if (Number.isNaN(start.getTime())) {
    throw new AppError('fecha_inicio no es válida', 400);
  }

  let fechaFin: string | null = null;

  if (fechaFinRaw) {
    const end = new Date(fechaFinRaw);

    if (Number.isNaN(end.getTime())) {
      throw new AppError('fecha_fin no es válida', 400);
    }

    if (end.getTime() < start.getTime()) {
      throw new AppError('fecha_fin no puede ser menor que fecha_inicio', 400);
    }

    fechaFin = fechaFinRaw;
  }

  return {
    usuario_id: usuarioId,
    tipo_contrato: tipoContrato,
    salario_base: salarioBase,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado,
  };
}

async function validateSingleActiveContrato(
  usuarioId: number,
  estado: EstadoContrato,
  currentId?: number
) {
  if (estado !== 'activo') return;

  const existingActive = await findContratoActivoByUserId(usuarioId);

  if (existingActive && Number(existingActive.id) !== Number(currentId || 0)) {
    throw new AppError('Ya existe un contrato activo para este usuario', 409);
  }
}

function calcularDiasVacaciones(
  fechaInicio: string,
  fechaFin: string | null,
  tipoContrato: TipoContrato
) {
  const start = new Date(fechaInicio);

  if (Number.isNaN(start.getTime())) {
    throw new AppError('fecha_inicio no es válida para calcular vacaciones', 400);
  }

  if (!fechaFin) {
    if (tipoContrato === 'indefinido') return 15;
    return 0;
  }

  const end = new Date(fechaFin);

  if (Number.isNaN(end.getTime())) {
    throw new AppError('fecha_fin no es válida para calcular vacaciones', 400);
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const dias = Math.round((diffDays / 365) * 15);

  return Math.max(0, dias);
}

async function syncDiasVacacionesContrato(data: {
  usuario_id: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  tipo_contrato: TipoContrato;
  estado: EstadoContrato;
}) {
  if (data.estado !== 'activo') {
    await updateUserDiasVacacionesDisponibles(data.usuario_id, 0);
    return;
  }

  const diasCalculados = calcularDiasVacaciones(
    data.fecha_inicio,
    data.fecha_fin,
    data.tipo_contrato
  );

  await updateUserDiasVacacionesDisponibles(data.usuario_id, diasCalculados);
}

export async function addContrato(p: ContratoPayload) {
  const data = validateContratoPayload(p);

  await validateSingleActiveContrato(data.usuario_id, data.estado);

  try {
    const id = await createContrato(data);

    await syncDiasVacacionesContrato(data);

    return id;
  } catch (e: any) {
    if (String(e?.code) === 'ER_DUP_ENTRY') {
      throw new AppError('Ya existe un contrato activo para este usuario', 409);
    }
    throw e;
  }
}

export async function updateContratoData(id: number, p: ContratoPayload) {
  if (!id || id <= 0) {
    throw new AppError('id inválido', 400);
  }

  const existing = await findContratoById(id);
  if (!existing) {
    throw new AppError('Contrato no encontrado', 404);
  }

  const data = validateContratoPayload(
    {
      usuario_id: existing.usuario_id,
      tipo_contrato: p.tipo_contrato ?? existing.tipo_contrato,
      salario_base: p.salario_base ?? existing.salario_base,
      fecha_inicio: p.fecha_inicio ?? existing.fecha_inicio,
      fecha_fin:
        p.fecha_fin === undefined ? existing.fecha_fin : p.fecha_fin,
      estado: p.estado ?? existing.estado,
    },
    {
      currentId: id,
      usuarioIdFallback: existing.usuario_id,
    }
  );

  await validateSingleActiveContrato(data.usuario_id, data.estado, id);
  await updateContrato(id, data);
  await syncDiasVacacionesContrato(data);
}

export async function changeContratoEstado(id: number, estadoRaw: string) {
  if (!id || id <= 0) {
    throw new AppError('id inválido', 400);
  }

  const existing = await findContratoById(id);
  if (!existing) {
    throw new AppError('Contrato no encontrado', 404);
  }

  const estado = estadoRaw.toLowerCase() as EstadoContrato;

  if (!ALLOWED_ESTADOS.includes(estado)) {
    throw new AppError(
      `estado inválido. Valores permitidos: ${ALLOWED_ESTADOS.join(', ')}`,
      400
    );
  }

  await validateSingleActiveContrato(existing.usuario_id, estado, id);
  await updateContratoEstado(id, estado);

  await syncDiasVacacionesContrato({
    usuario_id: existing.usuario_id,
    fecha_inicio: existing.fecha_inicio,
    fecha_fin: existing.fecha_fin,
    tipo_contrato: existing.tipo_contrato,
    estado,
  });
}