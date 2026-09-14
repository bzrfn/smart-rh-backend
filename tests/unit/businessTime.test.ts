import {
  getBusinessDateTime,
  getBusinessWeekRange,
} from '../../src/utils/businessTime.js';


describe('businessTime - America/Mexico_City', () => {

  test('convierte correctamente UTC a la fecha laboral de México', () => {
    const date =
      new Date(
        '2026-09-14T05:24:16.000Z'
      );

    expect(
      getBusinessDateTime(date)
    ).toEqual({
      date:
        '2026-09-13',

      time:
        '23:24:16',

      year:
        2026,

      month:
        9,

      day:
        13,
    });
  });


  test('respeta correctamente el cambio de día en México', () => {

    const beforeMidnight =
      getBusinessDateTime(
        new Date(
          '2026-09-14T05:59:59.000Z'
        )
      );


    const midnight =
      getBusinessDateTime(
        new Date(
          '2026-09-14T06:00:00.000Z'
        )
      );


    expect(
      beforeMidnight.date
    ).toBe(
      '2026-09-13'
    );


    expect(
      beforeMidnight.time
    ).toBe(
      '23:59:59'
    );


    expect(
      midnight.date
    ).toBe(
      '2026-09-14'
    );


    expect(
      midnight.time
    ).toBe(
      '00:00:00'
    );
  });


  test('domingo pertenece a la semana anterior', () => {

    const week =
      getBusinessWeekRange(
        new Date(
          '2026-09-14T05:59:59.000Z'
        )
      );


    expect(
      week
    ).toEqual({
      start:
        '2026-09-07',

      end:
        '2026-09-13',
    });
  });


  test('lunes inicia una nueva semana laboral', () => {

    const week =
      getBusinessWeekRange(
        new Date(
          '2026-09-14T06:00:00.000Z'
        )
      );


    expect(
      week
    ).toEqual({
      start:
        '2026-09-14',

      end:
        '2026-09-20',
    });
  });
});
