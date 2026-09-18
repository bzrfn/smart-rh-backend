import {
  getPermisosByUserId,
  updatePermisos,
} from './permisos.repository.js';

import {
  isModuloPermiso,
  MODULOS_PERMITIDOS,
  ModuloPermiso,
  PermisosUsuario,
} from './permisos.types.js';

import {
  findUserById,
} from '../users/users.repository.js';

import { AppError } from '../../utils/AppError.js';

function validateUserId(
  value: unknown
): number {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    throw new AppError(
      'ID de usuario inválido',
      400
    );
  }

  return id;
}

function createDefaultPermisos():
  Record<ModuloPermiso, boolean> {
  return {
    asistencia: false,
    contratos: false,
    nomina: false,
    vacaciones: false,
  };
}

function mapPermisos(
  rows: {
    modulo: string;
    habilitado: number;
  }[]
) {
  const permisos =
    createDefaultPermisos();

  for (const row of rows) {
    if (
      isModuloPermiso(
        row.modulo
      )
    ) {
      permisos[row.modulo] =
        Boolean(
          row.habilitado
        );
    }
  }

  return permisos;
}

export function validatePermissionsPayload(
  payload: unknown
): PermisosUsuario {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    throw new AppError(
      'Formato de permisos inválido',
      400
    );
  }

  const entries =
    Object.entries(
      payload as Record<string, unknown>
    );

  if (
    entries.length === 0
  ) {
    throw new AppError(
      'Debes indicar al menos un permiso',
      400
    );
  }

  const result:
    PermisosUsuario = {};

  for (
    const [
      modulo,
      habilitado,
    ] of entries
  ) {
    if (
      !isModuloPermiso(
        modulo
      )
    ) {
      throw new AppError(
        `Módulo no permitido: ${modulo}`,
        400
      );
    }

    if (
      typeof habilitado !==
      'boolean'
    ) {
      throw new AppError(
        `El permiso ${modulo} debe ser booleano`,
        400
      );
    }

    result[modulo] =
      habilitado;
  }

  return result;
}

export async function getMyPermisos(
  userId: number
) {
  const id =
    validateUserId(userId);

  const rows =
    await getPermisosByUserId(
      id
    );

  return mapPermisos(rows);
}

export async function getUserPermisos(
  userId: number
) {
  const id =
    validateUserId(userId);

  const user =
    await findUserById(id);

  if (!user) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }

  const rows =
    await getPermisosByUserId(
      id
    );

  return mapPermisos(rows);
}

export async function updateUserPermisos(
  userId: number,
  payload: unknown
) {
  const id =
    validateUserId(userId);

  const user =
    await findUserById(id);

  if (!user) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }

  const permisos =
    validatePermissionsPayload(
      payload
    );

  await updatePermisos(
    id,
    permisos
  );

  return {
    message:
      'Permisos actualizados correctamente',
  };
}

export {
  MODULOS_PERMITIDOS,
};
