import {
  hashPassword,
} from '../../utils/password.js';

import {
  AppError,
} from '../../utils/AppError.js';

import {
  createUser,
  findUserById,
  listUsers,
  roleExists,
  setUserActive,
  setUserVacationDays,
  softDeleteUser,
  updateUser,
} from './users.repository.js';

import {
  validateActiveValue,
  validateCreateUserPayload,
  validateUpdateUserPayload,
  validateUserId,
  validateVacationDays,
} from './users.validation.js';

export const getUsers =
  () => listUsers();

async function ensureRoleExists(
  roleId: number
) {
  const exists =
    await roleExists(
      roleId
    );

  if (!exists) {
    throw new AppError(
      'Rol no encontrado',
      400
    );
  }
}

function rethrowDatabaseError(
  error: any
): never {
  const code =
    String(
      error?.code || ''
    );

  if (
    code ===
    'ER_DUP_ENTRY'
  ) {
    throw new AppError(
      'El correo ya existe',
      409
    );
  }

  if (
    code ===
    'ER_NO_REFERENCED_ROW_2'
  ) {
    throw new AppError(
      'Referencia de usuario o rol inválida',
      400
    );
  }

  throw error;
}

export async function addUser(
  payload: unknown
) {
  const data =
    validateCreateUserPayload(
      payload
    );

  await ensureRoleExists(
    data.rol_id
  );

  const hashed =
    await hashPassword(
      data.contrasena
    );

  try {
    return await createUser({
      ...data,
      contrasena: hashed,
    });
  } catch (error: any) {
    rethrowDatabaseError(
      error
    );
  }
}

export async function editUser(
  rawId: unknown,
  payload: unknown
) {
  const id =
    validateUserId(
      rawId
    );

  const exists =
    await findUserById(id);

  if (!exists) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }

  const data =
    validateUpdateUserPayload(
      payload
    );

  await ensureRoleExists(
    data.rol_id
  );

  try {
    await updateUser(
      id,
      data
    );
  } catch (error: any) {
    rethrowDatabaseError(
      error
    );
  }
}

export async function toggleUser(
  rawId: unknown,
  rawActive: unknown
) {
  const id =
    validateUserId(
      rawId
    );

  const active =
    validateActiveValue(
      rawActive
    );

  const exists =
    await findUserById(id);

  if (!exists) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }

  await setUserActive(
    id,
    active
  );
}

export async function updateUserVacationDays(
  rawId: unknown,
  rawDias: unknown
) {
  const id =
    validateUserId(
      rawId
    );

  const dias =
    validateVacationDays(
      rawDias
    );

  const exists =
    await findUserById(id);

  if (!exists) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }

  await setUserVacationDays(
    id,
    dias
  );
}

export async function deleteUser(
  rawId: unknown
) {
  const id =
    validateUserId(
      rawId
    );

  const exists =
    await findUserById(id);

  if (!exists) {
    throw new AppError(
      'Usuario no encontrado',
      404
    );
  }

  await softDeleteUser(
    id
  );
}
