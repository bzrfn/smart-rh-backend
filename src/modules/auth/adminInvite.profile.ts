import { AppError } from '../../utils/AppError.js';

export const INITIAL_INVITATION_VACATION_DAYS = 12;
export type InvitationProfile = { nombre: string; apellido: string; telefono: string; direccion: string };

export function validateInvitationEntryDate(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const date = new Date(`${text}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== text || Number(text.slice(0, 4)) < 1900 || Number(text.slice(0, 4)) > 2100) {
    throw new AppError('Indica una fecha de ingreso válida.', 400);
  }
  return text;
}

export function validateInvitationProfile(value: unknown): InvitationProfile {
  const data = value as Record<string, unknown> | null;
  function text(field: string, label: string, max: number) {
    const result = typeof data?.[field] === 'string' ? String(data[field]).trim() : '';
    if (!result || result.length > max || /[\u0000-\u001f\u007f]/.test(result)) {
      throw new AppError(`Completa ${label} (máximo ${max} caracteres).`, 400);
    }
    return result;
  }
  const profile = { nombre: text('nombre', 'tu nombre', 100), apellido: text('apellido', 'tus apellidos', 100),
    telefono: text('telefono', 'tu teléfono', 30), direccion: text('direccion', 'tu dirección', 500) };
  const digits = profile.telefono.replace(/\D/g, '');
  if (!/^\+?[\d\s().-]+$/.test(profile.telefono) || digits.length < 7 || digits.length > 15) {
    throw new AppError('Indica un teléfono válido de entre 7 y 15 dígitos.', 400);
  }
  return profile;
}
