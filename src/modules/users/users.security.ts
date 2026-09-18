import {
  AppError,
} from '../../utils/AppError.js';

export type AdminLockoutOperation =
  | 'deactivate'
  | 'delete'
  | 'demote';

export type AdminLockoutInput = {
  actorUserId: number | null;
  targetUserId: number;
  targetRole: string;
  targetActive: boolean;
  activeAdminCount: number;
  operation: AdminLockoutOperation;
  nextRole?: string | null;
};

export function isAdminRole(
  role: unknown
): boolean {
  return String(
    role || ''
  )
    .trim()
    .toLowerCase() === 'admin';
}

export function assertAdminLockoutProtection(
  input: AdminLockoutInput
): void {
  const {
    actorUserId,
    targetUserId,
    targetRole,
    targetActive,
    activeAdminCount,
    operation,
    nextRole,
  } = input;

  if (
    !targetActive ||
    !isAdminRole(targetRole)
  ) {
    return;
  }

  const removesAdminAccess =
    operation === 'deactivate' ||
    operation === 'delete' ||
    (
      operation === 'demote' &&
      !isAdminRole(nextRole)
    );

  if (!removesAdminAccess) {
    return;
  }

  if (
    actorUserId !== null &&
    actorUserId === targetUserId
  ) {
    if (operation === 'demote') {
      throw new AppError(
        'No puedes retirar tu propio rol de administrador',
        409
      );
    }

    if (operation === 'delete') {
      throw new AppError(
        'No puedes eliminar tu propia cuenta de administrador',
        409
      );
    }

    throw new AppError(
      'No puedes desactivar tu propia cuenta de administrador',
      409
    );
  }

  if (activeAdminCount <= 1) {
    throw new AppError(
      'No se puede modificar el acceso del último administrador activo',
      409
    );
  }
}
