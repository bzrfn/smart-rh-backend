jest.mock(
  '../../src/config/db.js',
  () => ({
    pool: {
      getConnection:
        jest.fn(),
    },
  })
);


jest.mock(
  '../../src/modules/asistencia/qr-log.model.js',
  () => ({
    QrLogModel: {
      findOne:
        jest.fn(),

      updateOne:
        jest.fn(),

      deleteMany:
        jest.fn(),

      create:
        jest.fn(),
    },
  })
);


jest.mock(
  '../../src/modules/asistencia/asistencia.repository.js',
  () => ({
    findAsistenciaById:
      jest.fn(),

    listAllAsistencias:
      jest.fn(),

    listMisAsistencias:
      jest.fn(),

    listMisAsistenciasByDateRange:
      jest.fn(),

    listPendientes:
      jest.fn(),

    setAsistenciaEstado:
      jest.fn(),
  })
);


jest.mock(
  '../../src/modules/notificaciones/notificaciones.service.js',
  () => ({
    crearNotificacion:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),

    crearNotificacionDiaCompleto:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),

    eliminarNotificacionesAsistenciaUsuario:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),
  })
);


jest.mock(
  'uuid',
  () => ({
    v4:
      jest.fn(
        () =>
          'uuid-test'
      ),
  })
);


jest.mock(
  'qrcode',
  () => ({
    __esModule:
      true,

    default: {
      toDataURL:
        jest.fn()
          .mockResolvedValue(
            'data:image/png;base64,test'
          ),
    },
  })
);


import {
  pool,
} from '../../src/config/db.js';

import {
  QrLogModel,
} from '../../src/modules/asistencia/qr-log.model.js';

import {
  scanQr,
} from '../../src/modules/asistencia/asistencia.service.js';


const getConnectionMock =
  pool.getConnection as jest.Mock;


const findQrMock =
  QrLogModel.findOne as jest.Mock;


const updateQrMock =
  QrLogModel.updateOne as jest.Mock;


function createConnectionMock(
  queryImplementation:
    jest.Mock
) {

  return {
    beginTransaction:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),

    query:
      queryImplementation,

    commit:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),

    rollback:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),

    release:
      jest.fn(),
  };
}


describe(
  'Asistencia QR',
  () => {

    beforeEach(() => {

      jest.clearAllMocks();

      jest.useFakeTimers();

      jest.setSystemTime(
        new Date(
          '2026-09-14T05:24:16.000Z'
        )
      );


      findQrMock
        .mockResolvedValue({
          _id:
            'qr-id-test',

          token:
            'QR-TEST',

          fecha_expiracion:
            new Date(
              '2026-09-14T05:26:16.000Z'
            ),

          usos: [],
        });


      updateQrMock
        .mockResolvedValue({
          acknowledged:
            true,

          modifiedCount:
            1,
        });
    });


    afterEach(() => {

      jest.useRealTimers();
    });


    test(
      'rechaza token vacío',
      async () => {

        await expect(
          scanQr(
            22,
            ''
          )
        ).rejects
          .toMatchObject({
            statusCode:
              400,
          });


        expect(
          findQrMock
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      'rechaza token inexistente',
      async () => {

        findQrMock
          .mockResolvedValue(
            null
          );


        await expect(
          scanQr(
            22,
            'QR-NO-EXISTE'
          )
        ).rejects
          .toMatchObject({
            statusCode:
              400,
          });
      }
    );


    test(
      'rechaza QR expirado',
      async () => {

        findQrMock
          .mockResolvedValue({
            _id:
              'qr-expirado',

            token:
              'QR-EXPIRADO',

            fecha_expiracion:
              new Date(
                '2026-09-14T05:20:00.000Z'
              ),

            usos: [],
          });


        await expect(
          scanQr(
            22,
            'QR-EXPIRADO'
          )
        ).rejects
          .toMatchObject({
            statusCode:
              410,
          });


        expect(
          getConnectionMock
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      'registra entrada con fecha y hora de México',
      async () => {

        const query =
          jest.fn();


        query
          .mockResolvedValueOnce(
            [
              [],
              [],
            ]
          )
          .mockResolvedValueOnce(
            [
              {
                insertId:
                  160,
              },
              [],
            ]
          );


        const connection =
          createConnectionMock(
            query
          );


        getConnectionMock
          .mockResolvedValue(
            connection
          );


        const result =
          await scanQr(
            22,
            'QR-TEST'
          );


        expect(
          result
        ).toEqual({
          id:
            160,

          tipo:
            'entrada',

          message:
            'Entrada registrada correctamente',

          fecha:
            '2026-09-13',
        });


        expect(
          query
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'INSERT INTO asistencias'
          ),
          [
            22,
            '2026-09-13',
            '23:24:16',
            'QR-TEST',
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          updateQrMock
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      'mismo usuario no puede reutilizar inmediatamente el mismo QR',
      async () => {

        const query =
          jest.fn()
            .mockResolvedValueOnce(
              [
                [
                  {
                    id:
                      91,

                    usuario_id:
                      22,

                    fecha:
                      '2026-09-13',

                    hora_entrada:
                      '23:00:00',

                    hora_salida:
                      null,

                    estado:
                      'pendiente',

                    qr_token:
                      'QR-TEST',
                  },
                ],
                [],
              ]
            );


        const connection =
          createConnectionMock(
            query
          );


        getConnectionMock
          .mockResolvedValue(
            connection
          );


        await expect(
          scanQr(
            22,
            'QR-TEST'
          )
        ).rejects
          .toMatchObject({
            statusCode:
              409,
          });


        expect(
          connection.rollback
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          connection.commit
        ).not
          .toHaveBeenCalled();
      }
    );


    test(
      'permite salida cuando se utiliza un QR nuevo',
      async () => {

        const query =
          jest.fn();


        query
          .mockResolvedValueOnce(
            [
              [
                {
                  id:
                    91,

                  usuario_id:
                    22,

                  fecha:
                    '2026-09-13',

                  hora_entrada:
                    '20:00:00',

                  hora_salida:
                    null,

                  estado:
                    'pendiente',

                  qr_token:
                    'QR-ENTRADA',
                },
              ],
              [],
            ]
          )
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  1,
              },
              [],
            ]
          );


        const connection =
          createConnectionMock(
            query
          );


        getConnectionMock
          .mockResolvedValue(
            connection
          );


        const result =
          await scanQr(
            22,
            'QR-TEST'
          );


        expect(
          result.tipo
        ).toBe(
          'salida'
        );


        expect(
          result.id
        ).toBe(
          91
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'UPDATE asistencias'
          ),
          [
            '23:24:16',
            'QR-TEST',
            91,
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      'rechaza un nuevo escaneo cuando el día ya está completo',
      async () => {

        const query =
          jest.fn()
            .mockResolvedValueOnce(
              [
                [
                  {
                    id:
                      91,

                    usuario_id:
                      22,

                    fecha:
                      '2026-09-13',

                    hora_entrada:
                      '09:00:00',

                    hora_salida:
                      '17:00:00',

                    estado:
                      'pendiente',

                    qr_token:
                      'QR-ANTERIOR',
                  },
                ],
                [],
              ]
            );


        const connection =
          createConnectionMock(
            query
          );


        getConnectionMock
          .mockResolvedValue(
            connection
          );


        await expect(
          scanQr(
            22,
            'QR-TEST'
          )
        ).rejects
          .toMatchObject({
            statusCode:
              409,
          });


        expect(
          connection.rollback
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );


    test(
      'convierte duplicado SQL en conflicto 409',
      async () => {

        const duplicateError:
        any =
          new Error(
            'Duplicate entry'
          );


        duplicateError.code =
          'ER_DUP_ENTRY';


        const query =
          jest.fn();


        query
          .mockResolvedValueOnce(
            [
              [],
              [],
            ]
          )
          .mockRejectedValueOnce(
            duplicateError
          );


        const connection =
          createConnectionMock(
            query
          );


        getConnectionMock
          .mockResolvedValue(
            connection
          );


        await expect(
          scanQr(
            22,
            'QR-TEST'
          )
        ).rejects
          .toMatchObject({
            statusCode:
              409,
          });


        expect(
          connection.rollback
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);
