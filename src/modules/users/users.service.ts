import {
  hashPassword,
} from '../../utils/password.js';

import {
  AppError,
} from '../../utils/AppError.js';

import {
  createUser,
  findRoleNameById,
  findUserById,
  listUsers,
  roleExists,
  setUserActive,
  setUserActiveWithAdminLock,
  setUserVacationDays,
  softDeleteUserWithAdminLock,
  updateUser,
  updateUserWithAdminLock,
} from './users.repository.js';

import {
  assertAdminLockoutProtection,
  isAdminRole,
} from './users.security.js';

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

  const requestedRole =
    await findRoleNameById(
      data.rol_id
    );

  if (
    isAdminRole(
      requestedRole
    )
  ) {
    throw new AppError(
      'Las cuentas administrativas se crean únicamente mediante invitación',
      409
    );
  }

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
  payload: unknown,
  rawActorId?: unknown
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

  const nextRole =
    await findRoleNameById(
      data.rol_id
    );

  if (
    Number(
      exists.rol_id
    ) !==
      Number(
        data.rol_id
      ) &&
    isAdminRole(
      nextRole
    )
  ) {
    throw new AppError(
      'La promoción a administrador requiere una invitación administrativa',
      409
    );
  }

  const actorId =
    rawActorId === undefined
      ? null
      : validateUserId(
          rawActorId
        );

  try {
    /*
     * Si el rol destino NO es admin, la actualización
     * podría retirar privilegios administrativos.
     *
     * La validación y el UPDATE se realizan dentro
     * de una misma transacción con bloqueo.
     */
    if (
      !isAdminRole(
        nextRole
      )
    ) {
      await updateUserWithAdminLock(
        id,
        data,
        ({
          target,
          activeAdminCount,
        }) => {
          if (!target) {
            throw new AppError(
              'Usuario no encontrado',
              404
            );
          }

          assertAdminLockoutProtection({
            actorUserId:
              actorId,
            targetUserId:
              id,
            targetRole:
              target.role,
            targetActive:
              Boolean(
                target.activo
              ),
            activeAdminCount,
            operation:
              'demote',
            nextRole,
          });
        }
      );

      return;
    }

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
  rawActive: unknown,
  rawActorId?: unknown
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

  if (active) {
    await setUserActive(
      id,
      true
    );

    return;
  }

  const actorId =
    rawActorId === undefined
      ? null
      : validateUserId(
          rawActorId
        );

  await setUserActiveWithAdminLock(
    id,
    false,
    ({
      target,
      activeAdminCount,
    }) => {
      if (!target) {
        throw new AppError(
          'Usuario no encontrado',
          404
        );
      }

      assertAdminLockoutProtection({
        actorUserId:
          actorId,
        targetUserId:
          id,
        targetRole:
          target.role,
        targetActive:
          Boolean(
            target.activo
          ),
        activeAdminCount,
        operation:
          'deactivate',
      });
    }
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
  rawId: unknown,
  rawActorId?: unknown
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

  const actorId =
    rawActorId === undefined
      ? null
      : validateUserId(
          rawActorId
        );

  await softDeleteUserWithAdminLock(
    id,
    ({
      target,
      activeAdminCount,
    }) => {
      if (!target) {
        throw new AppError(
          'Usuario no encontrado',
          404
        );
      }

      assertAdminLockoutProtection({
        actorUserId:
          actorId,
        targetUserId:
          id,
        targetRole:
          target.role,
        targetActive:
          Boolean(
            target.activo
          ),
        activeAdminCount,
        operation:
          'delete',
      });
    }
  );
}
