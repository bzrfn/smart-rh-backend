import {
  AppError,
} from '../../utils/AppError.js';

import {
  registrarEventoSistema,
} from '../eventosSistema/eventosSistema.service.js';

import {
  createAdminAccessCodeHmac,
  createAdminAccessIpHash,
  generateAdminAccessChallengeId,
  generateAdminAccessCode,
  isValidAdminAccessChallengeId,
  isValidAdminAccessCode,
} from './adminAccess.crypto.js';

import {
  countRecentAdminChallenges,
  countRecentIpChallenges,
  createAdminAccessChallenge,
  findEligibleAdminByEmail,
  findLatestActiveAdminChallenge,
  invalidateActiveAdminChallenges,
  consumeAdminAccessChallenge,
} from './adminAccess.repository.js';

import {
  sendAdminAccessCodeEmail,
} from './adminAccess.email.js';

import {
  signAdminAccessToken,
} from './adminAccess.token.js';


export const ADMIN_ACCESS_CODE_EXPIRES_MINUTES =
  10;

export const ADMIN_ACCESS_MAX_ATTEMPTS =
  5;

export const ADMIN_ACCESS_COOLDOWN_SECONDS =
  60;

export const ADMIN_ACCESS_RATE_WINDOW_MINUTES =
  15;

export const ADMIN_ACCESS_MAX_PER_ADMIN_WINDOW =
  3;

export const ADMIN_ACCESS_MAX_PER_IP_WINDOW =
  8;


type RegisterEventInput =
  Record<
    string,
    unknown
  >;


export type AdminAccessDependencies = {
  findEligibleAdminByEmail:
    typeof findEligibleAdminByEmail;

  findLatestActiveAdminChallenge:
    typeof findLatestActiveAdminChallenge;

  countRecentAdminChallenges:
    typeof countRecentAdminChallenges;

  countRecentIpChallenges:
    typeof countRecentIpChallenges;

  invalidateActiveAdminChallenges:
    typeof invalidateActiveAdminChallenges;

  createAdminAccessChallenge:
    typeof createAdminAccessChallenge;

  consumeAdminAccessChallenge:
    typeof consumeAdminAccessChallenge;

  sendAdminAccessCodeEmail:
    typeof sendAdminAccessCodeEmail;

  registerEvent:
    (
      input:
        RegisterEventInput
    ) => Promise<unknown>;
};


const defaultDependencies:
  AdminAccessDependencies = {
    findEligibleAdminByEmail,

    findLatestActiveAdminChallenge,

    countRecentAdminChallenges,

    countRecentIpChallenges,

    invalidateActiveAdminChallenges,

    createAdminAccessChallenge,

    consumeAdminAccessChallenge,

    sendAdminAccessCodeEmail,

    registerEvent:
      registrarEventoSistema as (
        input:
          RegisterEventInput
      ) => Promise<unknown>,
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


function looksLikeEmail(
  value: string
): boolean {
  return (
    value.length >= 5 &&
    value.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    )
  );
}


function getAdminName(
  admin: {
    nombre: string;
    apellido: string;
    correo: string;
  }
): string {
  const fullName =
    `${admin.nombre || ''} ${admin.apellido || ''}`
      .trim();

  return (
    fullName ||
    admin.correo
  );
}


function neutralRequestResponse(
  challengeId:
    string
) {
  return {
    accepted:
      true,

    challengeId,

    expiresInMinutes:
      ADMIN_ACCESS_CODE_EXPIRES_MINUTES,

    message:
      'Si el correo corresponde a un administrador habilitado, se envió un código de autorización.',
  };
}


async function safeAudit(
  deps:
    AdminAccessDependencies,

  input:
    RegisterEventInput
): Promise<void> {
  try {
    await deps.registerEvent(
      input
    );
  } catch {
    return;
  }
}


export function buildAdminAccessService(
  deps:
    AdminAccessDependencies =
      defaultDependencies
) {
  async function requestAdminAccess(
    correoInput: unknown,
    ipInput?: unknown
  ) {
    const fallbackChallengeId =
      generateAdminAccessChallengeId();

    const correo =
      normalizeEmail(
        correoInput
      );

    if (
      !looksLikeEmail(
        correo
      )
    ) {
      return neutralRequestResponse(
        fallbackChallengeId
      );
    }

    const admin =
      await deps.findEligibleAdminByEmail(
        correo
      );

    if (!admin) {
      return neutralRequestResponse(
        fallbackChallengeId
      );
    }

    const activeChallenge =
      await deps.findLatestActiveAdminChallenge(
        admin.id
      );

    if (
      activeChallenge &&
      activeChallenge.secondsElapsed <
        ADMIN_ACCESS_COOLDOWN_SECONDS
    ) {
      return neutralRequestResponse(
        activeChallenge.challengeId
      );
    }

    const ipHash =
      createAdminAccessIpHash(
        ipInput
      );

    const [
      recentAdminCount,
      recentIpCount,
    ] =
      await Promise.all([
        deps.countRecentAdminChallenges(
          admin.id,
          ADMIN_ACCESS_RATE_WINDOW_MINUTES
        ),

        ipHash
          ? deps.countRecentIpChallenges(
              ipHash,
              ADMIN_ACCESS_RATE_WINDOW_MINUTES
            )
          : Promise.resolve(
              0
            ),
      ]);

    if (
      recentAdminCount >=
        ADMIN_ACCESS_MAX_PER_ADMIN_WINDOW ||
      recentIpCount >=
        ADMIN_ACCESS_MAX_PER_IP_WINDOW
    ) {
      return neutralRequestResponse(
        activeChallenge
          ?.challengeId ||
        fallbackChallengeId
      );
    }

    const challengeId =
      generateAdminAccessChallengeId();

    const code =
      generateAdminAccessCode();

    const codeHmac =
      createAdminAccessCodeHmac(
        challengeId,
        code
      );

    await deps.invalidateActiveAdminChallenges(
      admin.id
    );

    await deps.createAdminAccessChallenge({
      challengeId,

      adminUserId:
        admin.id,

      codeHmac,

      requestIpHash:
        ipHash,

      expiresInMinutes:
        ADMIN_ACCESS_CODE_EXPIRES_MINUTES,

      maxAttempts:
        ADMIN_ACCESS_MAX_ATTEMPTS,
    });

    try {
      await deps.sendAdminAccessCodeEmail({
        correo:
          admin.correo,

        nombre:
          getAdminName(
            admin
          ),

        codigo:
          code,

        expiresInMinutes:
          ADMIN_ACCESS_CODE_EXPIRES_MINUTES,
      });

      await safeAudit(
        deps,
        {
          tipo:
            'ADMIN_ACCESS_CODE_SENT',

          usuario_id:
            admin.id,

          correo:
            admin.correo,

          modulo:
            'auth',

          descripcion:
            'Código de preautorización administrativa enviado.',

          resultado:
            'exitoso',

          metadata: {
            expiresInMinutes:
              ADMIN_ACCESS_CODE_EXPIRES_MINUTES,
          },
        }
      );

    } catch {
      await deps.invalidateActiveAdminChallenges(
        admin.id
      );

      await safeAudit(
        deps,
        {
          tipo:
            'ADMIN_ACCESS_CODE_SEND_FAILED',

          usuario_id:
            admin.id,

          correo:
            admin.correo,

          modulo:
            'auth',

          descripcion:
            'No fue posible entregar el código de preautorización administrativa.',

          resultado:
            'fallido',
        }
      );
    }

    return neutralRequestResponse(
      challengeId
    );
  }


  async function verifyAdminAccess(
    challengeIdInput:
      unknown,

    codeInput:
      unknown
  ) {
    const challengeId =
      String(
        challengeIdInput ||
        ''
      )
        .trim()
        .toLowerCase();

    const code =
      String(
        codeInput ||
        ''
      )
        .trim();

    if (
      !isValidAdminAccessChallengeId(
        challengeId
      ) ||
      !isValidAdminAccessCode(
        code
      )
    ) {
      throw new AppError(
        'Código o autorización inválidos o expirados',
        400
      );
    }

    const candidateHmac =
      createAdminAccessCodeHmac(
        challengeId,
        code
      );

    const result =
      await deps.consumeAdminAccessChallenge(
        challengeId,
        candidateHmac
      );

    if (
      result.status !==
      'ok'
    ) {
      throw new AppError(
        'Código o autorización inválidos o expirados',
        400
      );
    }

    const adminAccessToken =
      signAdminAccessToken({
        sponsorAdminId:
          result.admin.id,

        sponsorEmail:
          result.admin.correo,
      });

    await safeAudit(
      deps,
      {
        tipo:
          'ADMIN_ACCESS_VERIFIED',

        usuario_id:
          result.admin.id,

        correo:
          result.admin.correo,

        modulo:
          'auth',

        descripcion:
          'Preautorización administrativa verificada correctamente.',

        resultado:
          'exitoso',

        metadata: {
          scope:
            'portal_admin_entry',
        },
      }
    );

    return {
      authorized:
        true,

      adminAccessToken,

      tokenType:
        'Bearer',

      expiresInMinutes:
        10,
    };
  }


  return {
    requestAdminAccess,
    verifyAdminAccess,
  };
}


const defaultService =
  buildAdminAccessService();


export const requestAdminAccess =
  defaultService.requestAdminAccess;


export const verifyAdminAccess =
  defaultService.verifyAdminAccess;
