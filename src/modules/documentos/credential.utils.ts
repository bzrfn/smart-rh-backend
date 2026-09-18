/**
 * Agrega un mes calendario conservando el día cuando existe.
 *
 * Ejemplos:
 * 15 enero  -> 15 febrero
 * 31 enero  -> último día de febrero
 * 31 agosto -> 30 septiembre
 *
 * No modifica la fecha recibida.
 */
export function addOneCalendarMonthClamped(
  baseDate: Date
): Date {
  const result =
    new Date(
      baseDate.getTime()
    );

  const originalDay =
    result.getDate();

  result.setDate(1);

  result.setMonth(
    result.getMonth() + 1
  );

  const lastDayOfTargetMonth =
    new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0
    ).getDate();

  result.setDate(
    Math.min(
      originalDay,
      lastDayOfTargetMonth
    )
  );

  return result;
}
