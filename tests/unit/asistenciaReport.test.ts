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
