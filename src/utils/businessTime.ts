import { env } from '../config/env.js';


export type BusinessDateTime = {
  date: string;
  time: string;
  year: number;
  month: number;
  day: number;
};


export type BusinessWeekRange = {
  start: string;
  end: string;
};


function pad2(
  value: number
): string {
  return String(value)
    .padStart(2, '0');
}


function getParts(
  date: Date
) {
  const formatter =
    new Intl.DateTimeFormat(
      'en-CA',
      {
        timeZone:
          env.business.timeZone,

        year:
          'numeric',

        month:
          '2-digit',

        day:
          '2-digit',

        hour:
          '2-digit',

        minute:
          '2-digit',

        second:
          '2-digit',

        hourCycle:
          'h23',
      }
    );


  const parts =
    formatter.formatToParts(
      date
    );


  const values =
    Object.fromEntries(
      parts.map(
        (part) => [
          part.type,
          part.value,
        ]
      )
    );


  return {
    year:
      Number(values.year),

    month:
      Number(values.month),

    day:
      Number(values.day),

    hour:
      Number(values.hour),

    minute:
      Number(values.minute),

    second:
      Number(values.second),
  };
}


export function getBusinessDateTime(
  date = new Date()
): BusinessDateTime {

  const parts =
    getParts(date);


  return {
    date:
      `${parts.year}-${pad2(
        parts.month
      )}-${pad2(
        parts.day
      )}`,

    time:
      `${pad2(
        parts.hour
      )}:${pad2(
        parts.minute
      )}:${pad2(
        parts.second
      )}`,

    year:
      parts.year,

    month:
      parts.month,

    day:
      parts.day,
  };
}


function formatCalendarDate(
  date: Date
): string {
  return [
    date.getUTCFullYear(),
    pad2(
      date.getUTCMonth() + 1
    ),
    pad2(
      date.getUTCDate()
    ),
  ].join('-');
}


export function getBusinessWeekRange(
  date = new Date()
): BusinessWeekRange {

  const current =
    getBusinessDateTime(
      date
    );


  // ----------------------------------------------------------
  // Usamos UTC únicamente como contenedor de una fecha
  // calendario ya convertida a la zona de negocio.
  //
  // No representa el instante real de la jornada.
  // ----------------------------------------------------------

  const calendarDate =
    new Date(
      Date.UTC(
        current.year,
        current.month - 1,
        current.day
      )
    );


  const dayOfWeek =
    calendarDate.getUTCDay();


  const diffToMonday =
    dayOfWeek === 0
      ? -6
      : 1 - dayOfWeek;


  const monday =
    new Date(
      calendarDate.getTime()
    );


  monday.setUTCDate(
    calendarDate.getUTCDate() +
      diffToMonday
  );


  const sunday =
    new Date(
      monday.getTime()
    );


  sunday.setUTCDate(
    monday.getUTCDate() + 6
  );


  return {
    start:
      formatCalendarDate(
        monday
      ),

    end:
      formatCalendarDate(
        sunday
      ),
  };
}
