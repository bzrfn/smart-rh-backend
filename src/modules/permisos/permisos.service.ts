import { getPermisosByUserId, updatePermisos } from './permisos.repository.js';
import { AppError } from '../../utils/AppError.js';

export async function getMyPermisos(userId: number) {
  const rows = await getPermisosByUserId(userId);

  const permisos: Record<string, boolean> = {};

  for (const r of rows) {
    permisos[r.modulo] = Boolean(r.habilitado);
  }

  return permisos;
}

export async function getUserPermisos(userId: number) {
  const rows = await getPermisosByUserId(userId);

  const permisos: Record<string, boolean> = {};

  for (const r of rows) {
    permisos[r.modulo] = Boolean(r.habilitado);
  }

  return permisos;
}

export async function updateUserPermisos(userId: number, permisos: Record<string, boolean>) {
  if (!permisos || typeof permisos !== 'object') {
    throw new AppError('Formato de permisos inválido', 400);
  }

  await updatePermisos(userId, permisos);

  return { message: 'Permisos actualizados correctamente' };
}