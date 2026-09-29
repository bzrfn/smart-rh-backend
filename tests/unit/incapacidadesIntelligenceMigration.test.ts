import fs from 'node:fs';


describe(
  'Incapacidades inteligentes - contrato de migración',
  () => {
    const sql =
      fs.readFileSync(
        'db/migrations/2026_09_28_incapacidades_inteligentes.sql',
        'utf8'
      );


    test(
      'crea tabla de análisis uno a uno por incapacidad',
      () => {
        expect(
          sql
        ).toMatch(
          /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+incapacidad_analisis/i
        );

        expect(
          sql
        ).toMatch(
          /UNIQUE\s+KEY\s+uq_incapacidad_analisis_incapacidad/i
        );

        expect(
          sql
        ).toMatch(
          /FOREIGN\s+KEY\s*\(\s*incapacidad_id\s*\)\s*REFERENCES\s+incapacidades\s*\(\s*id\s*\)/i
        );
      }
    );


    test(
      'persiste huella SHA-256 e indice para detectar duplicados',
      () => {
        expect(
          sql
        ).toMatch(
          /documento_sha256\s+CHAR\(64\)\s+NOT\s+NULL/i
        );

        expect(
          sql
        ).toMatch(
          /idx_incapacidad_analisis_sha256/i
        );

        expect(
          sql
        ).toMatch(
          /duplicado_detectado\s+TINYINT\(1\)/i
        );

        expect(
          sql
        ).toMatch(
          /duplicado_de_incapacidad_id/i
        );
      }
    );


    test(
      'prepara validación estructural y extracción posterior',
      () => {
        expect(
          sql
        ).toMatch(
          /pdf_header_valido/i
        );

        expect(
          sql
        ).toMatch(
          /pdf_eof_presente/i
        );

        expect(
          sql
        ).toMatch(
          /estado_estructura/i
        );

        expect(
          sql
        ).toMatch(
          /campos_extraidos\s+JSON/i
        );

        expect(
          sql
        ).toMatch(
          /diferencias_detectadas\s+JSON/i
        );

        expect(
          sql
        ).toMatch(
          /confianza_extraccion/i
        );
      }
    );


    test(
      'no agrega columna de texto OCR completo',
      () => {
        expect(
          sql
        ).not.toMatch(
          /\bocr_text\b/i
        );

        expect(
          sql
        ).not.toMatch(
          /\btexto_ocr\b/i
        );

        expect(
          sql
        ).not.toMatch(
          /\btexto_completo\b/i
        );
      }
    );


    test(
      'la decisión administrativa no se automatiza en esta tabla',
      () => {
        expect(
          sql
        ).not.toMatch(
          /\bauto_aprobad[oa]\b/i
        );

        expect(
          sql
        ).not.toMatch(
          /\bauto_rechazad[oa]\b/i
        );
      }
    );
  }
);
