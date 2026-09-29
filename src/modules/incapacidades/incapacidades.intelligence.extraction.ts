export type IncapacidadExtractedFields = {
  fecha_inicio:
    string | null;

  fecha_fin:
    string | null;

  dias:
    number | null;

  institucion:
    string | null;

  medico:
    string | null;

  folio:
    string | null;
};


export type IncapacidadExtractionResult = {
  campos:
    IncapacidadExtractedFields;

  confianza:
    number;

  campos_detectados:
    number;
};


export type IncapacidadDeclaredFields = {
  fecha_inicio:
    string;

  fecha_fin:
    string;

  dias_calculados:
    number;
};


export type IncapacidadComparableField =
  | 'fecha_inicio'
  | 'fecha_fin'
  | 'dias_calculados';


export type IncapacidadFieldDifference = {
  campo:
    IncapacidadComparableField;

  declarado:
    string | number;

  detectado:
    string | number;
};


export type IncapacidadComparisonResult = {
  campos_comparados:
    IncapacidadComparableField[];

  diferencias:
    IncapacidadFieldDifference[];

  consistente:
    boolean | null;
};


const DATE_TOKEN =
  '(?:\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}|\\d{1,2}[./-]\\d{1,2}[./-]\\d{4})';


function normalizeText(
  value: string
): string {
  return String(
    value || ''
  )
    .normalize(
      'NFKC'
    )
    .replace(
      /\r\n?/g,
      '\n'
    )
    .replace(
      /\u00a0/g,
      ' '
    )
    .split(
      '\n'
    )
    .map(
      line =>
        line
          .replace(
            /[ \t]+/g,
            ' '
          )
          .trim()
    )
    .filter(Boolean)
    .join(
      '\n'
    );
}


function safeSingleLine(
  value:
    string | undefined,
  maxLength:
    number
): string | null {
  if (!value) {
    return null;
  }


  const cleaned =
    value
      .replace(
        /[ \t]+/g,
        ' '
      )
      .replace(
        /^[\s:;\-–—]+/,
        ''
      )
      .replace(
        /[\s:;,.\-–—]+$/,
        ''
      )
      .trim();


  if (!cleaned) {
    return null;
  }


  return cleaned
    .slice(
      0,
      maxLength
    );
}


function normalizeIsoDate(
  value:
    string | undefined
): string | null {
  if (!value) {
    return null;
  }


  const cleaned =
    value
      .trim()
      .replace(
        /[.]/g,
        '-'
      )
      .replace(
        /\//g,
        '-'
      );


  const parts =
    cleaned.split(
      '-'
    );


  if (parts.length !== 3) {
    return null;
  }


  let year:
    number;

  let month:
    number;

  let day:
    number;


  if (
    parts[0].length === 4
  ) {
    year =
      Number(
        parts[0]
      );

    month =
      Number(
        parts[1]
      );

    day =
      Number(
        parts[2]
      );

  } else {
    day =
      Number(
        parts[0]
      );

    month =
      Number(
        parts[1]
      );

    year =
      Number(
        parts[2]
      );
  }


  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }


  const candidate =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );


  if (
    candidate.getUTCFullYear() !==
      year ||
    candidate.getUTCMonth() !==
      month - 1 ||
    candidate.getUTCDate() !==
      day
  ) {
    return null;
  }


  return [
    String(
      year
    ).padStart(
      4,
      '0'
    ),

    String(
      month
    ).padStart(
      2,
      '0'
    ),

    String(
      day
    ).padStart(
      2,
      '0'
    ),
  ].join(
    '-'
  );
}


function firstMatch(
  text:
    string,
  patterns:
    RegExp[]
): string | null {
  for (
    const pattern of patterns
  ) {
    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {
      return match[1];
    }
  }


  return null;
}


function extractDate(
  text:
    string,
  labels:
    string[]
): string | null {
  for (
    const label of labels
  ) {
    const pattern =
      new RegExp(
        `(?:^|\\n)\\s*(?:${label})\\s*[:\\-–—]?\\s*(${DATE_TOKEN})\\b`,
        'iu'
      );


    const match =
      text.match(
        pattern
      );


    if (
      match?.[1]
    ) {
      return normalizeIsoDate(
        match[1]
      );
    }
  }


  return null;
}


function extractDays(
  text:
    string
): number | null {
  const patterns = [
    /(?:^|\n)\s*d[ií]as\s+autorizados\s*[:\-–—]?\s*(\d{1,3})\b/iu,

    /(?:^|\n)\s*d[ií]as\s+otorgados\s*[:\-–—]?\s*(\d{1,3})\b/iu,

    /(?:^|\n)\s*d[ií]as\s+de\s+incapacidad\s*[:\-–—]?\s*(\d{1,3})\b/iu,

    /(?:^|\n)\s*duraci[oó]n\s*[:\-–—]?\s*(\d{1,3})\s*d[ií]as?\b/iu,
  ];


  const raw =
    firstMatch(
      text,
      patterns
    );


  if (!raw) {
    return null;
  }


  const days =
    Number(
      raw
    );


  if (
    !Number.isInteger(days) ||
    days < 1 ||
    days > 365
  ) {
    return null;
  }


  return days;
}


function extractInstitution(
  text:
    string
): string | null {
  const labeled =
    firstMatch(
      text,
      [
        /(?:^|\n)\s*instituci[oó]n\s*[:\-–—]\s*([^\n]{2,120})/iu,

        /(?:^|\n)\s*instituto\s*[:\-–—]\s*([^\n]{2,120})/iu,

        /(?:^|\n)\s*unidad\s+m[eé]dica\s*[:\-–—]\s*([^\n]{2,120})/iu,
      ]
    );


  const cleanLabeled =
    safeSingleLine(
      labeled || undefined,
      120
    );


  if (cleanLabeled) {
    return cleanLabeled;
  }


  const known =
    text.match(
      /\b(IMSS|ISSSTE|PEMEX|SEDENA|SEMAR)\b/iu
    );


  return known?.[1]
    ?.toUpperCase() ||
    null;
}


function extractDoctor(
  text:
    string
): string | null {
  const raw =
    firstMatch(
      text,
      [
        /(?:^|\n)\s*m[eé]dico\s+tratante\s*[:\-–—]\s*([^\n]{3,100})/iu,

        /(?:^|\n)\s*m[eé]dico\s*[:\-–—]\s*([^\n]{3,100})/iu,

        /(?:^|\n)\s*doctor(?:a)?\s*[:\-–—]\s*([^\n]{3,100})/iu,

        /(?:^|\n)\s*dr(?:a)?\.?\s*[:\-–—]?\s*([^\n]{3,100})/iu,
      ]
    );


  return safeSingleLine(
    raw || undefined,
    100
  );
}


function extractFolio(
  text:
    string
): string | null {
  const raw =
    firstMatch(
      text,
      [
        /(?:^|\n)\s*folio\s*[:\-–—]\s*([A-Z0-9./_-]{3,80})/iu,

        /(?:^|\n)\s*n[uú]mero\s+de\s+certificado\s*[:\-–—]\s*([A-Z0-9./_-]{3,80})/iu,

        /(?:^|\n)\s*certificado\s*[:\-–—]\s*([A-Z0-9./_-]{3,80})/iu,

        /(?:^|\n)\s*incapacidad\s+(?:n[uú]mero|no\.?)\s*[:\-–—]?\s*([A-Z0-9./_-]{3,80})/iu,
      ]
    );


  return safeSingleLine(
    raw || undefined,
    80
  );
}


function calculateConfidence(
  fields:
    IncapacidadExtractedFields
): number {
  let score =
    0;


  if (
    fields.fecha_inicio
  ) {
    score +=
      0.25;
  }


  if (
    fields.fecha_fin
  ) {
    score +=
      0.25;
  }


  if (
    fields.dias !==
      null
  ) {
    score +=
      0.15;
  }


  if (
    fields.institucion
  ) {
    score +=
      0.15;
  }


  if (
    fields.medico
  ) {
    score +=
      0.10;
  }


  if (
    fields.folio
  ) {
    score +=
      0.10;
  }


  return Number(
    Math.min(
      1,
      Math.max(
        0,
        score
      )
    ).toFixed(
      4
    )
  );
}


export function extractIncapacidadFieldsFromText(
  input:
    string
): IncapacidadExtractionResult {
  const text =
    normalizeText(
      input
    );


  if (!text) {
    return {
      campos: {
        fecha_inicio:
          null,

        fecha_fin:
          null,

        dias:
          null,

        institucion:
          null,

        medico:
          null,

        folio:
          null,
      },

      confianza:
        0,

      campos_detectados:
        0,
    };
  }


  const campos:
    IncapacidadExtractedFields = {
      fecha_inicio:
        extractDate(
          text,
          [
            'fecha\\s+de\\s+inicio',
            'inicio\\s+de\\s+incapacidad',
            'inicio',
            'desde',
          ]
        ),

      fecha_fin:
        extractDate(
          text,
          [
            'fecha\\s+de\\s+fin',
            'fin\\s+de\\s+incapacidad',
            'fin',
            'hasta',
          ]
        ),

      dias:
        extractDays(
          text
        ),

      institucion:
        extractInstitution(
          text
        ),

      medico:
        extractDoctor(
          text
        ),

      folio:
        extractFolio(
          text
        ),
    };


  const camposDetectados =
    Object
      .values(
        campos
      )
      .filter(
        value =>
          value !== null
      )
      .length;


  return {
    campos,

    confianza:
      calculateConfidence(
        campos
      ),

    campos_detectados:
      camposDetectados,
  };
}


export function compareIncapacidadExtractedFields(
  extracted:
    IncapacidadExtractedFields,
  declared:
    IncapacidadDeclaredFields
): IncapacidadComparisonResult {
  const camposComparados:
    IncapacidadComparableField[] =
      [];

  const diferencias:
    IncapacidadFieldDifference[] =
      [];


  const declaredStart =
    normalizeIsoDate(
      declared.fecha_inicio
    );

  const declaredEnd =
    normalizeIsoDate(
      declared.fecha_fin
    );


  if (
    extracted.fecha_inicio &&
    declaredStart
  ) {
    camposComparados.push(
      'fecha_inicio'
    );


    if (
      extracted.fecha_inicio !==
      declaredStart
    ) {
      diferencias.push({
        campo:
          'fecha_inicio',

        declarado:
          declaredStart,

        detectado:
          extracted.fecha_inicio,
      });
    }
  }


  if (
    extracted.fecha_fin &&
    declaredEnd
  ) {
    camposComparados.push(
      'fecha_fin'
    );


    if (
      extracted.fecha_fin !==
      declaredEnd
    ) {
      diferencias.push({
        campo:
          'fecha_fin',

        declarado:
          declaredEnd,

        detectado:
          extracted.fecha_fin,
      });
    }
  }


  if (
    extracted.dias !== null &&
    Number.isInteger(
      declared.dias_calculados
    ) &&
    declared.dias_calculados > 0
  ) {
    camposComparados.push(
      'dias_calculados'
    );


    if (
      extracted.dias !==
      declared.dias_calculados
    ) {
      diferencias.push({
        campo:
          'dias_calculados',

        declarado:
          declared.dias_calculados,

        detectado:
          extracted.dias,
      });
    }
  }


  return {
    campos_comparados:
      camposComparados,

    diferencias,

    consistente:
      camposComparados.length === 0
        ? null
        : diferencias.length === 0,
  };
}


export type IncapacidadExtractionErrorCode =
  | 'PDF_TEXT_EXTRACTION_FAILED'
  | 'PDF_TOO_MANY_PAGES'
  | 'PDF_WITHOUT_TEXT'
  | 'PDF_TEXT_TRUNCATED';


export type IncapacidadExtractionPersistencePayload = {
  confianza_extraccion:
    number;

  campos_extraidos: {
    fecha_inicio:
      string | null;

    fecha_fin:
      string | null;

    dias:
      number | null;

    institucion:
      string | null;

    medico:
      string | null;

    folio:
      string | null;
  };

  diferencias_detectadas: {
    campos_comparados:
      IncapacidadComparableField[];

    diferencias:
      IncapacidadFieldDifference[];

    consistente:
      boolean | null;
  };

  codigo_error:
    IncapacidadExtractionErrorCode | null;

  requiere_revision:
    boolean;
};


export function buildIncapacidadExtractionPersistence(
  extraction:
    IncapacidadExtractionResult,
  comparison:
    IncapacidadComparisonResult
): IncapacidadExtractionPersistencePayload {
  /*
   * El texto fuente NO forma parte del payload.
   *
   * El análisis requiere revisión cuando:
   * - existen discrepancias;
   * - no hubo campos comparables;
   * - la confianza determinística es menor a 0.60.
   *
   * Esto NO aprueba ni rechaza la incapacidad.
   */
  const requiresReview =
    comparison.consistente !==
      true ||
    extraction.confianza <
      0.60;


  return {
    confianza_extraccion:
      extraction.confianza,

    campos_extraidos: {
      fecha_inicio:
        extraction
          .campos
          .fecha_inicio,

      fecha_fin:
        extraction
          .campos
          .fecha_fin,

      dias:
        extraction
          .campos
          .dias,

      institucion:
        extraction
          .campos
          .institucion,

      medico:
        extraction
          .campos
          .medico,

      folio:
        extraction
          .campos
          .folio,
    },

    diferencias_detectadas: {
      campos_comparados:
        comparison
          .campos_comparados,

      diferencias:
        comparison
          .diferencias,

      consistente:
        comparison
          .consistente,
    },

    codigo_error:
      null,

    requiere_revision:
      requiresReview,
  };
}



// ============================================================
// FALLBACK SEGURO DE EXTRACCION
// ============================================================

export function buildIncapacidadExtractionFallback(
  code:
    IncapacidadExtractionErrorCode
): IncapacidadExtractionPersistencePayload {
  /*
   * Un fallo de extracción no constituye
   * aprobación ni rechazo.
   *
   * RRHH mantiene la decisión final.
   */
  return {
    confianza_extraccion:
      0,

    campos_extraidos: {
      fecha_inicio:
        null,

      fecha_fin:
        null,

      dias:
        null,

      institucion:
        null,

      medico:
        null,

      folio:
        null,
    },

    diferencias_detectadas: {
      campos_comparados:
        [],

      diferencias:
        [],

      consistente:
        null,
    },

    codigo_error:
      code,

    requiere_revision:
      true,
  };
}
