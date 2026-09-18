import {
  createHash,
  randomBytes,
} from 'node:crypto';


export function createCredentialVerificationToken():
string {
  return randomBytes(32)
    .toString('hex');
}


export function isCredentialVerificationToken(
  token: string
): boolean {
  return /^[a-f0-9]{64}$/i.test(
    String(token || '').trim()
  );
}


export function hashCredentialVerificationToken(
  token: string
): string {
  return createHash('sha256')
    .update(
      String(token || '').trim(),
      'utf8'
    )
    .digest('hex');
}


export function buildCredentialQrPayload(
  token: string
): string {
  return JSON.stringify({
    tipo:
      'CREDENCIAL_SMART_RH',

    token,
  });
}


export function credentialEmployeeCode(
  id: number
): string {
  return `EMP-${String(id).padStart(
    3,
    '0'
  )}`;
}


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
