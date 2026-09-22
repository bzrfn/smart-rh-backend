jest.mock(
  '../../src/config/db.js',
  () => ({
    pool: {
      getConnection:
        jest.fn(),

      query:
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
      jest.fn(),

    crearNotificacionDiaCompleto:
      jest.fn(),

    eliminarNotificacionesAsistenciaUsuario:
      jest.fn(),
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
  findAsistenciaById,
} from '../../src/modules/asistencia/asistencia.repository.js';

import {
  approveAsistencia,
  rejectAsistencia,
} from '../../src/modules/asistencia/asistencia.service.js';


const getConnectionMock =
  pool.getConnection as jest.Mock;

const findAsistenciaByIdMock =
  findAsistenciaById as jest.Mock;


function createConnectionMock(
  query:
    jest.Mock
) {
  return {
    beginTransaction:
      jest.fn()
        .mockResolvedValue(
          undefined
        ),

    query,

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
  'Cambio #3 - revision administrativa de asistencia',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'admin aprueba una salida invalida y registra historial durable en la misma transaccion',
      async () => {

        const motivo =
          'Salida temprana revisada y aprobada por administrador';


        // Compatibilidad con la implementacion antigua:
        // actualmente el service consulta repository y rechaza
        // estados distintos de "pendiente".
        findAsistenciaByIdMock
          .mockResolvedValue({
            id:
              91,

            usuario_id:
              22,

            fecha:
              '2026-09-13',

            hora_entrada:
              '09:00:00',

            hora_salida:
              '09:01:30',

            estado:
              'INVALIDA_PENDIENTE_REVISION',
          });


        const query =
          jest.fn();

        query
          // 1. Bloqueo durable de la asistencia.
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
                    '09:01:30',

                  estado:
                    'INVALIDA_PENDIENTE_REVISION',
                },
              ],
              [],
            ]
          )

          // 2. UPDATE de estado.
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  1,
              },
              [],
            ]
          )

          // 3. INSERT del historial.
          .mockResolvedValueOnce(
            [
              {
                insertId:
                  1,

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


        const aprobarConTrazabilidad =
          approveAsistencia as unknown as (
            asistenciaId: number,
            adminUsuarioId: number,
            motivo: string
          ) => Promise<unknown>;


        await aprobarConTrazabilidad(
          91,
          7,
          motivo
        );


        expect(
          connection.beginTransaction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'FOR UPDATE'
          ),
          [
            91,
          ]
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'UPDATE asistencias'
          ),
          expect.arrayContaining([
            'aprobada',
            91,
          ])
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            'INSERT INTO asistencia_revisiones'
          ),
          [
            91,
            7,
            'APROBAR',
            motivo,
            'INVALIDA_PENDIENTE_REVISION',
            'aprobada',
            '09:00:00',
            '09:01:30',
            '09:00:00',
            '09:01:30',
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          connection.rollback
        ).not
          .toHaveBeenCalled();


        expect(
          connection.release
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);


// CAMBIO3_TDD_RECHAZO_DURABLE
describe(
  'Cambio #3 - rechazo administrativo durable',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'admin rechaza una salida invalida y registra historial durable en la misma transaccion',
      async () => {

        const motivo =
          'Salida temprana rechazada después de revisión administrativa';


        findAsistenciaByIdMock
          .mockResolvedValue({
            id:
              91,

            usuario_id:
              22,

            fecha:
              '2026-09-13',

            hora_entrada:
              '09:00:00',

            hora_salida:
              '09:01:30',

            estado:
              'INVALIDA_PENDIENTE_REVISION',
          });


        const query =
          jest.fn();

        query
          // 1. Bloqueo durable.
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
                    '09:01:30',

                  estado:
                    'INVALIDA_PENDIENTE_REVISION',
                },
              ],
              [],
            ]
          )

          // 2. UPDATE a rechazada.
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  1,
              },
              [],
            ]
          )

          // 3. Historial durable.
          .mockResolvedValueOnce(
            [
              {
                insertId:
                  2,

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


        const rechazarConTrazabilidad =
          rejectAsistencia as unknown as (
            asistenciaId: number,
            adminUsuarioId: number,
            motivo: string
          ) => Promise<unknown>;


        await rechazarConTrazabilidad(
          91,
          7,
          motivo
        );


        expect(
          connection.beginTransaction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'FOR UPDATE'
          ),
          [
            91,
          ]
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'UPDATE asistencias'
          ),
          expect.arrayContaining([
            'rechazada',
            91,
          ])
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          3,
          expect.stringContaining(
            'INSERT INTO asistencia_revisiones'
          ),
          [
            91,
            7,
            'RECHAZAR',
            motivo,
            'INVALIDA_PENDIENTE_REVISION',
            'rechazada',
            '09:00:00',
            '09:01:30',
            '09:00:00',
            '09:01:30',
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          connection.rollback
        ).not
          .toHaveBeenCalled();


        expect(
          connection.release
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);


// CAMBIO3_TDD_JUSTIFICAR_ASISTENCIA
describe(
  'Cambio #3 - justificacion administrativa de asistencia invalida',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'admin justifica una salida invalida, la aprueba y registra JUSTIFICAR en la misma transaccion',
      async () => {

        const motivo =
          'Salida anticipada justificada por cita médica autorizada';


        const query =
          jest.fn()
            // 1. SELECT FOR UPDATE.
            .mockResolvedValueOnce(
              [
                [
                  {
                    id:
                      91,

                    usuario_id:
                      22,

                    fecha:
                      '2026-09-21',

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
            )

            // 2. UPDATE estado -> aprobada.
            .mockResolvedValueOnce(
              [
                {
                  affectedRows:
                    1,
                },
                [],
              ]
            )

            // 3. INSERT historial durable.
            .mockResolvedValueOnce(
              [
                {
                  insertId:
                    1,

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


        const serviceModule =
          await import(
            '../../src/modules/asistencia/asistencia.service.js'
          );


        const justifyAsistencia =
          (
            serviceModule as any
          ).justifyAsistencia;


        expect(
          typeof justifyAsistencia
        ).toBe(
          'function'
        );


        await justifyAsistencia(
          91,
          7,
          motivo
        );


        expect(
          connection.beginTransaction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'FOR UPDATE'
          ),
          [
            91,
          ]
        );


        const updateSql =
          String(
            query.mock.calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          updateSql
        ).toContain(
          'UPDATE asistencias'
        );


        expect(
          query.mock.calls[1][1]
        ).toEqual(
          [
            'aprobada',
            91,
          ]
        );


        const historialSql =
          String(
            query.mock.calls[2][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          historialSql
        ).toContain(
          'INSERT INTO asistencia_revisiones'
        );


        expect(
          query.mock.calls[2][1]
        ).toEqual(
          [
            91,
            7,
            'JUSTIFICAR',
            motivo,
            'INVALIDA_PENDIENTE_REVISION',
            'aprobada',
            '09:00:00',
            '09:01:30',
            '09:00:00',
            '09:01:30',
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          connection.rollback
        ).not
          .toHaveBeenCalled();


        expect(
          connection.release
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);


// CAMBIO3_TDD_CORREGIR_ASISTENCIA
describe(
  'Cambio #3 - correccion administrativa de asistencia',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'admin corrige horas de una asistencia invalida, recalcula duracion y la devuelve a pendiente si ya cumple la politica',
      async () => {

        const motivo =
          'Se corrigió la hora de salida con evidencia del supervisor';


        const query =
          jest.fn()

            // 1. SELECT FOR UPDATE.
            .mockResolvedValueOnce(
              [
                [
                  {
                    id:
                      91,

                    usuario_id:
                      22,

                    fecha:
                      '2026-09-21',

                    hora_entrada:
                      '09:00:00',

                    hora_salida:
                      '09:01:30',

                    estado:
                      'INVALIDA_PENDIENTE_REVISION',

                    duracion_minima_aplicada_minutos:
                      2,

                    duracion_registrada_segundos:
                      90,
                  },
                ],
                [],
              ]
            )

            // 2. UPDATE con horas corregidas,
            // duración recalculada y estado pendiente.
            .mockResolvedValueOnce(
              [
                {
                  affectedRows:
                    1,
                },
                [],
              ]
            )

            // 3. INSERT historial CORREGIR.
            .mockResolvedValueOnce(
              [
                {
                  insertId:
                    1,

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


        const serviceModule =
          await import(
            '../../src/modules/asistencia/asistencia.service.js'
          );


        const correctAsistencia =
          (
            serviceModule as any
          ).correctAsistencia;


        expect(
          typeof correctAsistencia
        ).toBe(
          'function'
        );


        await correctAsistencia(
          91,
          7,
          motivo,
          '09:00:00',
          '09:03:00'
        );


        expect(
          connection.beginTransaction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'FOR UPDATE'
          ),
          [
            91,
          ]
        );


        const selectSql =
          String(
            query.mock.calls[0][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          selectSql
        ).toContain(
          'duracion_minima_aplicada_minutos'
        );


        const updateSql =
          String(
            query.mock.calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          updateSql
        ).toContain(
          'UPDATE asistencias'
        );


        expect(
          updateSql
        ).toContain(
          'duracion_registrada_segundos'
        );


        expect(
          query.mock.calls[1][1]
        ).toEqual(
          [
            '09:00:00',
            '09:03:00',
            'pendiente',
            2,
            180,
            91,
          ]
        );


        const historialSql =
          String(
            query.mock.calls[2][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          historialSql
        ).toContain(
          'INSERT INTO asistencia_revisiones'
        );


        expect(
          query.mock.calls[2][1]
        ).toEqual(
          [
            91,
            7,
            'CORREGIR',
            motivo,
            'INVALIDA_PENDIENTE_REVISION',
            'pendiente',
            '09:00:00',
            '09:01:30',
            '09:00:00',
            '09:03:00',
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          connection.rollback
        ).not
          .toHaveBeenCalled();


        expect(
          connection.release
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);


// CAMBIO3_TEST_CORREGIR_SIGUE_INVALIDA
describe(
  'Cambio #3 - correccion que continua por debajo del minimo',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'admin corrige una asistencia pero si la nueva duracion sigue bajo el minimo permanece INVALIDA_PENDIENTE_REVISION',
      async () => {

        const motivo =
          'Corrección revisada; la permanencia sigue siendo menor al mínimo';


        const query =
          jest.fn()

            // 1. SELECT FOR UPDATE.
            .mockResolvedValueOnce(
              [
                [
                  {
                    id:
                      91,

                    usuario_id:
                      22,

                    fecha:
                      '2026-09-21',

                    hora_entrada:
                      '09:00:00',

                    hora_salida:
                      '09:00:45',

                    estado:
                      'INVALIDA_PENDIENTE_REVISION',

                    duracion_minima_aplicada_minutos:
                      2,

                    duracion_registrada_segundos:
                      45,
                  },
                ],
                [],
              ]
            )

            // 2. UPDATE mantiene estado inválido.
            .mockResolvedValueOnce(
              [
                {
                  affectedRows:
                    1,
                },
                [],
              ]
            )

            // 3. Historial CORREGIR.
            .mockResolvedValueOnce(
              [
                {
                  insertId:
                    2,

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


        const serviceModule =
          await import(
            '../../src/modules/asistencia/asistencia.service.js'
          );


        const correctAsistencia =
          (
            serviceModule as any
          ).correctAsistencia;


        expect(
          typeof correctAsistencia
        ).toBe(
          'function'
        );


        await correctAsistencia(
          91,
          7,
          motivo,
          '09:00:00',
          '09:01:00'
        );


        expect(
          connection.beginTransaction
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          query
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'FOR UPDATE'
          ),
          [
            91,
          ]
        );


        expect(
          query.mock.calls[1][1]
        ).toEqual(
          [
            '09:00:00',
            '09:01:00',
            'INVALIDA_PENDIENTE_REVISION',
            2,
            60,
            91,
          ]
        );


        const historialSql =
          String(
            query.mock.calls[2][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          historialSql
        ).toContain(
          'INSERT INTO asistencia_revisiones'
        );


        expect(
          query.mock.calls[2][1]
        ).toEqual(
          [
            91,
            7,
            'CORREGIR',
            motivo,
            'INVALIDA_PENDIENTE_REVISION',
            'INVALIDA_PENDIENTE_REVISION',
            '09:00:00',
            '09:00:45',
            '09:00:00',
            '09:01:00',
          ]
        );


        expect(
          connection.commit
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          connection.rollback
        ).not
          .toHaveBeenCalled();


        expect(
          connection.release
        ).toHaveBeenCalledTimes(
          1
        );
      }
    );
  }
);
