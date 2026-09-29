jest.mock(
  'mongoose',
  () => ({
    __esModule:
      true,

    default: {
      connection: {
        readyState:
          1,
      },

      Types: {
        ObjectId: {
          isValid:
            jest.fn(
              () => true
            ),
        },
      },
    },
  })
);


jest.mock(
  '../../src/config/db.js',
  () => ({
    pool: {
      query:
        jest.fn(),
    },
  })
);


jest.mock(
  '../../src/modules/notificaciones/notificaciones.model.js',
  () => ({
    NotificacionModel: {
      deleteMany:
        jest.fn(),

      create:
        jest.fn(),

      find:
        jest.fn(),

      updateOne:
        jest.fn(),
    },
  })
);


import {
  pool,
} from '../../src/config/db.js';

import {
  NotificacionModel,
} from '../../src/modules/notificaciones/notificaciones.model.js';

import {
  generarRecordatorioAsistenciaLogin,
} from '../../src/modules/notificaciones/notificaciones.service.js';


const queryMock =
  pool.query as jest.Mock;

const deleteManyMock =
  NotificacionModel
    .deleteMany as jest.Mock;

const createMock =
  NotificacionModel
    .create as jest.Mock;


describe(
  'Cambio #3 - notificaciones de asistencia durante login',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      deleteManyMock
        .mockResolvedValue({
          acknowledged:
            true,

          deletedCount:
            0,
        });

      createMock
        .mockResolvedValue({
          _id:
            'notif-test',
        });
    });


    test(
      'no genera DIA_COMPLETO si entrada y salida estan pendientes de revision',
      async () => {

        queryMock
          // getMysqlDateContext()
          .mockResolvedValueOnce(
            [
              [
                {
                  fecha:
                    '2026-09-21',

                  hora:
                    18,
                },
              ],
              [],
            ]
          )

          // asistencia del día
          .mockResolvedValueOnce(
            [
              [
                {
                  id:
                    91,

                  hora_entrada:
                    '09:00:00',

                  hora_salida:
                    '09:01:30',

                  estado:
                    'INVALIDA_PENDIENTE_REVISION',
                },
              ],
              [],
            ]
          );


        await generarRecordatorioAsistenciaLogin(
          22
        );


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const asistenciaSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          );


        expect(
          asistenciaSql
        ).toContain(
          'estado'
        );


        expect(
          createMock
        ).not
          .toHaveBeenCalledWith(
            expect.objectContaining({
              tipo:
                'DIA_COMPLETO',
            })
          );
      }
    );
  }
);
