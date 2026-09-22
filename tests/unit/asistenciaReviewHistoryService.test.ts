jest.mock(
  '../../src/config/db.js',
  () => ({
    pool: {
      query:
        jest.fn(),

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
    createAsistencia:
      jest.fn(),

    deleteExpiredQrLogs:
      jest.fn(),

    findAsistenciaAbiertaByUserAndFecha:
      jest.fn(),

    findAsistenciaById:
      jest.fn(),

    findAsistenciaByUserAndFecha:
      jest.fn(),

    insertQrLog:
      jest.fn(),

    consumeQrToken:
      jest.fn(),

    listAllAsistencias:
      jest.fn(),

    listAsistenciaRevisiones:
      jest.fn(),

    listMisAsistencias:
      jest.fn(),

    listMisAsistenciasByDateRange:
      jest.fn(),

    listPendientes:
      jest.fn(),

    setAsistenciaEstado:
      jest.fn(),

    setAsistenciaHoraSalida:
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
  findAsistenciaById,
  listAsistenciaRevisiones,
} from '../../src/modules/asistencia/asistencia.repository.js';


const findAsistenciaByIdMock =
  findAsistenciaById as jest.Mock;


const listAsistenciaRevisionesMock =
  listAsistenciaRevisiones as jest.Mock;


describe(
  'Cambio #3 - service de historial de revisiones de asistencia',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'valida existencia de la asistencia y devuelve su historial',
      async () => {

        const asistencia =
          {
            id:
              91,

            usuario_id:
              22,

            fecha:
              '2026-09-21',

            estado:
              'aprobada',
          };


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
                'JUSTIFICAR',

              motivo:
                'Salida anticipada autorizada',
            },
          ];


        findAsistenciaByIdMock
          .mockResolvedValue(
            asistencia
          );


        listAsistenciaRevisionesMock
          .mockResolvedValue(
            historial
          );


        const serviceModule =
          await import(
            '../../src/modules/asistencia/asistencia.service.js'
          );


        const getAsistenciaRevisiones =
          (
            serviceModule as any
          ).getAsistenciaRevisiones;


        expect(
          typeof getAsistenciaRevisiones
        ).toBe(
          'function'
        );


        const result =
          await getAsistenciaRevisiones(
            91
          );


        expect(
          findAsistenciaByIdMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          findAsistenciaByIdMock
        ).toHaveBeenCalledWith(
          91
        );


        expect(
          listAsistenciaRevisionesMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          listAsistenciaRevisionesMock
        ).toHaveBeenCalledWith(
          91
        );


        expect(
          result
        ).toEqual(
          historial
        );
      }
    );


    test(
      'rechaza un id de asistencia invalido antes de consultar repository',
      async () => {

        const serviceModule =
          await import(
            '../../src/modules/asistencia/asistencia.service.js'
          );


        const getAsistenciaRevisiones =
          (
            serviceModule as any
          ).getAsistenciaRevisiones;


        expect(
          typeof getAsistenciaRevisiones
        ).toBe(
          'function'
        );


        await expect(
          getAsistenciaRevisiones(
            0
          )
        ).rejects.toMatchObject({
          statusCode:
            400,
        });


        expect(
          findAsistenciaByIdMock
        ).not
          .toHaveBeenCalled();


        expect(
          listAsistenciaRevisionesMock
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);


describe(
  'Cambio #3 - historial de asistencia inexistente',
  () => {

    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      'devuelve 404 si la asistencia no existe',
      async () => {

        findAsistenciaByIdMock
          .mockResolvedValue(
            null
          );


        const serviceModule =
          await import(
            '../../src/modules/asistencia/asistencia.service.js'
          );


        const getAsistenciaRevisiones =
          (
            serviceModule as any
          ).getAsistenciaRevisiones;


        await expect(
          getAsistenciaRevisiones(
            999999
          )
        ).rejects.toMatchObject({
          statusCode:
            404,
        });


        expect(
          findAsistenciaByIdMock
        ).toHaveBeenCalledTimes(
          1
        );


        expect(
          findAsistenciaByIdMock
        ).toHaveBeenCalledWith(
          999999
        );


        expect(
          listAsistenciaRevisionesMock
        ).not
          .toHaveBeenCalled();
      }
    );
  }
);
