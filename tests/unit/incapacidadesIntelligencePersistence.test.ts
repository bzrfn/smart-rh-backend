import fs from 'node:fs';

import {
  buildIncapacidadExtractionPersistence,
  compareIncapacidadExtractedFields,
  extractIncapacidadFieldsFromText,
} from '../../src/modules/incapacidades/incapacidades.intelligence.extraction.js';


function read(
  path: string
): string {
  return fs.readFileSync(
    path,
    'utf8'
  );
}


describe(
  'Incapacidades - persistencia privada de extracción',
  () => {
    test(
      'construye payload consistente sin texto fuente',
      () => {
        const marker =
          'TEXTO_PRIVADO_NO_PERSISTIR';


        const extraction =
          extractIncapacidadFieldsFromText(
            [
              marker,
              'Institución: IMSS',
              'Folio: INC-2026-001',
              'Médico: Dra. Ejemplo',
              'Fecha de inicio: 28/09/2026',
              'Fecha de fin: 30/09/2026',
              'Días autorizados: 3',
            ].join(
              '\n'
            )
          );


        const comparison =
          compareIncapacidadExtractedFields(
            extraction.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        const payload =
          buildIncapacidadExtractionPersistence(
            extraction,
            comparison
          );


        expect(
          payload.confianza_extraccion
        ).toBe(
          1
        );


        expect(
          payload.requiere_revision
        ).toBe(
          false
        );


        expect(
          payload.codigo_error
        ).toBeNull();


        expect(
          JSON.stringify(
            payload
          )
        ).not.toContain(
          marker
        );
      }
    );


    test(
      'discrepancia obliga revisión humana',
      () => {
        const extraction =
          extractIncapacidadFieldsFromText(
            [
              'Fecha de inicio: 29/09/2026',
              'Fecha de fin: 02/10/2026',
              'Días autorizados: 4',
            ].join(
              '\n'
            )
          );


        const comparison =
          compareIncapacidadExtractedFields(
            extraction.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        const payload =
          buildIncapacidadExtractionPersistence(
            extraction,
            comparison
          );


        expect(
          payload.requiere_revision
        ).toBe(
          true
        );


        expect(
          payload
            .diferencias_detectadas
            .diferencias
            .length
        ).toBe(
          3
        );
      }
    );


    test(
      'baja confianza requiere revisión',
      () => {
        const extraction =
          extractIncapacidadFieldsFromText(
            'Institución: ISSSTE'
          );


        const comparison =
          compareIncapacidadExtractedFields(
            extraction.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        const payload =
          buildIncapacidadExtractionPersistence(
            extraction,
            comparison
          );


        expect(
          payload.confianza_extraccion
        ).toBeLessThan(
          0.60
        );


        expect(
          payload.requiere_revision
        ).toBe(
          true
        );
      }
    );


    test(
      'repository persiste únicamente JSON estructurado',
      () => {
        const repository =
          read(
            'src/modules/incapacidades/incapacidades.intelligence.repository.ts'
          );


        const start =
          repository.indexOf(
            'export async function setIncapacidadComprobanteWithAnalysis('
          );

        const end =
          repository.indexOf(
            '// ============================================================',
            start
          );

        const scope =
          repository.slice(
            start,
            end
          );


        expect(
          scope
        ).toContain(
          'confianza_extraccion = ?'
        );


        expect(
          scope
        ).toContain(
          'campos_extraidos = ?'
        );


        expect(
          scope
        ).toContain(
          'diferencias_detectadas = ?'
        );


        expect(
          scope
        ).toContain(
          'codigo_error = ?'
        );


        expect(
          scope
        ).toContain(
          'JSON.stringify('
        );


        expect(
          scope
        ).not.toMatch(
          /texto_ocr|ocr_text|texto_completo|raw_ocr|base64/i
        );
      }
    );


    test(
      'extracción sigue siendo opcional para upload actual',
      () => {
        const repository =
          read(
            'src/modules/incapacidades/incapacidades.intelligence.repository.ts'
          );


        expect(
          repository
        ).toContain(
          'IncapacidadExtractionPersistencePayload | null ='
        );


        expect(
          repository
        ).toContain(
          'null\n): Promise<IncapacidadAnalysisPersistenceResult>'
        );
      }
    );


    test(
      'resultado de extracción puede elevar estado a requiere_revision',
      () => {
        const repository =
          read(
            'src/modules/incapacidades/incapacidades.intelligence.repository.ts'
          );


        expect(
          repository
        ).toContain(
          'extractionPersistence'
        );


        expect(
          repository
        ).toContain(
          '?.requiere_revision'
        );


        expect(
          repository
        ).toContain(
          "'requiere_revision'"
        );
      }
    );


    test(
      'persistencia ocurre antes del commit',
      () => {
        const repository =
          read(
            'src/modules/incapacidades/incapacidades.intelligence.repository.ts'
          );


        const start =
          repository.indexOf(
            'export async function setIncapacidadComprobanteWithAnalysis('
          );

        const end =
          repository.indexOf(
            '// ============================================================',
            start
          );

        const scope =
          repository.slice(
            start,
            end
          );


        const update =
          scope.indexOf(
            'confianza_extraccion = ?'
          );

        const commit =
          scope.indexOf(
            '.commit()'
          );


        expect(
          update
        ).toBeGreaterThanOrEqual(
          0
        );


        expect(
          commit
        ).toBeGreaterThan(
          update
        );
      }
    );


    test(
      'payload no contiene diagnóstico',
      () => {
        const extraction =
          extractIncapacidadFieldsFromText(
            [
              'Institución: IMSS',
              'Folio: TEST-001',
            ].join(
              '\n'
            )
          );


        const comparison =
          compareIncapacidadExtractedFields(
            extraction.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        const payload =
          buildIncapacidadExtractionPersistence(
            extraction,
            comparison
          );


        expect(
          JSON.stringify(
            payload
          )
        ).not.toMatch(
          /diagnostico|diagnóstico/i
        );
      }
    );
  }
);
