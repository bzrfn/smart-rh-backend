import {
  calculateInclusiveDays,
  normalizeAdminObservation,
  normalizeReason,
  normalizeReviewState,
  prepareIncapacidadProof,
} from '../../src/modules/incapacidades/incapacidades.domain.js';


describe(
  'Incapacidades core',
  () => {
    test(
      'calcula un solo día de forma inclusiva',
      () => {
        expect(
          calculateInclusiveDays(
            '2026-09-23',
            '2026-09-23'
          )
        ).toBe(1);
      }
    );


    test(
      'calcula varios días de forma inclusiva',
      () => {
        expect(
          calculateInclusiveDays(
            '2026-09-23',
            '2026-09-25'
          )
        ).toBe(3);
      }
    );


    test(
      'rechaza fecha fin anterior a fecha inicio',
      () => {
        expect(
          () =>
            calculateInclusiveDays(
              '2026-09-25',
              '2026-09-23'
            )
        ).toThrow();
      }
    );


    test(
      'rechaza fechas inexistentes',
      () => {
        expect(
          () =>
            calculateInclusiveDays(
              '2026-02-30',
              '2026-03-02'
            )
        ).toThrow();
      }
    );


    test(
      'acepta únicamente estados administrativos finales soportados',
      () => {
        expect(
          normalizeReviewState(
            'aprobada'
          )
        ).toBe('aprobada');

        expect(
          normalizeReviewState(
            'rechazada'
          )
        ).toBe('rechazada');

        expect(
          () =>
            normalizeReviewState(
              'pendiente'
            )
        ).toThrow();
      }
    );


    test(
      'normaliza y valida motivo',
      () => {
        expect(
          normalizeReason(
            '  Incapacidad médica  '
          )
        ).toBe(
          'Incapacidad médica'
        );

        expect(
          () =>
            normalizeReason('')
        ).toThrow();
      }
    );


    test(
      'observación administrativa vacía se representa como null',
      () => {
        expect(
          normalizeAdminObservation(
            '   '
          )
        ).toBeNull();
      }
    );

    test(
      'acepta comprobante PDF por firma real',
      () => {
        const base64 =
          Buffer.from(
            '%PDF-1.4\nSMART RH'
          ).toString(
            'base64'
          );

        const proof =
          prepareIncapacidadProof(
            base64,
            'incapacidad.pdf'
          );

        expect(
          proof.mime
        ).toBe(
          'application/pdf'
        );

        expect(
          proof.extension
        ).toBe(
          'pdf'
        );

        expect(
          proof.size
        ).toBeGreaterThan(0);
      }
    );


    test(
      'acepta PNG en Data URL',
      () => {
        const png =
          Buffer.from([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
            0x00,
          ]);

        const proof =
          prepareIncapacidadProof(
            `data:image/png;base64,${png.toString('base64')}`,
            'evidencia.png'
          );

        expect(
          proof.mime
        ).toBe(
          'image/png'
        );

        expect(
          proof.extension
        ).toBe(
          'png'
        );
      }
    );


    test(
      'acepta JPEG por firma real',
      () => {
        const jpeg =
          Buffer.from([
            0xff,
            0xd8,
            0xff,
            0xe0,
            0x00,
          ]);

        const proof =
          prepareIncapacidadProof(
            jpeg.toString(
              'base64'
            ),
            'foto.jpg'
          );

        expect(
          proof.mime
        ).toBe(
          'image/jpeg'
        );
      }
    );


    test(
      'rechaza contenido que no sea PDF JPG o PNG',
      () => {
        const text =
          Buffer.from(
            'archivo de texto'
          ).toString(
            'base64'
          );

        expect(
          () =>
            prepareIncapacidadProof(
              text,
              'falso.pdf'
            )
        ).toThrow(
          /Formato de comprobante no permitido/
        );
      }
    );


    test(
      'rechaza Base64 inválido',
      () => {
        expect(
          () =>
            prepareIncapacidadProof(
              '***NO-BASE64***',
              'archivo.pdf'
            )
        ).toThrow(
          /Base64 no es válido/
        );
      }
    );

  }
);
