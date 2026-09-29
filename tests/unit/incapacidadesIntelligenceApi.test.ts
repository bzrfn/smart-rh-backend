import fs from 'node:fs';

import {
  buildIncapacidadAutomaticValidation,
} from '../../src/modules/incapacidades/incapacidades.intelligence.js';


describe(
  'Incapacidades inteligentes - contrato API administrativo',
  () => {
    test(
      'sin análisis devuelve estado pendiente',
      () => {
        const result =
          buildIncapacidadAutomaticValidation(
            null
          );

        expect(
          result.estado_validacion
        ).toBe(
          'pendiente'
        );

        expect(
          result.analisis_disponible
        ).toBe(
          false
        );

        expect(
          result.duplicado_detectado
        ).toBe(
          false
        );
      }
    );


    test(
      'PDF válido sin duplicado se reporta consistente',
      () => {
        const result =
          buildIncapacidadAutomaticValidation({
            pdf_version:
              '1.7',

            estado_estructura:
              'valido',

            puntaje_estructura:
              '1.0000',

            duplicado_detectado:
              0,

            duplicado_de_incapacidad_id:
              null,

            estado_analisis:
              'completado',

            analizado_at:
              '2026-09-28 18:00:00',
          });

        expect(
          result.estado_validacion
        ).toBe(
          'consistente'
        );

        expect(
          result.motivos_revision
        ).toEqual(
          []
        );

        expect(
          result.puntaje_estructura
        ).toBe(
          1
        );
      }
    );


    test(
      'duplicado requiere revisión pero no rechazo',
      () => {
        const result =
          buildIncapacidadAutomaticValidation({
            pdf_version:
              '1.7',

            estado_estructura:
              'valido',

            puntaje_estructura:
              1,

            duplicado_detectado:
              1,

            duplicado_de_incapacidad_id:
              15,

            estado_analisis:
              'requiere_revision',

            analizado_at:
              null,
          });

        expect(
          result.estado_validacion
        ).toBe(
          'requiere_revision'
        );

        expect(
          result.duplicado_detectado
        ).toBe(
          true
        );

        expect(
          result.motivos_revision
        ).toContain(
          'DOCUMENTO_DUPLICADO'
        );
      }
    );


    test(
      'estructura dudosa requiere revisión',
      () => {
        const result =
          buildIncapacidadAutomaticValidation({
            pdf_version:
              '1.4',

            estado_estructura:
              'requiere_revision',

            puntaje_estructura:
              0.6,

            duplicado_detectado:
              0,

            duplicado_de_incapacidad_id:
              null,

            estado_analisis:
              'requiere_revision',

            analizado_at:
              null,
          });

        expect(
          result.estado_validacion
        ).toBe(
          'requiere_revision'
        );

        expect(
          result.motivos_revision
        ).toContain(
          'ESTRUCTURA_PDF'
        );
      }
    );


    test(
      'DTO no contiene SHA ni texto médico',
      () => {
        const result =
          buildIncapacidadAutomaticValidation({
            pdf_version:
              '1.7',

            estado_estructura:
              'valido',

            puntaje_estructura:
              1,

            duplicado_detectado:
              0,

            duplicado_de_incapacidad_id:
              null,

            estado_analisis:
              'completado',

            analizado_at:
              null,
          });

        const serialized =
          JSON.stringify(
            result
          );

        expect(
          serialized
        ).not.toMatch(
          /sha256/i
        );

        expect(
          serialized
        ).not.toMatch(
          /diagnostico|texto_ocr|ocr_text/i
        );
      }
    );


    test(
      'service mantiene validación inteligente fuera de mias',
      () => {
        const service =
          fs.readFileSync(
            'src/modules/incapacidades/incapacidades.service.ts',
            'utf8'
          );

        const ownStart =
          service.indexOf(
            'export async function getOwnIncapacidades'
          );

        const detailStart =
          service.indexOf(
            'export async function getIncapacidadDetail'
          );

        const ownScope =
          service.slice(
            ownStart,
            detailStart
          );

        expect(
          ownScope
        ).not.toContain(
          'validacion_automatica'
        );

        expect(
          ownScope
        ).not.toContain(
          'findIncapacidadAnalysisById'
        );
      }
    );


    test(
      'lista administrativa usa lectura batch',
      () => {
        const service =
          fs.readFileSync(
            'src/modules/incapacidades/incapacidades.service.ts',
            'utf8'
          );

        expect(
          service
        ).toContain(
          'listIncapacidadAnalysesByIds'
        );

        expect(
          service
        ).toContain(
          'validacion_automatica'
        );
      }
    );


    test(
      'repository de lectura no selecciona SHA para API',
      () => {
        const repository =
          fs.readFileSync(
            'src/modules/incapacidades/incapacidades.intelligence.repository.ts',
            'utf8'
          );

        const marker =
          repository.indexOf(
            '// LECTURA DE RESULTADOS PARA ADMINISTRACION'
          );

        const readScope =
          repository.slice(
            marker
          );

        expect(
          readScope
        ).not.toContain(
          'documento_sha256'
        );
      }
    );
  }
);
