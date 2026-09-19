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
  findSponsor:
    typeof findUserById;

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
  token: string
): string {
  return (
    `${getWebBaseUrl()}` +
    '/admin/invitacion' +
    `?invitationId=${encodeURIComponent(invitationId)}` +
    `&token=${encodeURIComponent(token)}`
  );
}


export function buildAdminInviteService(
  deps:
    AdminInviteDependencies =
      defaultDependencies
) {
  async function requestInvitation(
    sponsorUserIdInput: unknown,
    payload: any,
    requestIp?: unknown
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

    const nombre =
      requiredText(
        payload?.nombre,
        'Nombre',
        100
      );

    const apellido =
      requiredText(
        payload?.apellido,
        'Apellido',
        100
      );

    const telefono =
      optionalText(
        payload?.telefono,
        30
      );

    const direccion =
      optionalText(
        payload?.direccion,
        500
      );

    const fechaIngreso =
      validateDate(
        payload?.fecha_ingreso
      );

    const diasVacaciones =
      validateVacationDays(
        payload
          ?.dias_vacaciones_disponibles
      );

    const invitationId =
      deps.generateInvitationId();

    const token =
      deps.generateToken();

    const tokenHmac =
      deps.createTokenHmac(
        invitationId,
        token
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
      });

    if (
      result.status ===
      'active'
    ) {
      throw new AppError(
        'Ya existe una invitación administrativa activa para este correo',
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

    const acceptUrl =
      buildAcceptUrl(
        invitationId,
        token
      );

    try {
      await deps.sendInvitationEmail({
        correo,

        nombre,

        acceptUrl,

        expiresInMinutes:
          ADMIN_INVITE_EXPIRES_MINUTES,
      });

    } catch {
      await deps.revokeInvitation(
        invitationId,
        sponsor.id
      );

      throw new AppError(
        'No fue posible enviar la invitación administrativa',
        502
      );
    }

    return {
      invitationId,

      correo,

      expiresInMinutes:
        ADMIN_INVITE_EXPIRES_MINUTES,

      message:
        'Invitación administrativa enviada correctamente',
    };
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
        'Invitación administrativa inválida o expirada',
        400
      );
    }

    const password =
      validatePassword(
        payload?.contrasena
      );

    const tokenHmac =
      deps.createTokenHmac(
        invitationId,
        token
      );

    const passwordHash =
      await deps.hashPassword(
        password
      );

    const result =
      await deps.acceptInvitation(
        invitationId,
        tokenHmac,
        passwordHash
      );

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
        'Invitación administrativa inválida o expirada',
        400
      );
    }

    return {
      user:
        result.user,

      message:
        'Cuenta administrativa activada correctamente. Inicia sesión para continuar.',
    };
  }


  return {
    requestInvitation,
    acceptInvitation,
  };
}


const defaultService =
  buildAdminInviteService();


export const requestAdminInvitation =
  defaultService.requestInvitation;


export const acceptAdminInvite =
  defaultService.acceptInvitation;
