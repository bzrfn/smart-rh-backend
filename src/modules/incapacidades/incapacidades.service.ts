import {
  randomUUID,
} from 'node:crypto';

import {
  AppError,
} from '../../utils/AppError.js';

import {
  deleteStorageObject,
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
  listIncapacidadReviewHistory,
  listOwnIncapacidades,
  reviewIncapacidad,
} from './incapacidades.repository.js';

import {
  analyzePdfStructure,
  buildIncapacidadAutomaticValidation,
} from './incapacidades.intelligence.js';

import {
  findIncapacidadAnalysisById,
  listIncapacidadAnalysesByIds,
  setIncapacidadComprobanteWithAnalysis,
} from './incapacidades.intelligence.repository.js';

import {
  analyzeIncapacidadPdfFields,
} from './incapacidades.intelligence.pipeline.js';



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


async function decorateAdminIncapacidad<
  T extends {
    id: number;
  }
>(
  item: T
) {
  const analysis =
    await findIncapacidadAnalysisById(
      Number(
        item.id
      )
    );

  return {
    ...item,

    validacion_automatica:
      buildIncapacidadAutomaticValidation(
        analysis
      ),
  };
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

  if (
    isAdmin(actor)
  ) {
    return decorateAdminIncapacidad(
      item
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

    const items =
    await listAllIncapacidades(
      estado
    );

  const analyses =
    await listIncapacidadAnalysesByIds(
      items.map(
        item =>
          Number(
            item.id
          )
      )
    );

  const analysisByIncapacidad =
    new Map(
      analyses.map(
        analysis => [
          Number(
            analysis.incapacidad_id
          ),
          analysis,
        ]
      )
    );

  return items.map(
    item => ({
      ...item,

      validacion_automatica:
        buildIncapacidadAutomaticValidation(
          analysisByIncapacidad.get(
            Number(
              item.id
            )
          ) ||
          null
        ),
    })
  );
}


export async function getIncapacidadReviewHistoryAsAdmin(
  actor: Actor,
  rawId: unknown
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


  const rows =
    await listIncapacidadReviewHistory(
      id
    );


  return rows.map(
    row => ({
      id:
        Number(
          row.id
        ),

      accion:
        row.accion,

      estado_anterior:
        row.estado_anterior,

      estado_nuevo:
        row.estado_nuevo,

      observaciones_admin:
        row.observaciones_admin,

      administrador: {
        id:
          Number(
            row.admin_usuario_id
          ),

        nombre:
          row.admin_nombre,

        apellido:
          row.admin_apellido,
      },

      decidido_at:
        row.decidido_at,

      validacion_automatica_snapshot: {
        disponible:
          Boolean(
            Number(
              row.analisis_disponible
            )
          ),

        estado_analisis:
          row.estado_analisis_snapshot,

        estado_estructura:
          row.estado_estructura_snapshot,

        puntaje_estructura:
          row.puntaje_estructura_snapshot ===
            null
            ? null
            : Number(
                row
                  .puntaje_estructura_snapshot
              ),

        duplicado_detectado:
          row.duplicado_detectado_snapshot ===
            null
            ? null
            : Boolean(
                Number(
                  row
                    .duplicado_detectado_snapshot
                )
              ),

        duplicado_de_incapacidad_id:
          row
            .duplicado_de_incapacidad_id_snapshot,
      },
    })
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

  return decorateAdminIncapacidad(
    result
  );
}



// ============================================================
// GI-HU02 — ADJUNTAR COMPROBANTE MÉDICO
// ============================================================

async function compensateIncapacidadProofStorage(
  key: string
): Promise<void> {
  /*
   * Best effort:
   * no exponemos contenido médico ni Base64.
   *
   * La key lleva UUID por intento para no
   * borrar el objeto confirmado por otro
   * request concurrente.
   */
  try {
    await deleteStorageObject(
      key
    );
  } catch {
    /*
     * Se conserva el error principal.
     * Una reconciliación operativa podrá
     * revisar un eventual objeto huérfano.
     */
  }
}



/*
 * MySQL2 materializa columnas DATE como Date
 * cuando dateStrings no está habilitado.
 *
 * Una fecha laboral no representa un instante:
 * conservamos sus componentes calendario locales
 * y nunca usamos toISOString() para evitar
 * desplazamientos por zona horaria.
 */
export function normalizeIncapacidadDateForIntelligence(
  value:
    unknown
): string {
  if (
    value instanceof
      Date
  ) {
    if (
      !Number.isFinite(
        value.getTime()
      )
    ) {
      throw new AppError(
        'Fecha de incapacidad inválida',
        500
      );
    }


    const year =
      String(
        value.getFullYear()
      ).padStart(
        4,
        '0'
      );


    const month =
      String(
        value.getMonth() +
        1
      ).padStart(
        2,
        '0'
      );


    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        '0'
      );


    return [
      year,
      month,
      day,
    ].join(
      '-'
    );
  }


  if (
    typeof value ===
      'string'
  ) {
    const normalized =
      value.trim();


    const match =
      normalized.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );


    if (match) {
      return [
        match[1],
        match[2],
        match[3],
      ].join(
        '-'
      );
    }
  }


  throw new AppError(
    'Fecha de incapacidad inválida',
    500
  );
}


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

  const analysis =
    analyzePdfStructure(
      proof.buffer
    );



  /*
   * Analizamos el contenido antes de
   * escribir el objeto en storage.
   *
   * Solo continúa el resultado estructurado.
   */
  const extractionPersistence =
    await analyzeIncapacidadPdfFields(
      proof.buffer,
      {
        fecha_inicio:
          normalizeIncapacidadDateForIntelligence(
            current.fecha_inicio
          ),

        fecha_fin:
          normalizeIncapacidadDateForIntelligence(
            current.fecha_fin
          ),

        dias_calculados:
          current.dias_calculados,
      }
    );

  const key =
    [
      'incapacidades',
      `comprobante_${userId}_${id}_${analysis.sha256.slice(0, 16)}_${randomUUID()}.${proof.extension}`,
    ].join('/');

  /*
   * Primero almacenamos el objeto.
   * Después persistimos su referencia y análisis.
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

  let persistence:
    Awaited<
      ReturnType<
        typeof setIncapacidadComprobanteWithAnalysis
      >
    >;

  try {
    persistence =
    await setIncapacidadComprobanteWithAnalysis(
      id,
      userId,
      key,
      proof.originalName,
      proof.mime,
      proof.size,
      analysis,
      extractionPersistence
    );

  } catch (error) {
    await compensateIncapacidadProofStorage(
      key
    );

    throw error;
  }


  if (!persistence.updated) {
    await compensateIncapacidadProofStorage(
      key
    );

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
