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
  '../../src/modules/asistencia/asistencia.policy.js',
  () => ({
    obtenerPoliticaAsistencia:
      jest.fn(),
  })
);


import {
  pool,
} from '../../src/config/db.js';

import {
  obtenerPoliticaAsistencia,
} from '../../src/modules/asistencia/asistencia.policy.js';

import {
  sincronizarEventoConAsistencia,
} from '../../src/modules/wearables/wearables.repository.js';


const queryMock =
  pool.query as jest.Mock;

const policyMock =
  obtenerPoliticaAsistencia as jest.Mock;


describe(
  'Cambio #3 - wearable debe respetar validacion automatica de asistencia',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      // America/Mexico_City = 09:01:30.
      jest.setSystemTime(
        new Date(
          '2026-09-21T15:01:30.000Z'
        )
      );


      policyMock
        .mockResolvedValue({
          duracionMinimaMinutos:
            2,
        });
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'una SALIDA wearable temprana queda INVALIDA_PENDIENTE_REVISION',
      async () => {

        queryMock
          // 1. Asistencia abierta existente.
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
                    null,

                  estado:
                    'pendiente',

                  qr_token:
                    'WEAR-ENTRADA',
                },
              ],
              [],
            ]
          )

          // 2. UPDATE de salida.
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  1,
              },
              [],
            ]
          );


        await sincronizarEventoConAsistencia({
          usuario_id:
            22,

          device_id:
            'DEVICE-001',

          tipo_evento:
            'SALIDA',
        });


        expect(
          policyMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const updateSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          updateSql
        ).not
          .toContain(
            "estado = 'aprobada'"
          );


        expect(
          updateSql
        ).toContain(
          'hora_salida = ?'
        );


        expect(
          updateSql
        ).toContain(
          'estado = ?'
        );


        expect(
          updateSql
        ).toContain(
          'duracion_minima_aplicada_minutos = ?'
        );


        expect(
          updateSql
        ).toContain(
          'duracion_registrada_segundos = ?'
        );


        expect(
          queryMock
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'UPDATE asistencias'
          ),
          [
            '09:01:30',
            'INVALIDA_PENDIENTE_REVISION',
            2,
            90,
            91,
          ]
        );
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_ENTRADA_PENDIENTE
describe(
  'Cambio #3 - entrada wearable consistente con QR',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      // America/Mexico_City = 09:15:30
      jest.setSystemTime(
        new Date(
          '2026-09-21T15:15:30.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'una ENTRADA wearable nueva queda pendiente y usa fecha/hora de negocio',
      async () => {

        queryMock
          // 1. No existe asistencia del día.
          .mockResolvedValueOnce(
            [
              [],
              [],
            ]
          )

          // 2. INSERT entrada.
          .mockResolvedValueOnce(
            [
              {
                insertId:
                  92,

                affectedRows:
                  1,
              },
              [],
            ]
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-001',

            tipo_evento:
              'ENTRADA',
          });


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const selectSql =
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


        const insertSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        // No depender de la zona horaria del servidor MySQL.
        expect(
          selectSql
        ).not
          .toContain(
            'CURDATE()'
          );


        expect(
          selectSql
        ).toContain(
          'fecha = ?'
        );


        // Igual que QR: una entrada inicia pendiente.
        expect(
          insertSql
        ).not
          .toContain(
            "'aprobada'"
          );


        expect(
          insertSql
        ).toContain(
          'VALUES (?, ?, ?, ?, ?)'
        );


        expect(
          queryMock
        ).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining(
            'FROM asistencias'
          ),
          [
            22,
            '2026-09-21',
          ]
        );


        expect(
          queryMock
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'INSERT INTO asistencias'
          ),
          [
            22,
            '2026-09-21',
            '09:15:30',
            'pendiente',
            expect.stringMatching(
              /^WEAR-DEVICE-001-\d+$/
            ),
          ]
        );


        expect(
          result
        ).toMatchObject({
          sincronizado:
            true,

          asistencia_id:
            92,
        });
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_SALIDA_SIN_ENTRADA
describe(
  'Cambio #3 - wearable no fabrica salidas sin entrada',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      jest.setSystemTime(
        new Date(
          '2026-09-21T15:30:00.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'una SALIDA wearable sin entrada previa no crea una asistencia incompleta',
      async () => {

        queryMock
          // 1. No existe asistencia del día.
          .mockResolvedValueOnce(
            [
              [],
              [],
            ]
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-001',

            tipo_evento:
              'SALIDA',
          });


        // Solo debe consultar si existe asistencia.
        // No debe ejecutar un INSERT de solo salida.
        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          1
        );


        const executedSql =
          queryMock
            .mock
            .calls
            .map(
              (call) =>
                String(
                  call[0]
                )
                  .replace(
                    /\s+/g,
                    ' '
                  )
                  .trim()
            );


        expect(
          executedSql.some(
            (sql) =>
              sql.includes(
                'INSERT INTO asistencias'
              )
          )
        ).toBe(
          false
        );


        expect(
          result
        ).toEqual({
          sincronizado:
            false,

          asistencia_id:
            null,

          message:
            'No existe una entrada previa para registrar la salida.',
        });
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_ENTRADA_DUPLICADA
describe(
  'Cambio #3 - wearable no altera una entrada ya registrada',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      jest.setSystemTime(
        new Date(
          '2026-09-21T16:00:00.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'una ENTRADA wearable duplicada no fuerza estado aprobada ni ejecuta UPDATE',
      async () => {

        queryMock
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
                    null,

                  estado:
                    'pendiente',

                  qr_token:
                    'WEAR-ENTRADA-INICIAL',
                },
              ],
              [],
            ]
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-001',

            tipo_evento:
              'ENTRADA',
          });


        // Una entrada ya existente debe ser un no-op.
        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          1
        );


        const executedSql =
          queryMock
            .mock
            .calls
            .map(
              (call) =>
                String(
                  call[0]
                )
                  .replace(
                    /\s+/g,
                    ' '
                  )
                  .trim()
            );


        expect(
          executedSql.some(
            (sql) =>
              sql.includes(
                'UPDATE asistencias'
              )
          )
        ).toBe(
          false
        );


        expect(
          executedSql.some(
            (sql) =>
              sql.includes(
                "estado = 'aprobada'"
              )
          )
        ).toBe(
          false
        );


        expect(
          result
        ).toEqual({
          sincronizado:
            false,

          asistencia_id:
            91,

          message:
            'La entrada ya está registrada para hoy.',
        });
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_REPARAR_ENTRADA_FALTANTE
describe(
  'Cambio #3 - wearable repara fila existente sin entrada',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      // America/Mexico_City = 10:30:45
      jest.setSystemTime(
        new Date(
          '2026-09-21T16:30:45.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'una ENTRADA wearable sobre fila sin hora_entrada usa hora de negocio y queda pendiente',
      async () => {

        queryMock
          // 1. Fila anómala existente.
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
                    null,

                  hora_salida:
                    null,

                  estado:
                    'pendiente',

                  qr_token:
                    null,
                },
              ],
              [],
            ]
          )

          // 2. UPDATE reparador.
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  1,
              },
              [],
            ]
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-001',

            tipo_evento:
              'ENTRADA',
          });


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const updateSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          updateSql
        ).not
          .toContain(
            'CURTIME()'
          );


        expect(
          updateSql
        ).not
          .toContain(
            "estado = 'aprobada'"
          );


        expect(
          updateSql
        ).toContain(
          'hora_entrada = ?'
        );


        expect(
          updateSql
        ).toContain(
          'estado = ?'
        );


        expect(
          queryMock
        ).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining(
            'UPDATE asistencias'
          ),
          [
            '10:30:45',
            'pendiente',
            91,
          ]
        );


        expect(
          result
        ).toEqual({
          sincronizado:
            true,

          asistencia_id:
            91,

          message:
            'Entrada actualizada en asistencias.',
        });
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_DOBLE_SALIDA_AFFECTED_ROWS
describe(
  'Cambio #3 - wearable detecta salida concurrente',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      // America/Mexico_City = 09:05:00
      jest.setSystemTime(
        new Date(
          '2026-09-21T15:05:00.000Z'
        )
      );

      jest
        .mocked(
          obtenerPoliticaAsistencia
        )
        .mockResolvedValue({
          duracionMinimaMinutos:
            2,
        });
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'si otra solicitud registra la SALIDA primero y affectedRows es 0 no reporta exito',
      async () => {

        queryMock
          // 1. Ambas solicitudes pudieron leer la fila
          // antes de que una de ellas actualizara.
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
                    null,

                  estado:
                    'pendiente',

                  qr_token:
                    'WEAR-ENTRADA',
                },
              ],
              [],
            ]
          )

          // 2. Al intentar UPDATE, otra solicitud
          // ya llenó hora_salida.
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  0,
              },
              [],
            ]
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-CONCURRENT-001',

            tipo_evento:
              'SALIDA',
          });


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const updateSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          updateSql
        ).toContain(
          'hora_salida IS NULL'
        );


        expect(
          result
        ).toEqual({
          sincronizado:
            false,

          asistencia_id:
            91,

          message:
            'La salida ya está registrada para hoy.',
        });
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_DOBLE_ENTRADA_DUP_KEY
describe(
  'Cambio #3 - wearable maneja entrada concurrente',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      // America/Mexico_City = 09:10:00
      jest.setSystemTime(
        new Date(
          '2026-09-21T15:10:00.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'si otra solicitud crea la ENTRADA primero el ER_DUP_ENTRY se convierte en no-op funcional',
      async () => {

        queryMock
          // 1. Esta solicitud todavía no ve fila.
          .mockResolvedValueOnce(
            [
              [],
              [],
            ]
          )

          // 2. Antes del INSERT, otra solicitud crea
          // la misma combinación usuario_id + fecha.
          .mockRejectedValueOnce(
            Object.assign(
              new Error(
                'Duplicate entry'
              ),
              {
                code:
                  'ER_DUP_ENTRY',

                errno:
                  1062,
              }
            )
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-CONCURRENT-ENTRY',

            tipo_evento:
              'ENTRADA',
          });


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const insertSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          insertSql
        ).toContain(
          'INSERT INTO asistencias'
        );


        expect(
          result
        ).toEqual({
          sincronizado:
            false,

          asistencia_id:
            null,

          message:
            'La entrada ya está registrada para hoy.',
        });
      }
    );
  }
);


// CAMBIO3_TDD_WEARABLE_REPARAR_ENTRADA_AFFECTED_ROWS
describe(
  'Cambio #3 - wearable detecta reparacion concurrente de entrada',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      jest.useFakeTimers();

      // America/Mexico_City = 09:20:00
      jest.setSystemTime(
        new Date(
          '2026-09-21T15:20:00.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'si otra solicitud llena hora_entrada primero y affectedRows es 0 no reporta exito',
      async () => {

        queryMock
          // 1. Esta solicitud observa la fila todavía
          // sin hora_entrada.
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
                    null,

                  hora_salida:
                    null,

                  estado:
                    'pendiente',

                  qr_token:
                    null,
                },
              ],
              [],
            ]
          )

          // 2. Otra solicitud ya llenó hora_entrada,
          // por lo que el guard IS NULL no afecta filas.
          .mockResolvedValueOnce(
            [
              {
                affectedRows:
                  0,
              },
              [],
            ]
          );


        const result =
          await sincronizarEventoConAsistencia({
            usuario_id:
              22,

            device_id:
              'DEVICE-CONCURRENT-REPAIR',

            tipo_evento:
              'ENTRADA',
          });


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          2
        );


        const updateSql =
          String(
            queryMock
              .mock
              .calls[1][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          updateSql
        ).toContain(
          'hora_entrada IS NULL'
        );


        expect(
          result
        ).toEqual({
          sincronizado:
            false,

          asistencia_id:
            91,

          message:
            'La entrada ya está registrada para hoy.',
        });
      }
    );
  }
);
