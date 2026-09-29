import {
  evaluarDuracionAsistencia,
} from '../../src/modules/asistencia/asistencia.validation.js';

describe(
  'Cambio #3 - validacion automatica de asistencia',
  () => {
    test(
      'una salida exactamente al cumplir 2 minutos conserva estado pendiente',
      () => {
        const result =
          evaluarDuracionAsistencia({
            horaEntrada: '09:00:00',
            horaSalida: '09:02:00',
            duracionMinimaMinutos: 2,
          });

        expect(result).toEqual({
          duracionSegundos: 120,
          cumpleMinimo: true,
          estadoSalida: 'pendiente',
        });
      }
    );

    test(
      'una salida antes de 2 minutos queda pendiente de revision',
      () => {
        const result =
          evaluarDuracionAsistencia({
            horaEntrada: '09:00:00',
            horaSalida: '09:01:59',
            duracionMinimaMinutos: 2,
          });

        expect(result).toEqual({
          duracionSegundos: 119,
          cumpleMinimo: false,
          estadoSalida:
            'INVALIDA_PENDIENTE_REVISION',
        });
      }
    );

    test(
      'una salida posterior al minimo conserva flujo normal',
      () => {
        const result =
          evaluarDuracionAsistencia({
            horaEntrada: '09:00:00',
            horaSalida: '09:05:00',
            duracionMinimaMinutos: 2,
          });

        expect(result).toEqual({
          duracionSegundos: 300,
          cumpleMinimo: true,
          estadoSalida: 'pendiente',
        });
      }
    );

    test(
      'rechaza una politica con duracion minima invalida',
      () => {
        expect(() =>
          evaluarDuracionAsistencia({
            horaEntrada: '09:00:00',
            horaSalida: '09:05:00',
            duracionMinimaMinutos: 0,
          })
        ).toThrow();
      }
    );
  }
);
