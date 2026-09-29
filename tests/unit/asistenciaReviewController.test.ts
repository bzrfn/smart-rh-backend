jest.mock(
  '../../src/modules/asistencia/asistencia.service.js',
  () => ({
    approveAsistencia:
      jest.fn(),

    rejectAsistencia:
      jest.fn(),

    justifyAsistencia:
      jest.fn(),

    correctAsistencia:
      jest.fn(),

    getAsistenciaRevisiones:
      jest.fn(),

    cleanupExpiredQrs:
      jest.fn(),

    generateDynamicQr:
      jest.fn(),

    getAsistencias:
      jest.fn(),

    getMisAsistencias:
      jest.fn(),

    getMisAsistenciasWeekly:
      jest.fn(),

    getMisAsistenciasWeeklyReport:
      jest.fn(),

    getPendientes:
      jest.fn(),

    scanQr:
      jest.fn(),
  })
);


jest.mock(
  '../../src/modules/actividad/actividad.service.js',
  () => ({
    registrarActividadEmpleado:
      jest.fn(),
  })
);


import {
  approveAsistencia,
  correctAsistencia,
  getAsistenciaRevisiones,
  justifyAsistencia,
  rejectAsistencia,
} from '../../src/modules/asistencia/asistencia.service.js';

import {
  approveController,
  rejectController,
} from '../../src/modules/asistencia/asistencia.controller.js';


const approveAsistenciaMock =
  approveAsistencia as jest.Mock;

const rejectAsistenciaMock =
  rejectAsistencia as jest.Mock;

const justifyAsistenciaMock =
  justifyAsistencia as jest.Mock;

const correctAsistenciaMock =
  correctAsistencia as jest.Mock;

const getAsistenciaRevisionesMock =
  getAsistenciaRevisiones as jest.Mock;


describe(
  'Cambio #3 - controller de revision administrativa',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      approveAsistenciaMock
        .mockResolvedValue(
          undefined
        );
    });


    test(
      'approveController envia asistencia, administrador autenticado y motivo normalizado',
      async () => {

        const req =
          {
            params: {
              id:
                '91',
            },

            body: {
              motivo:
                '  Salida temprana autorizada por supervisor  ',
            },

            auth: {
              userId:
                7,

              role:
                'admin',
            },
          } as any;


        const json =
          jest.fn();


        const res =
          {
            json,
          } as any;


        const next =
          jest.fn();


        await approveController(
          req,
          res,
          next
        );


        expect(
          approveAsistenciaMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          approveAsistenciaMock
        ).toHaveBeenCalledWith(
          91,
          7,
          'Salida temprana autorizada por supervisor'
        );


        expect(
          json
        ).toHaveBeenCalledWith({
          ok:
            true,

          message:
            'Asistencia aprobada correctamente',
        });


        expect(
          next
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);


// CAMBIO3_TDD_REJECT_CONTROLLER
describe(
  'Cambio #3 - controller de rechazo administrativo',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      rejectAsistenciaMock
        .mockResolvedValue(
          undefined
        );
    });


    test(
      'rejectController envia asistencia, administrador autenticado y motivo normalizado',
      async () => {

        const req =
          {
            params: {
              id:
                '91',
            },

            body: {
              motivo:
                '  Salida temprana rechazada tras revisión  ',
            },

            auth: {
              userId:
                7,

              role:
                'admin',
            },
          } as any;


        const json =
          jest.fn();


        const res =
          {
            json,
          } as any;


        const next =
          jest.fn();


        await rejectController(
          req,
          res,
          next
        );


        expect(
          rejectAsistenciaMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          rejectAsistenciaMock
        ).toHaveBeenCalledWith(
          91,
          7,
          'Salida temprana rechazada tras revisión'
        );


        expect(
          json
        ).toHaveBeenCalledWith({
          ok:
            true,

          message:
            'Asistencia rechazada correctamente',
        });


        expect(
          next
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);


// CAMBIO3_TDD_JUSTIFY_CONTROLLER
describe(
  'Cambio #3 - controller de justificacion administrativa',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      justifyAsistenciaMock
        .mockResolvedValue(
          undefined
        );
    });


    test(
      'justifyController envia asistencia, administrador autenticado y motivo normalizado',
      async () => {

        const req =
          {
            params: {
              id:
                '91',
            },

            body: {
              motivo:
                '  Salida anticipada justificada por cita médica  ',
            },

            auth: {
              userId:
                7,

              role:
                'admin',
            },
          } as any;


        const json =
          jest.fn();


        const res =
          {
            json,
          } as any;


        const next =
          jest.fn();


        const controllerModule =
          await import(
            '../../src/modules/asistencia/asistencia.controller.js'
          );


        const justifyController =
          (
            controllerModule as any
          ).justifyController;


        expect(
          typeof justifyController
        ).toBe(
          'function'
        );


        await justifyController(
          req,
          res,
          next
        );


        expect(
          justifyAsistenciaMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          justifyAsistenciaMock
        ).toHaveBeenCalledWith(
          91,
          7,
          'Salida anticipada justificada por cita médica'
        );


        expect(
          json
        ).toHaveBeenCalledWith({
          ok:
            true,

          message:
            'Asistencia justificada correctamente',
        });


        expect(
          next
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);


// CAMBIO3_TDD_CORRECT_CONTROLLER
describe(
  'Cambio #3 - controller de correccion administrativa',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();

      correctAsistenciaMock
        .mockResolvedValue(
          undefined
        );
    });


    test(
      'correctController envia asistencia, administrador, motivo y horas normalizadas',
      async () => {

        const req =
          {
            params: {
              id:
                '91',
            },

            body: {
              motivo:
                '  Hora de salida corregida con evidencia  ',

              hora_entrada:
                ' 09:00:00 ',

              hora_salida:
                ' 09:03:00 ',
            },

            auth: {
              userId:
                7,

              role:
                'admin',
            },
          } as any;


        const json =
          jest.fn();


        const res =
          {
            json,
          } as any;


        const next =
          jest.fn();


        const controllerModule =
          await import(
            '../../src/modules/asistencia/asistencia.controller.js'
          );


        const correctController =
          (
            controllerModule as any
          ).correctController;


        expect(
          typeof correctController
        ).toBe(
          'function'
        );


        await correctController(
          req,
          res,
          next
        );


        expect(
          correctAsistenciaMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          correctAsistenciaMock
        ).toHaveBeenCalledWith(
          91,
          7,
          'Hora de salida corregida con evidencia',
          '09:00:00',
          '09:03:00'
        );


        expect(
          json
        ).toHaveBeenCalledWith({
          ok:
            true,

          message:
            'Asistencia corregida correctamente',
        });


        expect(
          next
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);


// CAMBIO3_TDD_HISTORY_CONTROLLER
describe(
  'Cambio #3 - controller de historial de revisiones',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'listRevisionesController consulta el historial y lo devuelve al admin',
      async () => {

        const historial =
          [
            {
              id:
                1,

              asistencia_id:
                91,

              admin_usuario_id:
                7,

              accion:
                'CORREGIR',

              motivo:
                'Hora corregida con evidencia',

              estado_anterior:
                'INVALIDA_PENDIENTE_REVISION',

              estado_nuevo:
                'pendiente',
            },
          ];


        getAsistenciaRevisionesMock
          .mockResolvedValue(
            historial
          );


        const req =
          {
            params: {
              id:
                '91',
            },

            auth: {
              userId:
                7,

              role:
                'admin',
            },
          } as any;


        const json =
          jest.fn();


        const res =
          {
            json,
          } as any;


        const next =
          jest.fn();


        const controllerModule =
          await import(
            '../../src/modules/asistencia/asistencia.controller.js'
          );


        const listRevisionesController =
          (
            controllerModule as any
          ).listRevisionesController;


        expect(
          typeof listRevisionesController
        ).toBe(
          'function'
        );


        await listRevisionesController(
          req,
          res,
          next
        );


        expect(
          getAsistenciaRevisionesMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          getAsistenciaRevisionesMock
        ).toHaveBeenCalledWith(
          91
        );


        expect(
          json
        ).toHaveBeenCalledWith({
          ok:
            true,

          data:
            historial,
        });


        expect(
          next
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);
