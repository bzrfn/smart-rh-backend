jest.mock(
  '../../src/config/db.js',
  () => ({
    pool: {
      query:
        jest.fn(),
    },
  })
);


import {
  pool,
} from '../../src/config/db.js';

import {
  listAllAsistencias,
  listMisAsistencias,
  listMisAsistenciasByDateRange,
} from '../../src/modules/asistencia/asistencia.repository.js';


const queryMock =
  pool.query as jest.Mock;


describe(
  'Cambio #3 - lecturas de asistencia exponen duracion',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      queryMock
        .mockResolvedValue([
          [],
        ]);
    });


    test(
      'listMisAsistencias incluye minimo aplicado y duracion registrada',
      async () => {

        await listMisAsistencias(
          22
        );


        const sql =
          String(
            queryMock
              .mock
              .calls[0][0]
          );


        expect(
          sql
        ).toContain(
          'a.duracion_minima_aplicada_minutos'
        );


        expect(
          sql
        ).toContain(
          'a.duracion_registrada_segundos'
        );
      }
    );


    test(
      'listMisAsistenciasByDateRange incluye minimo aplicado y duracion registrada',
      async () => {

        await listMisAsistenciasByDateRange(
          22,
          '2026-09-14',
          '2026-09-20'
        );


        const sql =
          String(
            queryMock
              .mock
              .calls[0][0]
          );


        expect(
          sql
        ).toContain(
          'a.duracion_minima_aplicada_minutos'
        );


        expect(
          sql
        ).toContain(
          'a.duracion_registrada_segundos'
        );
      }
    );


    test(
      'listAllAsistencias incluye minimo aplicado y duracion registrada',
      async () => {

        await listAllAsistencias();


        const sql =
          String(
            queryMock
              .mock
              .calls[0][0]
          );


        expect(
          sql
        ).toContain(
          'a.duracion_minima_aplicada_minutos'
        );


        expect(
          sql
        ).toContain(
          'a.duracion_registrada_segundos'
        );
      }
    );
  }
);
