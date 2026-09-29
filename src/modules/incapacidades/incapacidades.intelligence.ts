import {
  createHash,
} from 'node:crypto';


export type PdfStructureStatus =
  | 'valido'
  | 'requiere_revision'
  | 'invalido';


export type PdfStructureFlag =
  | 'PDF_HEADER_MISSING'
  | 'PDF_EOF_MISSING'
  | 'PDF_ENCRYPTION_MARKER';


export type PdfDeterministicAnalysis = {
  sha256: string;

  sizeBytes: number;

  pdfVersion:
    string | null;

  hasPdfHeader:
    boolean;

  hasEofMarker:
    boolean;

  encryptedMarker:
    boolean;

  structureStatus:
    PdfStructureStatus;

  /*
   * Este valor expresa únicamente confianza
   * en la estructura técnica del PDF.
   *
   * NO representa autenticidad médica.
   */
  structureScore:
    number;

  flags:
    PdfStructureFlag[];
};


/*
 * Huella exacta del archivo.
 *
 * Se utilizará posteriormente para detectar
 * comprobantes idénticos ya presentados.
 *
 * No almacena ni expone el contenido.
 */
export function calculatePdfSha256(
  buffer: Buffer
): string {
  return createHash(
    'sha256'
  )
    .update(
      buffer
    )
    .digest(
      'hex'
    );
}


/*
 * Validación determinística local.
 *
 * No llama servicios externos.
 * No realiza OCR.
 * No interpreta diagnósticos.
 * No afirma que un documento médico sea auténtico.
 */
export function analyzePdfStructure(
  buffer: Buffer
): PdfDeterministicAnalysis {
  const sha256 =
    calculatePdfSha256(
      buffer
    );

  const sizeBytes =
    buffer.length;

  const header =
    buffer
      .subarray(
        0,
        Math.min(
          buffer.length,
          16
        )
      )
      .toString(
        'ascii'
      );

  const versionMatch =
    header.match(
      /^%PDF-(\d\.\d)/
    );

  const hasPdfHeader =
    versionMatch !== null;

  const pdfVersion =
    versionMatch?.[1] ??
    null;

  /*
   * El marcador EOF normalmente aparece al final.
   * Permitimos bytes/espacios posteriores leyendo
   * una ventana final de 8 KiB.
   */
  const tail =
    buffer
      .subarray(
        Math.max(
          0,
          buffer.length -
          8192
        )
      )
      .toString(
        'latin1'
      );

  const hasEofMarker =
    tail.includes(
      '%%EOF'
    );

  /*
   * /Encrypt es un indicador técnico.
   * No implica fraude.
   *
   * Se marca para revisión porque puede impedir
   * extracción local de contenido.
   */
  const encryptedMarker =
    buffer.indexOf(
      Buffer.from(
        '/Encrypt',
        'ascii'
      )
    ) !== -1;

  const flags:
    PdfStructureFlag[] =
      [];

  if (
    !hasPdfHeader
  ) {
    flags.push(
      'PDF_HEADER_MISSING'
    );
  }

  if (
    hasPdfHeader &&
    !hasEofMarker
  ) {
    flags.push(
      'PDF_EOF_MISSING'
    );
  }

  if (
    hasPdfHeader &&
    encryptedMarker
  ) {
    flags.push(
      'PDF_ENCRYPTION_MARKER'
    );
  }

  let structureStatus:
    PdfStructureStatus;

  let structureScore:
    number;

  if (
    !hasPdfHeader
  ) {
    structureStatus =
      'invalido';

    structureScore =
      0;
  } else if (
    !hasEofMarker ||
    encryptedMarker
  ) {
    structureStatus =
      'requiere_revision';

    structureScore =
      0.6;
  } else {
    structureStatus =
      'valido';

    structureScore =
      1;
  }

  return {
    sha256,
    sizeBytes,
    pdfVersion,
    hasPdfHeader,
    hasEofMarker,
    encryptedMarker,
    structureStatus,
    structureScore,
    flags,
  };
}


// ============================================================
// REPRESENTACION SEGURA PARA RRHH
// ============================================================

export type AutomaticValidationSource = {
  pdf_version:
    string | null;

  estado_estructura:
    PdfStructureStatus;

  puntaje_estructura:
    number | string;

  duplicado_detectado:
    boolean | number;

  duplicado_de_incapacidad_id:
    number | null;

  estado_analisis:
    | 'pendiente'
    | 'completado'
    | 'requiere_revision'
    | 'error';

  analizado_at:
    Date | string | null;
};


export type IncapacidadAutomaticValidation = {
  /*
   * Este estado sirve como apoyo para RRHH.
   * Nunca aprueba ni rechaza una incapacidad.
   */
  estado_validacion:
    | 'pendiente'
    | 'consistente'
    | 'requiere_revision';

  analisis_disponible:
    boolean;

  estado_analisis:
    AutomaticValidationSource[
      'estado_analisis'
    ] | null;

  estado_estructura:
    PdfStructureStatus | null;

  puntaje_estructura:
    number | null;

  pdf_version:
    string | null;

  duplicado_detectado:
    boolean;

  duplicado_de_incapacidad_id:
    number | null;

  motivos_revision:
    (
      | 'DOCUMENTO_DUPLICADO'
      | 'ESTRUCTURA_PDF'
      | 'ERROR_ANALISIS'
    )[];

  analizado_at:
    string | null;
};


function normalizeAnalysisDate(
  value:
    Date | string | null
): string | null {
  if (!value) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  return String(
    value
  );
}


/*
 * IMPORTANTE:
 *
 * - No expone SHA-256.
 * - No expone texto médico.
 * - No expone diagnóstico.
 * - No toma decisiones administrativas.
 */
export function buildIncapacidadAutomaticValidation(
  source:
    AutomaticValidationSource | null
): IncapacidadAutomaticValidation {
  if (!source) {
    return {
      estado_validacion:
        'pendiente',

      analisis_disponible:
        false,

      estado_analisis:
        null,

      estado_estructura:
        null,

      puntaje_estructura:
        null,

      pdf_version:
        null,

      duplicado_detectado:
        false,

      duplicado_de_incapacidad_id:
        null,

      motivos_revision:
        [],

      analizado_at:
        null,
    };
  }

  const duplicateDetected =
    source.duplicado_detectado ===
      true ||
    Number(
      source.duplicado_detectado
    ) === 1;

  const motivosRevision:
    IncapacidadAutomaticValidation[
      'motivos_revision'
    ] =
      [];

  if (
    duplicateDetected
  ) {
    motivosRevision.push(
      'DOCUMENTO_DUPLICADO'
    );
  }

  if (
    source.estado_estructura !==
    'valido'
  ) {
    motivosRevision.push(
      'ESTRUCTURA_PDF'
    );
  }

  if (
    source.estado_analisis ===
    'error'
  ) {
    motivosRevision.push(
      'ERROR_ANALISIS'
    );
  }

  let estadoValidacion:
    IncapacidadAutomaticValidation[
      'estado_validacion'
    ];

  if (
    source.estado_analisis ===
    'pendiente'
  ) {
    estadoValidacion =
      'pendiente';

  } else if (
    source.estado_analisis ===
      'completado' &&
    source.estado_estructura ===
      'valido' &&
    !duplicateDetected
  ) {
    estadoValidacion =
      'consistente';

  } else {
    estadoValidacion =
      'requiere_revision';
  }

  const numericScore =
    Number(
      source.puntaje_estructura
    );

  return {
    estado_validacion:
      estadoValidacion,

    analisis_disponible:
      true,

    estado_analisis:
      source.estado_analisis,

    estado_estructura:
      source.estado_estructura,

    puntaje_estructura:
      Number.isFinite(
        numericScore
      )
        ? numericScore
        : null,

    pdf_version:
      source.pdf_version,

    duplicado_detectado:
      duplicateDetected,

    duplicado_de_incapacidad_id:
      duplicateDetected
        ? source
            .duplicado_de_incapacidad_id
        : null,

    motivos_revision:
      motivosRevision,

    analizado_at:
      normalizeAnalysisDate(
        source.analizado_at
      ),
  };
}
