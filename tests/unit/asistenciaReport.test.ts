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


import {
  listMisAsistenciasByDateRange,
} from '../../src/modules/asistencia/asistencia.repository.js';

import {
  getMisAsistenciasWeeklyReport,
} from '../../src/modules/asistencia/asistencia.service.js';


const listWeeklyMock =
  listMisAsistenciasByDateRange as jest.Mock;


describe(
  'Reporte semanal de asistencia',
  () => {

    beforeEach(() => {

      jest.clearAllMocks();

      jest.useFakeTimers();

      jest.setSystemTime(
        new Date(
          '2026-09-14T12:00:00.000Z'
        )
      );
    });


    afterEach(() => {

      jest.useRealTimers();
    });


    test(
      'serializa una fecha SQL como YYYY-MM-DD',
      async () => {

        listWeeklyMock
          .mockResolvedValue([
            {
              id:
                160,

              fecha:
                new Date(
                  '2026-09-14T00:00:00.000Z'
                ),

              hora_entrada:
                '00:13:52',

              hora_salida:
                '00:14:09',

              estado:
                'pendiente',
            },
          ]);


        const report =
          await getMisAsistenciasWeeklyReport(
            22
          );


        expect(
          report.week
        ).toEqual({
          start:
            '2026-09-14',

          end:
            '2026-09-20',
        });


        expect(
          report.summary
        ).toEqual({
          total:
            1,

          pendientes:
            1,

          pendientes_revision:
            0,

          aprobadas:
            0,

          rechazadas:
            0,

          dias_con_asistencia:
            1,
        });


        expect(
          report.dias[0]
        ).toEqual({
          id:
            160,

          fecha:
            '2026-09-14',

          hora_entrada:
            '00:13:52',

          hora_salida:
            '00:14:09',

          estado:
            'pendiente',
        });
      }
    );
  }
);


// CAMBIO3_TDD_REPORTE_PENDIENTES_REVISION
describe(
  'Cambio #3 - reporte semanal distingue pendientes de revision',
  () => {

    beforeEach(() => {

      jest.clearAllMocks();

      jest.useFakeTimers();

      jest.setSystemTime(
        new Date(
          '2026-09-14T12:00:00.000Z'
        )
      );
    });


    afterEach(() => {
      jest.useRealTimers();
    });


    test(
      'INVALIDA_PENDIENTE_REVISION tiene contador propio y conserva datos de duracion',
      async () => {

        listWeeklyMock
          .mockResolvedValue([
            {
              id:
                161,

              fecha:
                new Date(
                  '2026-09-14T00:00:00.000Z'
                ),

              hora_entrada:
                '08:00:00',

              hora_salida:
                '08:01:30',

              estado:
                'INVALIDA_PENDIENTE_REVISION',

              duracion_minima_aplicada_minutos:
                2,

              duracion_registrada_segundos:
                90,
            },
          ]);


        const report =
          await getMisAsistenciasWeeklyReport(
            22
          );


        expect(
          report.summary
        ).toEqual({
          total:
            1,

          pendientes:
            0,

          pendientes_revision:
            1,

          aprobadas:
            0,

          rechazadas:
            0,

          dias_con_asistencia:
            1,
        });


        expect(
          report.dias[0]
        ).toEqual({
          id:
            161,

          fecha:
            '2026-09-14',

          hora_entrada:
            '08:00:00',

          hora_salida:
            '08:01:30',

          estado:
            'INVALIDA_PENDIENTE_REVISION',

          duracion_minima_aplicada_minutos:
            2,

          duracion_registrada_segundos:
            90,
        });
      }
    );
  }
);
