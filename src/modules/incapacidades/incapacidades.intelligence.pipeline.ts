import {
  buildIncapacidadExtractionFallback,
  buildIncapacidadExtractionPersistence,
  compareIncapacidadExtractedFields,
  extractIncapacidadFieldsFromText,
} from './incapacidades.intelligence.extraction.js';

import type {
  IncapacidadDeclaredFields,
  IncapacidadExtractionPersistencePayload,
} from './incapacidades.intelligence.extraction.js';

import {
  extractLocalPdfText,
  LocalPdfTextExtractionError,
} from './incapacidades.intelligence.pdf.js';


export async function analyzeIncapacidadPdfFields(
  buffer:
    Buffer,

  declared:
    IncapacidadDeclaredFields
): Promise<
  IncapacidadExtractionPersistencePayload
> {
  /*
   * Todo el análisis ocurre localmente.
   *
   * El texto completo del PDF es transitorio
   * y jamás forma parte del payload retornado.
   */
  try {
    const pdfText =
      await extractLocalPdfText(
        buffer
      );


    if (
      pdfText.truncado
    ) {
      return buildIncapacidadExtractionFallback(
        'PDF_TEXT_TRUNCATED'
      );
    }


    if (
      !pdfText.tiene_texto
    ) {
      /*
       * Puede ser un documento escaneado.
       * No existe OCR habilitado.
       */
      return buildIncapacidadExtractionFallback(
        'PDF_WITHOUT_TEXT'
      );
    }


    const extraction =
      extractIncapacidadFieldsFromText(
        pdfText.texto
      );


    const comparison =
      compareIncapacidadExtractedFields(
        extraction.campos,
        declared
      );


    return buildIncapacidadExtractionPersistence(
      extraction,
      comparison
    );

  } catch (error) {
    if (
      error instanceof
      LocalPdfTextExtractionError
    ) {
      if (
        error.code ===
        'PDF_TOO_MANY_PAGES'
      ) {
        return buildIncapacidadExtractionFallback(
          'PDF_TOO_MANY_PAGES'
        );
      }


      return buildIncapacidadExtractionFallback(
        'PDF_TEXT_EXTRACTION_FAILED'
      );
    }


    /*
     * Fallo inesperado:
     * nunca expone detalles del parser y
     * nunca decide por RRHH.
     */
    return buildIncapacidadExtractionFallback(
      'PDF_TEXT_EXTRACTION_FAILED'
    );
  }
}
