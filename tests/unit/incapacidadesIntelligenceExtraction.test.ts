import {
  compareIncapacidadExtractedFields,
  extractIncapacidadFieldsFromText,
} from '../../src/modules/incapacidades/incapacidades.intelligence.extraction.js';


describe(
  'Incapacidades - extracción determinística privada',
  () => {
    test(
      'extrae campos etiquetados desde texto sintético',
      () => {
        const result =
          extractIncapacidadFieldsFromText(
            [
              'INSTITUTO MEXICANO DEL SEGURO SOCIAL',
              'Institución: IMSS',
              'Folio: IMSS-ABC-2026-0099',
              'Médico tratante: Dra. Ana Ejemplo',
              'Fecha de inicio: 28/09/2026',
              'Fecha de fin: 30/09/2026',
              'Días autorizados: 3',
            ].join(
              '\n'
            )
          );


        expect(
          result.campos
        ).toEqual({
          fecha_inicio:
            '2026-09-28',

          fecha_fin:
            '2026-09-30',

          dias:
            3,

          institucion:
            'IMSS',

          medico:
            'Dra. Ana Ejemplo',

          folio:
            'IMSS-ABC-2026-0099',
        });


        expect(
          result.confianza
        ).toBe(
          1
        );


        expect(
          result.campos_detectados
        ).toBe(
          6
        );
      }
    );


    test(
      'acepta fechas ISO etiquetadas',
      () => {
        const result =
          extractIncapacidadFieldsFromText(
            [
              'Inicio: 2026-10-01',
              'Fin: 2026-10-05',
              'Días de incapacidad: 5',
            ].join(
              '\n'
            )
          );


        expect(
          result.campos
            .fecha_inicio
        ).toBe(
          '2026-10-01'
        );


        expect(
          result.campos
            .fecha_fin
        ).toBe(
          '2026-10-05'
        );


        expect(
          result.campos.dias
        ).toBe(
          5
        );
      }
    );


    test(
      'rechaza fechas calendario inválidas',
      () => {
        const result =
          extractIncapacidadFieldsFromText(
            [
              'Fecha de inicio: 31/02/2026',
              'Fecha de fin: 32/02/2026',
            ].join(
              '\n'
            )
          );


        expect(
          result.campos
            .fecha_inicio
        ).toBeNull();


        expect(
          result.campos
            .fecha_fin
        ).toBeNull();
      }
    );


    test(
      'texto vacío produce resultado sin confianza',
      () => {
        const result =
          extractIncapacidadFieldsFromText(
            '   '
          );


        expect(
          result.confianza
        ).toBe(
          0
        );


        expect(
          result.campos_detectados
        ).toBe(
          0
        );


        expect(
          Object.values(
            result.campos
          ).every(
            value =>
              value === null
          )
        ).toBe(
          true
        );
      }
    );


    test(
      'compara solicitud consistente',
      () => {
        const extracted =
          extractIncapacidadFieldsFromText(
            [
              'Fecha de inicio: 28/09/2026',
              'Fecha de fin: 30/09/2026',
              'Días autorizados: 3',
            ].join(
              '\n'
            )
          );


        const comparison =
          compareIncapacidadExtractedFields(
            extracted.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        expect(
          comparison.consistente
        ).toBe(
          true
        );


        expect(
          comparison.diferencias
        ).toEqual(
          []
        );


        expect(
          comparison.campos_comparados
        ).toEqual([
          'fecha_inicio',
          'fecha_fin',
          'dias_calculados',
        ]);
      }
    );


    test(
      'detecta diferencias sin decidir aprobación',
      () => {
        const extracted =
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
            extracted.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        expect(
          comparison.consistente
        ).toBe(
          false
        );


        expect(
          comparison.diferencias
            .map(
              item =>
                item.campo
            )
        ).toEqual([
          'fecha_inicio',
          'fecha_fin',
          'dias_calculados',
        ]);
      }
    );


    test(
      'campo no extraído no se convierte en discrepancia falsa',
      () => {
        const extracted =
          extractIncapacidadFieldsFromText(
            'Institución: ISSSTE'
          );


        const comparison =
          compareIncapacidadExtractedFields(
            extracted.campos,
            {
              fecha_inicio:
                '2026-09-28',

              fecha_fin:
                '2026-09-30',

              dias_calculados:
                3,
            }
          );


        expect(
          comparison.campos_comparados
        ).toEqual(
          []
        );


        expect(
          comparison.diferencias
        ).toEqual(
          []
        );


        expect(
          comparison.consistente
        ).toBeNull();
      }
    );


    test(
      'resultado no conserva el texto fuente completo',
      () => {
        const secret =
          'MARCADOR_PRIVADO_QUE_NO_DEBE_RETORNARSE';


        const result =
          extractIncapacidadFieldsFromText(
            [
              secret,
              'Fecha de inicio: 28/09/2026',
              'Fecha de fin: 30/09/2026',
            ].join(
              '\n'
            )
          );


        expect(
          JSON.stringify(
            result
          )
        ).not.toContain(
          secret
        );
      }
    );


    test(
      'contrato no contiene campo de diagnóstico',
      () => {
        const result =
          extractIncapacidadFieldsFromText(
            [
              'Institución: IMSS',
              'Folio: TEST-001',
            ].join(
              '\n'
            )
          );


        expect(
          Object.keys(
            result.campos
          )
        ).not.toContain(
          'diagnostico'
        );
      }
    );
  }
);
