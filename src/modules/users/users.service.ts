import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/AppError.js';
import {
  createUser,
  findUserById,
  listUsers,
  setUserActive,
  setUserVacationDays,
  softDeleteUser,
  updateUser,
} from './users.repository.js';

export const getUsers = () => listUsers();

export async function addUser(payload: any) {
  if (!payload.nombre || !payload.apellido || !payload.correo || !payload.contrasena || !payload.rol_id) {
    throw new AppError('Faltan datos obligatorios del usuario', 400);
  }

  const hashed = await hashPassword(payload.contrasena);

  try {
    return await createUser({
      ...payload,
      contrasena: hashed,
      telefono: payload.telefono || null,
      direccion: payload.direccion || null,
      fecha_ingreso: payload.fecha_ingreso || null,
      dias_vacaciones_disponibles: payload.dias_vacaciones_disponibles ?? 12,
    });
  } catch (e: any) {
    if (String(e?.code) === 'ER_DUP_ENTRY') {
      throw new AppError('correo ya existe', 409);
    }

    throw e;
  }
}

export async function editUser(id: number, payload: any) {
  if (!id || id <= 0) {
    throw new AppError('ID de usuario inválido', 400);
  }

  const exists = await findUserById(id);

  if (!exists) {
    throw new AppError('Usuario no encontrado', 404);
  }

  if (!payload.nombre || !payload.apellido || !payload.correo || !payload.rol_id) {
    throw new AppError('Faltan datos obligatorios del usuario', 400);
  }

  try {
    await updateUser(id, {
      nombre: payload.nombre,
      apellido: payload.apellido,
      correo: payload.correo,
      rol_id: payload.rol_id,
      telefono: payload.telefono || null,
      direccion: payload.direccion || null,
      fecha_ingreso: payload.fecha_ingreso || null,
      dias_vacaciones_disponibles: payload.dias_vacaciones_disponibles ?? 12,
    });
  } catch (e: any) {
    if (String(e?.code) === 'ER_DUP_ENTRY') {
      throw new AppError('correo ya existe', 409);
    }

    throw e;
  }
}

export const toggleUser = (id: number, active: boolean) => setUserActive(id, active);

export async function updateUserVacationDays(id: number, dias: number) {
  if (!id || id <= 0) {
    throw new AppError('ID de usuario inválido', 400);
  }

  if (Number.isNaN(dias) || dias < 0) {
    throw new AppError('Los días de vacaciones deben ser un número mayor o igual a 0', 400);
  }

  await setUserVacationDays(id, dias);
}

export async function deleteUser(id: number) {
  if (!id || id <= 0) {
    throw new AppError('ID de usuario inválido', 400);
  }

  const exists = await findUserById(id);

  if (!exists) {
    throw new AppError('Usuario no encontrado', 404);
  }

  await softDeleteUser(id);
}