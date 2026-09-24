import {
  AppError,
} from '../../utils/AppError.js';

import {
  publicUploadPath,
  writeStorageObject,
} from '../../config/storage.js';

import {
  calculateInclusiveDays,
  normalizeAdminObservation,
  normalizeReason,
  normalizeReviewState,
  prepareIncapacidadProof,
} from './incapacidades.domain.js';

import {
  createIncapacidad,
  findIncapacidadById,
  hasActiveOverlap,
  IncapacidadEstado,
  listAllIncapacidades,
  listOwnIncapacidades,
  reviewIncapacidad,
  setIncapacidadComprobante,
} from './incapacidades.repository.js';


type Actor = {
  userId: number;
  role: string;
};


type CreateInput = {
  fecha_inicio?: unknown;
  fecha_fin?: unknown;
  motivo?: unknown;
};


function ensurePositiveInteger(
  value: unknown,
  fieldName: string
): number {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    throw new AppError(
      `${fieldName} inválido`,
      400
    );
  }

  return parsed;
}


function isAdmin(
  actor: Actor
): boolean {
  return (
    String(actor.role || '')
      .trim()
      .toLowerCase() === 'admin'
  );
}


function normalizeListState(
  value: unknown
): IncapacidadEstado | undefined {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ''
  ) {
    return undefined;
  }

  const state =
    String(value)
      .trim()
      .toLowerCase();

  if (
    state !== 'pendiente' &&
    state !== 'aprobada' &&
    state !== 'rechazada'
  ) {
    throw new AppError(
      'Filtro estado inválido',
      400
    );
  }

  return state;
}


export async function registerIncapacidad(
  actor: Actor,
  input: CreateInput
) {
  const userId =
    ensurePositiveInteger(
      actor.userId,
      'usuario'
    );

  const fechaInicio =
    String(
      input.fecha_inicio || ''
    ).trim();

  const fechaFin =
    String(
      input.fecha_fin || ''
    ).trim();

  const motivo =
    normalizeReason(
      input.motivo
    );

  const diasCalculados =
    calculateInclusiveDays(
      fechaInicio,
      fechaFin
    );

  const overlap =
    await hasActiveOverlap(
      userId,
      fechaInicio,
      fechaFin
    );

  if (overlap) {
    throw new AppError(
      'Ya existe una incapacidad pendiente o aprobada que cruza con las fechas indicadas',
      409
    );
  }

  const id =
    await createIncapacidad({
      usuarioId: userId,
      fechaInicio,
      fechaFin,
      diasCalculados,
      motivo,
    });

  const created =
    await findIncapacidadById(
      id
    );

  if (!created) {
    throw new AppError(
      'No fue posible recuperar la incapacidad registrada',
      500
    );
  }

  return created;
}


export async function getOwnIncapacidades(
  actor: Actor
) {
  return listOwnIncapacidades(
    ensurePositiveInteger(
      actor.userId,
      'usuario'
    )
  );
}


export async function getIncapacidadDetail(
  actor: Actor,
  rawId: unknown
) {
  const id =
    ensurePositiveInteger(
      rawId,
      'id'
    );

  const item =
    await findIncapacidadById(
      id
    );

  if (!item) {
    throw new AppError(
      'Incapacidad no encontrada',
      404
    );
  }

  if (
    !isAdmin(actor) &&
    Number(item.usuario_id) !==
      Number(actor.userId)
  ) {
    throw new AppError(
      'Forbidden',
      403
    );
  }

  return item;
}


export async function getAllIncapacidades(
  actor: Actor,
  rawEstado?: unknown
) {
  if (!isAdmin(actor)) {
    throw new AppError(
      'Forbidden',
      403
    );
  }

  const estado =
    normalizeListState(
      rawEstado
    );

  return listAllIncapacidades(
    estado
  );
}


export async function reviewIncapacidadAsAdmin(
  actor: Actor,
  rawId: unknown,
  rawEstado: unknown,
  rawObservaciones: unknown
) {
  if (!isAdmin(actor)) {
    throw new AppError(
      'Forbidden',
      403
    );
  }

  const id =
    ensurePositiveInteger(
      rawId,
      'id'
    );

  const estado =
    normalizeReviewState(
      rawEstado
    );

  const observaciones =
    normalizeAdminObservation(
      rawObservaciones
    );

  const current =
    await findIncapacidadById(
      id
    );

  if (!current) {
    throw new AppError(
      'Incapacidad no encontrada',
      404
    );
  }

  if (
    current.estado !==
    'pendiente'
  ) {
    throw new AppError(
      'La incapacidad ya fue revisada',
      409
    );
  }

  const updated =
    await reviewIncapacidad(
      id,
      ensurePositiveInteger(
        actor.userId,
        'administrador'
      ),
      estado,
      observaciones
    );

  if (!updated) {
    throw new AppError(
      'No fue posible actualizar la incapacidad',
      409
    );
  }

  const result =
    await findIncapacidadById(
      id
    );

  if (!result) {
    throw new AppError(
      'Incapacidad no encontrada después de la revisión',
      500
    );
  }

  return result;
}



// ============================================================
// GI-HU02 — ADJUNTAR COMPROBANTE MÉDICO
// ============================================================

export async function attachIncapacidadComprobante(
  actor: Actor,
  rawId: unknown,
  input: {
    base64?: unknown;
    filename?: unknown;
  }
) {
  const userId =
    ensurePositiveInteger(
      actor.userId,
      'usuario'
    );

  const id =
    ensurePositiveInteger(
      rawId,
      'id'
    );

  const current =
    await findIncapacidadById(
      id
    );

  if (!current) {
    throw new AppError(
      'Incapacidad no encontrada',
      404
    );
  }

  /*
   * GI-HU02 pertenece al empleado.
   * Ni siquiera un usuario autenticado
   * puede adjuntar evidencia en la
   * incapacidad de otra persona.
   */
  if (
    Number(
      current.usuario_id
    ) !== userId
  ) {
    throw new AppError(
      'Forbidden',
      403
    );
  }

  if (
    current.estado !==
    'pendiente'
  ) {
    throw new AppError(
      'Solo puedes adjuntar el comprobante mientras la incapacidad esté pendiente',
      409
    );
  }

  if (
    current.comprobante_key
  ) {
    throw new AppError(
      'La incapacidad ya tiene un comprobante adjunto',
      409
    );
  }

  const proof =
    prepareIncapacidadProof(
      input.base64,
      input.filename
    );

  const key =
    [
      'incapacidades',
      `comprobante_${userId}_${id}_${Date.now()}.${proof.extension}`,
    ].join('/');

  /*
   * Primero almacenamos el objeto.
   * Después persistimos su referencia.
   *
   * El UPDATE contiene las mismas
   * condiciones de ownership/estado
   * para proteger concurrencia.
   */
  await writeStorageObject(
    key,
    proof.buffer,
    proof.mime
  );

  const updated =
    await setIncapacidadComprobante(
      id,
      userId,
      key,
      proof.originalName,
      proof.mime,
      proof.size
    );

  if (!updated) {
    throw new AppError(
      'No fue posible asociar el comprobante a la incapacidad',
      409
    );
  }

  const result =
    await findIncapacidadById(
      id
    );

  if (!result) {
    throw new AppError(
      'Incapacidad no encontrada después de adjuntar el comprobante',
      500
    );
  }

  return {
    ...result,

    comprobante_url:
      result.comprobante_key
        ? publicUploadPath(
            result.comprobante_key
          )
        : null,
  };
}
