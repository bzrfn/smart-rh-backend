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


const queryMock =
  pool.query as jest.Mock;


describe(
  'Cambio #3 - repository de historial de revisiones de asistencia',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'lista las revisiones de una asistencia con administrador y orden cronologico',
      async () => {

        const rows =
          [
            {
              id:
                1,

              asistencia_id:
                91,

              admin_usuario_id:
                7,

              admin_nombre:
                'Administrador',

              admin_apellido:
                'SMART RH',

              admin_correo:
                'admin@example.test',

              accion:
                'CORREGIR',

              motivo:
                'Hora corregida con evidencia',

              estado_anterior:
                'INVALIDA_PENDIENTE_REVISION',

              estado_nuevo:
                'pendiente',

              hora_entrada_anterior:
                '09:00:00',

              hora_salida_anterior:
                '09:01:00',

              hora_entrada_nueva:
                '09:00:00',

              hora_salida_nueva:
                '09:03:00',

              created_at:
                '2026-09-21 19:00:00',
            },
          ];


        queryMock
          .mockResolvedValueOnce(
            [
              rows,
              [],
            ]
          );


        const repositoryModule =
          await import(
            '../../src/modules/asistencia/asistencia.repository.js'
          );


        const listAsistenciaRevisiones =
          (
            repositoryModule as any
          ).listAsistenciaRevisiones;


        expect(
          typeof listAsistenciaRevisiones
        ).toBe(
          'function'
        );


        const result =
          await listAsistenciaRevisiones(
            91
          );


        expect(
          queryMock
        ).toHaveBeenCalledTimes(
          1
        );


        const sql =
          String(
            queryMock.mock.calls[0][0]
          )
            .replace(
              /\s+/g,
              ' '
            )
            .trim();


        expect(
          sql
        ).toContain(
          'FROM asistencia_revisiones r'
        );


        expect(
          sql
        ).toContain(
          'JOIN usuarios u ON u.id = r.admin_usuario_id'
        );


        expect(
          sql
        ).toContain(
          'WHERE r.asistencia_id = ?'
        );


        expect(
          sql
        ).toContain(
          'u.nombre AS admin_nombre'
        );


        expect(
          sql
        ).toContain(
          'u.apellido AS admin_apellido'
        );


        expect(
          sql
        ).toContain(
          'u.correo AS admin_correo'
        );


        expect(
          sql
        ).toContain(
          'ORDER BY r.created_at ASC, r.id ASC'
        );


        expect(
          queryMock.mock.calls[0][1]
        ).toEqual(
          [
            91,
          ]
        );


        expect(
          result
        ).toEqual(
          rows
        );
      }
    );
  }
);
