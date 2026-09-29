import {
  AppError,
} from '../../utils/AppError.js';


const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}$/;


function parseIsoDate(
  value: string,
  fieldName: string
): Date {
  const normalized =
    String(value || '').trim();

  if (
    !ISO_DATE_PATTERN.test(
      normalized
    )
  ) {
    throw new AppError(
      `${fieldName} debe tener formato YYYY-MM-DD`,
      400
    );
  }

  const [
    year,
    month,
    day,
  ] =
    normalized
      .split('-')
      .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError(
      `${fieldName} no es una fecha válida`,
      400
    );
  }

  return date;
}


export function calculateInclusiveDays(
  startValue: string,
  endValue: string
): number {
  const start =
    parseIsoDate(
      startValue,
      'fecha_inicio'
    );

  const end =
    parseIsoDate(
      endValue,
      'fecha_fin'
    );

  if (
    end.getTime() <
    start.getTime()
  ) {
    throw new AppError(
      'fecha_fin no puede ser anterior a fecha_inicio',
      400
    );
  }

  const millisecondsPerDay =
    24 * 60 * 60 * 1000;

  return (
    Math.floor(
      (
        end.getTime() -
        start.getTime()
      ) /
      millisecondsPerDay
    ) + 1
  );
}


export type ReviewState =
  | 'aprobada'
  | 'rechazada';


export function normalizeReviewState(
  value: unknown
): ReviewState {
  const state =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    state !== 'aprobada' &&
    state !== 'rechazada'
  ) {
    throw new AppError(
      'estado debe ser aprobada o rechazada',
      400
    );
  }

  return state;
}


export function normalizeReason(
  value: unknown
): string {
  const reason =
    String(value || '')
      .trim();

  if (reason.length < 3) {
    throw new AppError(
      'motivo es obligatorio',
      400
    );
  }

  if (reason.length > 500) {
    throw new AppError(
      'motivo no puede exceder 500 caracteres',
      400
    );
  }

  return reason;
}


export function normalizeAdminObservation(
  value: unknown
): string | null {
  const observation =
    String(value || '')
      .trim();

  if (!observation) {
    return null;
  }

  if (observation.length > 1000) {
    throw new AppError(
      'observaciones_admin no puede exceder 1000 caracteres',
      400
    );
  }

  return observation;
}



// ============================================================
// COMPROBANTE MÉDICO — GI-HU02
// ============================================================

export const MAX_INCAPACIDAD_PROOF_BYTES =
  5 * 1024 * 1024;


export type IncapacidadProof = {
  buffer: Buffer;
  originalName: string;
  mime: 'application/pdf';
  extension: 'pdf';
  size: number;
};


function sanitizeProofName(
  value: unknown
): string {
  const safe =
    String(
      value || 'comprobante'
    )
      .trim()
      .replace(
        /[\/\\\x00-\x1f\x7f]+/g,
        '_'
      )
      .slice(
        0,
        180
      );

  return safe || 'comprobante';
}


function normalizeBase64Payload(
  value: unknown
): string {
  const raw =
    String(
      value || ''
    ).trim();

  if (!raw) {
    throw new AppError(
      'El comprobante es obligatorio',
      400
    );
  }

  const dataUrl =
    raw.match(
      /^data:[^;,]+;base64,([\s\S]*)$/i
    );

  let payload =
    dataUrl
      ? dataUrl[1]
      : raw;

  payload =
    payload.replace(
      /\s+/g,
      ''
    );

  if (
    !payload ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(
      payload
    ) ||
    payload.length % 4 === 1
  ) {
    throw new AppError(
      'El comprobante Base64 no es válido',
      400
    );
  }

  while (
    payload.length % 4 !== 0
  ) {
    payload += '=';
  }

  return payload;
}


function detectProofType(
  buffer: Buffer
): {
  mime: IncapacidadProof['mime'];
  extension: IncapacidadProof['extension'];
} {
  /*
   * No confiar en el nombre ni en el MIME enviado
   * por el cliente.
   *
   * Incapacidades acepta exclusivamente PDF y el
   * backend verifica la firma binaria real %PDF-.
   */
  const isPdf =
    buffer.length >= 5 &&
    buffer
      .subarray(
        0,
        5
      )
      .toString(
        'ascii'
      ) === '%PDF-';

  if (!isPdf) {
    throw new AppError(
      'Formato de comprobante no permitido. Solo se aceptan archivos PDF',
      400
    );
  }

  return {
    mime:
      'application/pdf',

    extension:
      'pdf',
  };
}

export function prepareIncapacidadProof(
  base64: unknown,
  filename?: unknown
): IncapacidadProof {
  const payload =
    normalizeBase64Payload(
      base64
    );

  const buffer =
    Buffer.from(
      payload,
      'base64'
    );

  if (
    buffer.length === 0
  ) {
    throw new AppError(
      'El comprobante está vacío',
      400
    );
  }

  if (
    buffer.length >
    MAX_INCAPACIDAD_PROOF_BYTES
  ) {
    throw new AppError(
      'El comprobante no puede exceder 5 MB',
      413
    );
  }

  const detected =
    detectProofType(
      buffer
    );

  return {
    buffer,
    originalName:
      sanitizeProofName(
        filename
      ),
    mime:
      detected.mime,
    extension:
      detected.extension,
    size:
      buffer.length,
  };
}
