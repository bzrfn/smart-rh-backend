import {
  analyzePdfStructure,
  calculatePdfSha256,
} from '../../src/modules/incapacidades/incapacidades.intelligence.js';


describe(
  'Incapacidades inteligentes - validación determinística PDF',
  () => {
    test(
      'PDF estructuralmente coherente genera SHA-256 y estado valido',
      () => {
        const buffer =
          Buffer.from(
            [
              '%PDF-1.7',
              '1 0 obj',
              '<< /Type /Catalog >>',
              'endobj',
              '%%EOF',
            ].join(
              '\n'
            )
          );

        const result =
          analyzePdfStructure(
            buffer
          );

        expect(
          result.hasPdfHeader
        ).toBe(
          true
        );

        expect(
          result.hasEofMarker
        ).toBe(
          true
        );

        expect(
          result.pdfVersion
        ).toBe(
          '1.7'
        );

        expect(
          result.structureStatus
        ).toBe(
          'valido'
        );

        expect(
          result.structureScore
        ).toBe(
          1
        );

        expect(
          result.sha256
        ).toMatch(
          /^[a-f0-9]{64}$/
        );
      }
    );


    test(
      'archivo que solo se llama PDF no pasa sin firma PDF real',
      () => {
        const buffer =
          Buffer.from(
            'esto no es un PDF'
          );

        const result =
          analyzePdfStructure(
            buffer
          );

        expect(
          result.hasPdfHeader
        ).toBe(
          false
        );

        expect(
          result.structureStatus
        ).toBe(
          'invalido'
        );

        expect(
          result.flags
        ).toContain(
          'PDF_HEADER_MISSING'
        );
      }
    );


    test(
      'PDF sin marcador EOF requiere revisión',
      () => {
        const buffer =
          Buffer.from(
            '%PDF-1.4\ncontenido'
          );

        const result =
          analyzePdfStructure(
            buffer
          );

        expect(
          result.hasPdfHeader
        ).toBe(
          true
        );

        expect(
          result.hasEofMarker
        ).toBe(
          false
        );

        expect(
          result.structureStatus
        ).toBe(
          'requiere_revision'
        );

        expect(
          result.flags
        ).toContain(
          'PDF_EOF_MISSING'
        );
      }
    );


    test(
      'PDF con marcador Encrypt se deriva a revisión',
      () => {
        const buffer =
          Buffer.from(
            [
              '%PDF-1.6',
              '1 0 obj',
              '<< /Encrypt 2 0 R >>',
              'endobj',
              '%%EOF',
            ].join(
              '\n'
            )
          );

        const result =
          analyzePdfStructure(
            buffer
          );

        expect(
          result.encryptedMarker
        ).toBe(
          true
        );

        expect(
          result.structureStatus
        ).toBe(
          'requiere_revision'
        );

        expect(
          result.flags
        ).toContain(
          'PDF_ENCRYPTION_MARKER'
        );
      }
    );


    test(
      'el mismo archivo produce exactamente la misma huella',
      () => {
        const a =
          Buffer.from(
            '%PDF-1.4\nA\n%%EOF'
          );

        const b =
          Buffer.from(
            '%PDF-1.4\nA\n%%EOF'
          );

        expect(
          calculatePdfSha256(
            a
          )
        ).toBe(
          calculatePdfSha256(
            b
          )
        );
      }
    );


    test(
      'archivos distintos producen huellas distintas',
      () => {
        const a =
          Buffer.from(
            '%PDF-1.4\nA\n%%EOF'
          );

        const b =
          Buffer.from(
            '%PDF-1.4\nB\n%%EOF'
          );

        expect(
          calculatePdfSha256(
            a
          )
        ).not.toBe(
          calculatePdfSha256(
            b
          )
        );
      }
    );
  }
);
