import { INITIAL_INVITATION_VACATION_DAYS, validateInvitationEntryDate, validateInvitationProfile } from './adminInvite.profile.js';
import { inspectAdminInvitation } from './adminInvite.repository.js';
import { findPendingInvitation, listPendingInvitations } from './adminInvite.repository.js';
import {
  AppError,
} from '../../utils/AppError.js';

import {
  hashPassword,
} from '../../utils/password.js';

import {
  findUserById,
} from './auth.repository.js';

import {
  generateAdminInviteId,
  generateAdminInviteToken,
  createAdminInviteTokenHmac,
  createAdminInviteIpHash,
  isValidAdminInviteId,
  isValidAdminInviteToken,
} from './adminInvite.crypto.js';

import {
  acceptAdminInvitation,
  createAdminInvitation,
  revokeAdminInvitation,
} from './adminInvite.repository.js';

import {
  sendAdminInvitationEmail,
} from './adminInvite.email.js';


export const ADMIN_INVITE_EXPIRES_MINUTES =
  30;


type SponsorUser = {
  id: number;
  correo: string;
  activo: number;
  email_verificado: number;
  session_version: number;
  rol_nombre: string;
};


export type AdminInviteDependencies = {
  inspectInvitation: typeof inspectAdminInvitation;
  findPendingInvitation: typeof findPendingInvitation;
  listPendingInvitations: typeof listPendingInvitations;
  findSponsor:
    typeof findUserById;
  findExistingAccount: typeof findUserById;

  generateInvitationId:
    typeof generateAdminInviteId;

  generateToken:
    typeof generateAdminInviteToken;

  createTokenHmac:
    typeof createAdminInviteTokenHmac;

  createIpHash:
    typeof createAdminInviteIpHash;

  createInvitation:
    typeof createAdminInvitation;

  revokeInvitation:
    typeof revokeAdminInvitation;

  acceptInvitation:
    typeof acceptAdminInvitation;

  hashPassword:
    typeof hashPassword;

  sendInvitationEmail:
    typeof sendAdminInvitationEmail;
};


const defaultDependencies:
AdminInviteDependencies = {
  inspectInvitation: inspectAdminInvitation,
  findExistingAccount: findUserById,
  findPendingInvitation,
  listPendingInvitations,
  findSponsor:
    findUserById,

  generateInvitationId:
    generateAdminInviteId,

  generateToken:
    generateAdminInviteToken,

  createTokenHmac:
    createAdminInviteTokenHmac,

  createIpHash:
    createAdminInviteIpHash,

  createInvitation:
    createAdminInvitation,

  revokeInvitation:
    revokeAdminInvitation,

  acceptInvitation:
    acceptAdminInvitation,

  hashPassword,

  sendInvitationEmail:
    sendAdminInvitationEmail,
};


function normalizeEmail(
  value: unknown
): string {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}


function validateEmail(
  value: unknown
): string {
  const correo =
    normalizeEmail(
      value
    );

  if (
    correo.length < 5 ||
    correo.length > 191 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      correo
    )
  ) {
    throw new AppError(
      'Correo inválido',
      400
    );
  }

  return correo;
}


function requiredText(
  value: unknown,
  label: string,
  maxLength: number
): string {
  const text =
    String(
      value ||
      ''
    ).trim();

  if (
    !text ||
    text.length > maxLength
  ) {
    throw new AppError(
      `${label} inválido`,
      400
    );
  }

  return text;
}


function optionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  if (
    !text ||
    text.length > maxLength
  ) {
    throw new AppError(
      'Dato opcional inválido',
      400
    );
  }

  return text;
}


function validatePassword(
  value: unknown
): string {
  if (
    typeof value !==
    'string'
  ) {
    throw new AppError(
      'La contraseña es obligatoria',
      400
    );
  }

  if (
    value.length < 8 ||
    value.length > 128 ||
    !value.trim()
  ) {
    throw new AppError(
      'La contraseña debe tener entre 8 y 128 caracteres',
      400
    );
  }

  return value;
}


function validateVacationDays(
  value: unknown
): number {
  const numeric =
    value === undefined ||
    value === null ||
    value === ''
      ? 12
      : Number(value);

  if (
    !Number.isInteger(
      numeric
    ) ||
    numeric < 0 ||
    numeric > 365
  ) {
    throw new AppError(
      'Días de vacaciones inválidos',
      400
    );
  }

  return numeric;
}


function validateDate(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {
    throw new AppError(
      'Fecha de ingreso inválida',
      400
    );
  }

  return text;
}


function validateInviteRole(
  value: unknown
): 'admin' | 'empleado' {
  const role = String(
    value || 'admin'
  )
    .trim()
    .toLowerCase();

  if (
    role !== 'admin' &&
    role !== 'empleado'
  ) {
    throw new AppError(
      'Tipo de cuenta inválido',
      400
    );
  }

  return role;
}


function isEligibleSponsor(
  user:
    SponsorUser |
    null |
    undefined
): user is SponsorUser {
  return Boolean(
    user &&
    Number(
      user.activo
    ) ===
      1 &&
    Number(
      user.email_verificado
    ) ===
      1 &&
    String(
      user.rol_nombre ||
      ''
    )
      .trim()
      .toLowerCase() ===
      'admin' &&
    Number.isInteger(
      Number(
        user.session_version
      )
    )
  );
}


function getWebBaseUrl():
string {
  const configured =
    String(
      process.env
        .ADMIN_INVITE_WEB_BASE_URL ||
      ''
    )
      .trim()
      .replace(
        /\/+$/,
        ''
      );

  if (configured) {
    return configured;
  }

  return 'http://localhost:5173';
}


function buildAcceptUrl(
  invitationId: string,
  token: string,
  accountType: 'admin' | 'empleado'
): string {
  return (
    `${getWebBaseUrl()}` +
    '/activar-cuenta' +
    `?invitationId=${encodeURIComponent(invitationId)}` +
    `&token=${encodeURIComponent(token)}` +
    `&tipoCuenta=${encodeURIComponent(accountType)}`
  );
}


export function buildAdminInviteService(overrides: Partial<AdminInviteDependencies> = {}) {
  const deps: AdminInviteDependencies = { ...defaultDependencies, ...overrides };
  async function requestInvitation(
    sponsorUserIdInput: unknown,
    payload: any,
    requestIp?: unknown,
    replacesInvitationId?: string,
    existingAccount?: { id: number; session_version: number },
    legacyProfile = false
  ) {
    const sponsorUserId =
      Number(
        sponsorUserIdInput
      );

    if (
      !Number.isInteger(
        sponsorUserId
      ) ||
      sponsorUserId <= 0
    ) {
      throw new AppError(
        'Sesión administrativa inválida',
        401
      );
    }

    const sponsor =
      await deps.findSponsor(
        sponsorUserId
      ) as SponsorUser | null;

    if (
      !isEligibleSponsor(
        sponsor
      )
    ) {
      throw new AppError(
        'Administrador no autorizado',
        403
      );
    }

    const correo =
      validateEmail(
        payload?.correo
      );

    if (!['admin', 'empleado'].includes(payload?.tipo_cuenta)) throw new AppError('Selecciona el rol de la invitación.', 400);
    const inviteRole = validateInviteRole(payload.tipo_cuenta);

    const profileCompletionRequired = !existingAccount && !legacyProfile;
    const nombre = profileCompletionRequired ? '' : requiredText(payload?.nombre, 'Nombre', 100);
    const apellido = profileCompletionRequired ? '' : requiredText(payload?.apellido, 'Apellido', 100);
    const telefono = profileCompletionRequired ? null : optionalText(payload?.telefono, 30);
    const direccion = profileCompletionRequired ? null : optionalText(payload?.direccion, 500);
    const fechaIngreso = profileCompletionRequired
      ? validateInvitationEntryDate(payload?.fecha_ingreso) : validateDate(payload?.fecha_ingreso);
    const diasVacaciones = profileCompletionRequired
      ? INITIAL_INVITATION_VACATION_DAYS : validateVacationDays(payload?.dias_vacaciones_disponibles);

    const invitationId =
      deps.generateInvitationId();

    const token =
      deps.generateToken();

    const tokenHmac =
      deps.createTokenHmac(
        invitationId,
        token,
        inviteRole
      );

    const requestIpHash =
      deps.createIpHash(
        requestIp
      );

    const result =
      await deps.createInvitation({
        invitationId,
        tokenHmac,

        sponsorAdminId:
          sponsor.id,

        sponsorSessionVersion:
          Number(
            sponsor.session_version
          ),

        inviteEmail:
          correo,

        nombre,
        apellido,

        telefono,
        direccion,

        fechaIngreso,

        diasVacacionesDisponibles:
          diasVacaciones,

        requestIpHash,

        expiresInMinutes:
          ADMIN_INVITE_EXPIRES_MINUTES,
        accountType: inviteRole,
        replacesInvitationId,
        profileCompletionRequired,
        existingUserId: existingAccount?.id,
        existingUserSessionVersion: existingAccount?.session_version,
      });

    if (
      result.status ===
      'active'
    ) {
      throw new AppError(
        'Ya existe una invitación activa para este correo',
        409
      );
    }

    if (
      result.status ===
      'user_exists'
    ) {
      throw new AppError(
        'El correo ya pertenece a un usuario',
        409
      );
    }

    if (
      result.status ===
        'sponsor_invalid' ||
      result.status ===
        'sponsor_stale'
    ) {
      throw new AppError(
        'La sesión administrativa ya no es válida',
        401
      );
    }

    if (result.status === 'invitation_unavailable') {
      throw new AppError('La invitación ya fue aceptada o sustituida. Actualiza el listado.', 409);
    }
    if (result.status === 'cooldown') {
      throw new AppError('Espera un minuto entre reenvíos de una misma invitación.', 429);
    }

    let acceptUrl =
      buildAcceptUrl(
        invitationId,
        token,
        inviteRole
      );

    if (existingAccount) acceptUrl += "&existingAccount=1";

    try {
      await deps.sendInvitationEmail({
        correo,

        nombre,

        accountType:
          inviteRole,

        acceptUrl,

        expiresInMinutes:
          ADMIN_INVITE_EXPIRES_MINUTES,
      });

    } catch {
      await deps.revokeInvitation(
        invitationId,
        sponsor.id,
        'delivery_failed'
      );

      throw new AppError(
        'No fue posible enviar la invitación por correo',
        502
      );
    }

    return {
      invitationId,

      correo,

      expiresInMinutes:
        ADMIN_INVITE_EXPIRES_MINUTES,

      message:
        inviteRole === 'admin'
          ? 'Invitación administrativa enviada correctamente'
          : 'Invitación de empleado enviada correctamente',
    };
  }


  async function resendExistingAccount(sponsorUserId: unknown, targetId: unknown, requestIp?: unknown) {
    const sponsor = await deps.findSponsor(Number(sponsorUserId)) as SponsorUser | null;
    if (!isEligibleSponsor(sponsor)) throw new AppError('Administrador no autorizado', 403);
    const id = Number(targetId);
    if (!Number.isSafeInteger(id) || id<=0) throw new AppError('Usuario inválido', 400);
    const target = await deps.findExistingAccount(id);
    if (!target || Number(target.activo)!==1) throw new AppError('La cuenta no existe o está desactivada.', 409);
    const role = String(target.rol_nombre || '').toLowerCase();
    const entryDate: unknown = target.fecha_ingreso;
    if (!['admin', 'empleado'].includes(role)) throw new AppError('El rol de la cuenta no admite invitaciones.', 409);
    return requestInvitation(sponsorUserId, {
      correo: target.correo, nombre: target.nombre, apellido: target.apellido,
      telefono: target.telefono, direccion: target.direccion,
      fecha_ingreso: entryDate instanceof Date ? entryDate.toISOString().slice(0,10) : entryDate ? String(entryDate).slice(0,10) : null,
      dias_vacaciones_disponibles: target.dias_vacaciones_disponibles ?? 12, tipo_cuenta: role,
    }, requestIp, undefined, { id: Number(target.id), session_version: Number(target.session_version) });
  }

  async function pendingInvitations(sponsorUserId: unknown) {
    const sponsor = await deps.findSponsor(Number(sponsorUserId)) as SponsorUser | null;
    if (!isEligibleSponsor(sponsor)) throw new AppError('Administrador no autorizado', 403);
    return deps.listPendingInvitations();
  }

  async function resendInvitation(sponsorUserId: unknown, rawId: unknown, payload: any, requestIp?: unknown) {
    const sponsor = await deps.findSponsor(Number(sponsorUserId)) as SponsorUser | null;
    if (!isEligibleSponsor(sponsor)) throw new AppError('Administrador no autorizado', 403);
    const id = String(rawId || '');
    if (!/^[a-f0-9]{64}$/.test(id)) throw new AppError('Invitación inválida', 400);
    const original = await deps.findPendingInvitation(id);
    if (!original) throw new AppError('La invitación ya fue aceptada o sustituida. Actualiza el listado.', 409);
    // Older invitations did not persist the role. Require an explicit administrative choice.
    if (!original.account_type && !['admin', 'empleado'].includes(payload?.tipo_cuenta)) {
      throw new AppError('Selecciona el tipo de cuenta de esta invitación anterior antes de reenviarla.', 400);
    }
    const role = original.account_type || validateInviteRole(payload.tipo_cuenta);
    if (original.account_type && payload?.tipo_cuenta && payload.tipo_cuenta !== role) {
      throw new AppError('El reenvío no puede cambiar el rol de la invitación.', 409);
    }
    return requestInvitation(sponsorUserId, {
      correo: original.invite_email, nombre: original.nombre, apellido: original.apellido,
      telefono: original.telefono, direccion: original.direccion,
      fecha_ingreso: original.fecha_ingreso instanceof Date ? original.fecha_ingreso.toISOString().slice(0, 10) : original.fecha_ingreso ? String(original.fecha_ingreso).slice(0, 10) : null,
      dias_vacaciones_disponibles: original.dias_vacaciones_disponibles, tipo_cuenta: role,
    }, requestIp, id, undefined, !Number(original.profile_completion_required));
  }

  async function acceptInvitation(
    payload: any
  ) {
    const invitationId =
      String(
        payload?.invitationId ||
        ''
      )
        .trim()
        .toLowerCase();

    const token =
      String(
        payload?.token ||
        ''
      )
        .trim()
        .toLowerCase();

    if (
      !isValidAdminInviteId(
        invitationId
      ) ||
      !isValidAdminInviteToken(
        token
      )
    ) {
      throw new AppError(
        'Invitación inválida o expirada',
        400
      );
    }

    const password =
      validatePassword(
        payload?.contrasena
      );

    const inviteRole =
      validateInviteRole(
        payload?.tipoCuenta
      );

    const tokenHmac =
      deps.createTokenHmac(
        invitationId,
        token,
        inviteRole
      );

    const profile = payload?.perfil == null ? undefined : validateInvitationProfile(payload.perfil);

    const passwordHash =
      await deps.hashPassword(
        password
      );

    const result = profile
      ? await deps.acceptInvitation(invitationId, tokenHmac, passwordHash, inviteRole, profile)
      : await deps.acceptInvitation(invitationId, tokenHmac, passwordHash, inviteRole);

    if (result.status === 'profile_required') throw new AppError('Completa tu nombre, apellidos, teléfono y dirección para activar tu cuenta.', 400);

    if (
      result.status ===
      'user_exists'
    ) {
      throw new AppError(
        'El correo ya pertenece a un usuario',
        409
      );
    }

    if (
      result.status !==
      'ok'
    ) {
      throw new AppError(
        'Invitación inválida o expirada',
        400
      );
    }

    return {
      user:
        result.user,

      message:
        result.user.role === 'admin'
          ? 'Cuenta administrativa activada correctamente. Inicia sesión para continuar.'
          : 'Cuenta de empleado activada correctamente. Ya puedes iniciar sesión en SMART RH.',
    };
  }


  async function inspectInvitation(payload: any) {
    const id = String(payload?.invitationId || '').trim().toLowerCase();
    const token = String(payload?.token || '').trim().toLowerCase();
    if (!isValidAdminInviteId(id) || !isValidAdminInviteToken(token)) throw new AppError('Invitación inválida o expirada', 400);
    const role = validateInviteRole(payload?.tipoCuenta);
    const result = await deps.inspectInvitation(id, deps.createTokenHmac(id, token, role), role);
    if (!result) throw new AppError('Invitación inválida o expirada', 400);
    return { invitation: result };
  }

  return {
    requestInvitation,
    inspectInvitation,
    acceptInvitation,
    pendingInvitations,
    resendExistingAccount,
    resendInvitation,
  };
}


const defaultService =
  buildAdminInviteService();


export const requestAdminInvitation =
  defaultService.requestInvitation;


export const acceptAdminInvite =
  defaultService.acceptInvitation;

export const getPendingInvitations = defaultService.pendingInvitations;
export const resendAdminInvitation = defaultService.resendInvitation;

export const resendExistingAccountInvitation = defaultService.resendExistingAccount;

export const inspectAdminInvite = defaultService.inspectInvitation;
