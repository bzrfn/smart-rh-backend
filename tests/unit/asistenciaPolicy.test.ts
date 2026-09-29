jest.mock(
  '../../src/config/db.js',
  () => ({
    pool: {
      query: jest.fn(),
    },
  })
);

import {
  pool,
} from '../../src/config/db.js';

import {
  obtenerPoliticaAsistencia,
} from '../../src/modules/asistencia/asistencia.policy.js';

const queryMock =
  pool.query as jest.Mock;

describe(
  'Cambio #3 - politica configurable de asistencia',
  () => {
    beforeEach(() => {
      queryMock.mockReset();
    });

    test(
      'obtiene duracion minima de 2 minutos desde MySQL',
      async () => {
        queryMock.mockResolvedValueOnce([
          [
            {
              duracion_minima_minutos: 2,
            },
          ],
          [],
        ]);

        const result =
          await obtenerPoliticaAsistencia();

        expect(result).toEqual({
          duracionMinimaMinutos: 2,
        });

        expect(
          queryMock
        ).toHaveBeenCalledTimes(1);

        expect(
          String(
            queryMock.mock.calls[0][0]
          )
        ).toContain(
          'asistencia_configuracion'
        );
      }
    );

    test(
      'respeta un cambio de politica sin modificar codigo',
      async () => {
        queryMock.mockResolvedValueOnce([
          [
            {
              duracion_minima_minutos: 5,
            },
          ],
          [],
        ]);

        const result =
          await obtenerPoliticaAsistencia();

        expect(result).toEqual({
          duracionMinimaMinutos: 5,
        });
      }
    );

    test(
      'falla si no existe configuracion',
      async () => {
        queryMock.mockResolvedValueOnce([
          [],
          [],
        ]);

        await expect(
          obtenerPoliticaAsistencia()
        ).rejects.toThrow();
      }
    );

    test(
      'falla si la duracion configurada es invalida',
      async () => {
        queryMock.mockResolvedValueOnce([
          [
            {
              duracion_minima_minutos: 0,
            },
          ],
          [],
        ]);

        await expect(
          obtenerPoliticaAsistencia()
        ).rejects.toThrow();
      }
    );
  }
);
