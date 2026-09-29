import {
  normalizeIncapacidadDateForIntelligence,
} from '../../src/modules/incapacidades/incapacidades.service.js';


describe(
  'Incapacidades - boundary DATE MySQL',
  () => {
    test(
      'canoniza Date usando componentes calendario locales',
      () => {
        const mysqlDate =
          new Date(
            2099,
            10,
            17,
            12,
            0,
            0,
            0
          );


        expect(
          normalizeIncapacidadDateForIntelligence(
            mysqlDate
          )
        ).toBe(
          '2099-11-17'
        );
      }
    );


    test(
      'acepta una fecha string ya persistida',
      () => {
        expect(
          normalizeIncapacidadDateForIntelligence(
            '2099-11-19'
          )
        ).toBe(
          '2099-11-19'
        );


        expect(
          normalizeIncapacidadDateForIntelligence(
            '2099-11-19T00:00:00.000Z'
          )
        ).toBe(
          '2099-11-19'
        );
      }
    );


    test(
      'rechaza valores inválidos',
      () => {
        expect(
          () =>
            normalizeIncapacidadDateForIntelligence(
              new Date(
                Number.NaN
              )
            )
        ).toThrow(
          'Fecha de incapacidad inválida'
        );


        expect(
          () =>
            normalizeIncapacidadDateForIntelligence(
              'fecha-invalida'
            )
        ).toThrow(
          'Fecha de incapacidad inválida'
        );
      }
    );
  }
);
