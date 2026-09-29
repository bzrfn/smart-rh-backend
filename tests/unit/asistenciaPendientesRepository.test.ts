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
  listPendientes,
} from '../../src/modules/asistencia/asistencia.repository.js';


const queryMock =
  pool.query as jest.Mock;


describe(
  'Cambio #3 - bandeja administrativa de asistencias',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      queryMock
        .mockResolvedValue(
          [
            [],
            [],
          ]
        );
    });


    test(
      'listPendientes incluye pendiente e INVALIDA_PENDIENTE_REVISION',
      async () => {

        await listPendientes();


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          1
        );


        const sql =
          String(
            queryMock
              .mock
              .calls[0][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          sql
        ).toContain(
          "a.estado IN ('pendiente', 'INVALIDA_PENDIENTE_REVISION')"
        );
      }
    );
  }
);


// CAMBIO3_TDD_PENDIENTES_DURACION
describe(
  'Cambio #3 - contexto de duracion para revision administrativa',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      queryMock
        .mockResolvedValue(
          [
            [],
            [],
          ]
        );
    });


    test(
      'listPendientes entrega duracion registrada y minimo aplicado',
      async () => {

        await listPendientes();


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          1
        );


        const sql =
          String(
            queryMock
              .mock
              .calls[0][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


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
