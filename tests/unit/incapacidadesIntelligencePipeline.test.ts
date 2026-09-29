import fs from 'node:fs';

import {
  buildIncapacidadExtractionFallback,
} from '../../src/modules/incapacidades/incapacidades.intelligence.extraction.js';


describe(
  'Incapacidades - pipeline PDF privado',
  () => {
    const pipeline =
      fs.readFileSync(
        'src/modules/incapacidades/incapacidades.intelligence.pipeline.ts',
        'utf8'
      );


    const service =
      fs.readFileSync(
        'src/modules/incapacidades/incapacidades.service.ts',
        'utf8'
      );


    test(
      'fallback exige revisión sin inventar campos',
      () => {
        const result =
          buildIncapacidadExtractionFallback(
            'PDF_TEXT_EXTRACTION_FAILED'
          );


        expect(
          result.confianza_extraccion
        ).toBe(
          0
        );


        expect(
          result.codigo_error
        ).toBe(
          'PDF_TEXT_EXTRACTION_FAILED'
        );


        expect(
          result.requiere_revision
        ).toBe(
          true
        );


        expect(
          Object.values(
            result.campos_extraidos
          ).every(
            value =>
              value === null
          )
        ).toBe(
          true
        );


        expect(
          result
            .diferencias_detectadas
            .campos_comparados
        ).toEqual(
          []
        );


        expect(
          result
            .diferencias_detectadas
            .diferencias
        ).toEqual(
          []
        );


        expect(
          result
            .diferencias_detectadas
            .consistente
        ).toBeNull();
      }
    );


    test(
      'soporta cuatro códigos de fallback',
      () => {
        const codes = [
          'PDF_TEXT_EXTRACTION_FAILED',
          'PDF_TOO_MANY_PAGES',
          'PDF_WITHOUT_TEXT',
          'PDF_TEXT_TRUNCATED',
        ] as const;


        for (
          const code of codes
        ) {
          const result =
            buildIncapacidadExtractionFallback(
              code
            );


          expect(
            result.codigo_error
          ).toBe(
            code
          );


          expect(
            result.requiere_revision
          ).toBe(
            true
          );
        }
      }
    );


    test(
      'pipeline conecta PDF parser comparador y persistencia',
      () => {
        expect(
          pipeline
        ).toContain(
          'extractLocalPdfText'
        );


        expect(
          pipeline
        ).toContain(
          'extractIncapacidadFieldsFromText'
        );


        expect(
          pipeline
        ).toContain(
          'compareIncapacidadExtractedFields'
        );


        expect(
          pipeline
        ).toContain(
          'buildIncapacidadExtractionPersistence'
        );


        expect(
          pipeline
        ).toContain(
          'buildIncapacidadExtractionFallback'
        );
      }
    );


    test(
      'no retorna ni registra texto fuente',
      () => {
        expect(
          pipeline
        ).not.toMatch(
          /return\s+pdfText\.texto/i
        );


        expect(
          pipeline
        ).not.toMatch(
          /texto_fuente|raw_ocr|ocr_text|texto_completo/i
        );


        expect(
          pipeline
        ).not.toMatch(
          /console\.(log|warn|error)/i
        );
      }
    );


    test(
      'service analiza antes de storage',
      () => {
        const start =
          service.indexOf(
            'export async function attachIncapacidadComprobante'
          );


        expect(
          start
        ).toBeGreaterThan(
          -1
        );


        const attach =
          service.slice(
            start
          );


        const analysis =
          attach.indexOf(
            'await analyzeIncapacidadPdfFields('
          );


        const storage =
          attach.indexOf(
            'await writeStorageObject('
          );


        expect(
          analysis
        ).toBeGreaterThan(
          -1
        );


        expect(
          storage
        ).toBeGreaterThan(
          analysis
        );
      }
    );


    test(
      'service usa las declaraciones persistidas',
      () => {
        expect(
          service
        ).toContain(
          'current.fecha_inicio'
        );


        expect(
          service
        ).toContain(
          'current.fecha_fin'
        );


        expect(
          service
        ).toContain(
          'current.dias_calculados'
        );
      }
    );


    test(
      'repository recibe extractionPersistence después de analysis',
      () => {
        const start =
          service.indexOf(
            'export async function attachIncapacidadComprobante'
          );


        const attach =
          service.slice(
            start
          );


        const callStart =
          attach.indexOf(
            'await setIncapacidadComprobanteWithAnalysis('
          );


        expect(
          callStart
        ).toBeGreaterThan(
          -1
        );


        const callEnd =
          attach.indexOf(
            ');',
            callStart
          );


        expect(
          callEnd
        ).toBeGreaterThan(
          callStart
        );


        const call =
          attach.slice(
            callStart,
            callEnd + 2
          );


        const size =
          call.indexOf(
            'proof.size'
          );


        const analysis =
          call.lastIndexOf(
            'analysis'
          );


        const extraction =
          call.indexOf(
            'extractionPersistence'
          );


        expect(
          size
        ).toBeGreaterThan(
          -1
        );


        expect(
          analysis
        ).toBeGreaterThan(
          size
        );


        expect(
          extraction
        ).toBeGreaterThan(
          analysis
        );


        expect(
          (
            call.match(
              /extractionPersistence/g
            ) ||
            []
          ).length
        ).toBe(
          1
        );
      }
    );


    test(
      'no referencia proveedores externos',
      () => {
        const provider =
          /\bopenai\b|\banthropic\b|\bgemini\b|\b(?:aws[\s_.-]*)?textract\b|\bgoogle[\s_.-]*vision\b|\bazure[\s_.-]*vision\b/i;


        expect(
          pipeline
        ).not.toMatch(
          provider
        );
      }
    );


    test(
      'no procesa diagnóstico médico',
      () => {
        expect(
          pipeline
        ).not.toMatch(
          /diagnostico|diagnóstico/i
        );
      }
    );
  }
);
