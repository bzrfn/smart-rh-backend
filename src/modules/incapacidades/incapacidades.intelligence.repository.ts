import type {
  ResultSetHeader,
  RowDataPacket,
} from 'mysql2';

import {
  pool,
} from '../../config/db.js';

import type {
  PdfDeterministicAnalysis,
} from './incapacidades.intelligence.js';

import type {
  IncapacidadExtractionPersistencePayload,
} from './incapacidades.intelligence.extraction.js';



export type IncapacidadAnalysisPersistenceResult = {
  updated: boolean;

  duplicateOfIncapacidadId:
    number | null;

  analysisState:
    | 'completado'
    | 'requiere_revision';
};


/*
 * Asocia comprobante y resultado del análisis
 * dentro de una única transacción SQL.
 *
 * La aprobación o rechazo administrativo NO
 * se realiza aquí.
 */
export async function setIncapacidadComprobanteWithAnalysis(
  id: number,
  userId: number,
  comprobanteKey: string,
  comprobanteNombre: string,
  comprobanteMime: string,
  comprobanteTamano: number,
  analysis: PdfDeterministicAnalysis,
  extractionPersistence:
    IncapacidadExtractionPersistencePayload | null =
      null
): Promise<IncapacidadAnalysisPersistenceResult> {
  const connection =
    await pool.getConnection();

  const shaLockName =
    `incap_sha_${analysis.sha256.slice(0, 48)}`;

  let shaLockAcquired =
    false;

  try {
    const [
      shaLockRows,
    ] =
      await connection
        .execute<
          (
            RowDataPacket & {
              acquired:
                number | null;
            }
          )[]
        >(
          'SELECT GET_LOCK(?, 5) AS acquired',
          [
            shaLockName,
          ]
        );

    shaLockAcquired =
      Number(
        shaLockRows?.[0]
          ?.acquired ??
        0
      ) === 1;

    if (!shaLockAcquired) {
      throw new Error(
        'No fue posible adquirir el bloqueo de análisis'
      );
    }

    await connection
      .beginTransaction();

    /*
     * Conservamos las reglas previas:
     *
     * - la incapacidad pertenece al usuario
     * - continúa pendiente
     * - todavía no tiene comprobante
     */
    const [
      updateResult,
    ] =
      await connection
        .execute<ResultSetHeader>(
          `
          UPDATE incapacidades
          SET
            comprobante_key = ?,
            comprobante_nombre = ?,
            comprobante_mime = ?,
            comprobante_tamano = ?
          WHERE id = ?
            AND usuario_id = ?
            AND estado = 'pendiente'
            AND comprobante_key IS NULL
          `,
          [
            comprobanteKey,
            comprobanteNombre,
            comprobanteMime,
            comprobanteTamano,
            id,
            userId,
          ]
        );

    if (
      updateResult.affectedRows !==
      1
    ) {
      await connection
        .rollback();

      return {
        updated:
          false,

        duplicateOfIncapacidadId:
          null,

        analysisState:
          'requiere_revision',
      };
    }

    /*
     * Buscamos otra incapacidad con exactamente
     * la misma huella SHA-256.
     *
     * Encontrarla NO significa fraude.
     * Únicamente provoca revisión humana.
     */
    const [
      duplicateRows,
    ] =
      await connection
        .execute<
          (
            RowDataPacket & {
              incapacidad_id:
                number;
            }
          )[]
        >(
          `
          SELECT
            incapacidad_id
          FROM incapacidad_analisis
          WHERE documento_sha256 = ?
            AND incapacidad_id <> ?
          ORDER BY id ASC
          LIMIT 1
          FOR UPDATE
          `,
          [
            analysis.sha256,
            id,
          ]
        );

    const duplicateOfIncapacidadId =
      duplicateRows.length > 0
        ? Number(
            duplicateRows[0]
              .incapacidad_id
          )
        : null;

    const duplicateDetected =
      duplicateOfIncapacidadId !==
      null;

    const analysisState:
      | 'completado'
      | 'requiere_revision' =
        (
          duplicateDetected ||
          analysis.structureStatus !==
            'valido' ||
          (
            extractionPersistence
              ?.requiere_revision ===
              true
          )
        )
          ? 'requiere_revision'
          : 'completado';

    await connection
      .execute<ResultSetHeader>(
        `
        INSERT INTO incapacidad_analisis (
          incapacidad_id,
          documento_sha256,
          tamano_bytes,
          pdf_version,
          pdf_header_valido,
          pdf_eof_presente,
          pdf_marcador_encriptado,
          estado_estructura,
          puntaje_estructura,
          duplicado_detectado,
          duplicado_de_incapacidad_id,
          estado_analisis,
          proveedor_analisis,
          version_analisis,
          analizado_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          CURRENT_TIMESTAMP
        )
        `,
        [
          id,
          analysis.sha256,
          analysis.sizeBytes,
          analysis.pdfVersion,

          analysis.hasPdfHeader
            ? 1
            : 0,

          analysis.hasEofMarker
            ? 1
            : 0,

          analysis.encryptedMarker
            ? 1
            : 0,

          analysis.structureStatus,
          analysis.structureScore,

          duplicateDetected
            ? 1
            : 0,

          duplicateOfIncapacidadId,
          analysisState,
          'local-deterministico',
          '1',
        ]
      );

    if (
      extractionPersistence
    ) {
      /*
       * Solo se persiste información estructurada.
       * Nunca texto fuente ni OCR completo.
       */
      await connection
        .execute<ResultSetHeader>(
          `
          UPDATE incapacidad_analisis

          SET
            confianza_extraccion = ?,
            campos_extraidos = ?,
            diferencias_detectadas = ?,
            codigo_error = ?

          WHERE incapacidad_id = ?
          `,
          [
            extractionPersistence
              .confianza_extraccion,

            JSON.stringify(
              extractionPersistence
                .campos_extraidos
            ),

            JSON.stringify(
              extractionPersistence
                .diferencias_detectadas
            ),

            extractionPersistence
              .codigo_error,

            id,
          ]
        );
    }


    await connection
      .commit();

    return {
      updated:
        true,

      duplicateOfIncapacidadId,

      analysisState,
    };

  } catch (error) {
    try {
      await connection
        .rollback();
    } catch {
      /*
       * Se preserva el error original.
       */
    }

    throw error;

  } finally {
    let connectionReusable =
      true;

    if (shaLockAcquired) {
      try {
        const [
          releaseRows,
        ] =
          await connection
            .execute<
              (
                RowDataPacket & {
                  released:
                    number | null;
                }
              )[]
            >(
              'SELECT RELEASE_LOCK(?) AS released',
              [
                shaLockName,
              ]
            );

        connectionReusable =
          Number(
            releaseRows?.[0]
              ?.released ??
            0
          ) === 1;

      } catch {
        connectionReusable =
          false;
      }
    }

    if (connectionReusable) {
      connection.release();
    } else {
      /*
       * No devolvemos al pool una conexión
       * cuyo named lock no se pudo liberar
       * de manera verificable.
       */
      connection.destroy();
    }
  }
}


// ============================================================
// LECTURA DE RESULTADOS PARA ADMINISTRACION
// ============================================================

export type IncapacidadAnalysisRow =
  RowDataPacket & {
    incapacidad_id:
      number;

    pdf_version:
      string | null;

    estado_estructura:
      'valido'
      | 'requiere_revision'
      | 'invalido';

    puntaje_estructura:
      number | string;

    duplicado_detectado:
      number;

    duplicado_de_incapacidad_id:
      number | null;

    estado_analisis:
      'pendiente'
      | 'completado'
      | 'requiere_revision'
      | 'error';

    analizado_at:
      Date | string | null;
  };


export async function findIncapacidadAnalysisById(
  incapacidadId:
    number
): Promise<IncapacidadAnalysisRow | null> {
  const [
    rows,
  ] =
    await pool.execute<
      IncapacidadAnalysisRow[]
    >(
      `
      SELECT
        incapacidad_id,
        pdf_version,
        estado_estructura,
        puntaje_estructura,
        duplicado_detectado,
        duplicado_de_incapacidad_id,
        estado_analisis,
        analizado_at
      FROM incapacidad_analisis
      WHERE incapacidad_id = ?
      LIMIT 1
      `,
      [
        incapacidadId,
      ]
    );

  return rows[0] ||
    null;
}


export async function listIncapacidadAnalysesByIds(
  incapacidadIds:
    number[]
): Promise<IncapacidadAnalysisRow[]> {
  if (
    incapacidadIds.length === 0
  ) {
    return [];
  }

  const ids =
    incapacidadIds.filter(
      id =>
        Number.isInteger(
          id
        ) &&
        id > 0
    );

  if (
    ids.length === 0
  ) {
    return [];
  }

  const placeholders =
    ids
      .map(
        () => '?'
      )
      .join(', ');

  const [
    rows,
  ] =
    await pool.query<
      IncapacidadAnalysisRow[]
    >(
      `
      SELECT
        incapacidad_id,
        pdf_version,
        estado_estructura,
        puntaje_estructura,
        duplicado_detectado,
        duplicado_de_incapacidad_id,
        estado_analisis,
        analizado_at
      FROM incapacidad_analisis
      WHERE incapacidad_id
        IN (${placeholders})
      `,
      ids
    );

  return rows;
}
