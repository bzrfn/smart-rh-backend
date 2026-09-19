import {
  AppError,
} from '../../utils/AppError.js';

import {
  hashPassword,
} from '../../utils/password.js';

import {
  registrarEventoSistema,
} from '../eventosSistema/eventosSistema.service.js';

import {
  registrarActividadEmpleado,
} from '../actividad/actividad.service.js';

import {
  enviarCodigoResetPasswordEmail,
  enviarPasswordActualizadoEmail,
} from './auth.email.service.js';

import {
  createPasswordRecoveryCodeHmac,
  createPasswordRecoveryIpHash,
  generatePasswordRecoveryChallengeId,
  generatePasswordRecoveryCode,
  isValidPasswordRecoveryCode,
} from './passwordRecovery.crypto.js';

import {
  consumePasswordResetChallenge,
  countRecentPasswordResetChallenges,
  createPasswordResetChallenge,
  findEligiblePasswordRecoveryUserByEmail,
  findLatestActivePasswordResetChallenge,
  invalidateActivePasswordResetChallenges,
} from './passwordRecovery.repository.js';


export const PASSWORD_RECOVERY_CODE_EXPIRES_MINUTES =
  15;

export const PASSWORD_RECOVERY_MAX_ATTEMPTS =
  5;

export const PASSWORD_RECOVERY_COOLDOWN_SECONDS =
  60;

export const PASSWORD_RECOVERY_RATE_WINDOW_MINUTES =
  15;

export const PASSWORD_RECOVERY_MAX_PER_USER_WINDOW =
  3;


const PASSWORD_RECOVERY_PUBLIC_MESSAGE =
  'Si existe una cuenta asociada a ese correo, se enviará un código de recuperación.';

const PASSWORD_RECOVERY_INVALID_MESSAGE =
  'Código de recuperación inválido o expirado';


type EventInput =
  Record<
    string,
    unknown
  >;


export type PasswordRecoveryDependencies = {
  findEligibleUser:
    typeof findEligiblePasswordRecoveryUserByEmail;

  findLatestActiveChallenge:
    typeof findLatestActivePasswordResetChallenge;

  countRecentChallenges:
    typeof countRecentPasswordResetChallenges;

  invalidateActiveChallenges:
    typeof invalidateActivePasswordResetChallenges;

  createChallenge:
    typeof createPasswordResetChallenge;

  consumeChallenge:
    typeof consumePasswordResetChallenge;

  generateChallengeId:
    typeof generatePasswordRecoveryChallengeId;

  generateCode:
    typeof generatePasswordRecoveryCode;

  createCodeHmac:
    typeof createPasswordRecoveryCodeHmac;

  createIpHash:
    typeof createPasswordRecoveryIpHash;

  isValidCode:
    typeof isValidPasswordRecoveryCode;

  hashPassword:
    typeof hashPassword;

  sendResetCodeEmail:
    typeof enviarCodigoResetPasswordEmail;

  sendPasswordUpdatedEmail:
    typeof enviarPasswordActualizadoEmail;

  registerEvent:
    (
      input:
        EventInput
    ) => Promise<unknown>;

  registerActivity:
    (
      input:
        EventInput
    ) => Promise<unknown>;
};


const defaultDependencies:
  PasswordRecoveryDependencies = {
    findEligibleUser:
      findEligiblePasswordRecoveryUserByEmail,

    findLatestActiveChallenge:
      findLatestActivePasswordResetChallenge,

    countRecentChallenges:
      countRecentPasswordResetChallenges,

    invalidateActiveChallenges:
      invalidateActivePasswordResetChallenges,

    createChallenge:
      createPasswordResetChallenge,

    consumeChallenge:
      consumePasswordResetChallenge,

    generateChallengeId:
      generatePasswordRecoveryChallengeId,

    generateCode:
      generatePasswordRecoveryCode,

    createCodeHmac:
      createPasswordRecoveryCodeHmac,

    createIpHash:
      createPasswordRecoveryIpHash,

    isValidCode:
      isValidPasswordRecoveryCode,

    hashPassword,

    sendResetCodeEmail:
      enviarCodigoResetPasswordEmail,

    sendPasswordUpdatedEmail:
      enviarPasswordActualizadoEmail,

    registerEvent:
      registrarEventoSistema as (
        input:
          EventInput
      ) => Promise<unknown>,

    registerActivity:
      registrarActividadEmpleado as (
        input:
          EventInput
      ) => Promise<unknown>,
  };


function normalizeEmail(
  value: unknown
):
string {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}


function looksLikeEmail(
  value: string
):
boolean {
  return (
    value.length >= 5 &&
    value.length <= 150 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      value
    )
  );
}


function getFullName(
  user: {
    nombre: string;
    apellido: string;
    correo: string;
  }
):
string {
  const fullName =
    `${user.nombre || ''} ${user.apellido || ''}`
      .trim();

  return (
    fullName ||
    user.correo
  );
}


function neutralRequestResponse() {
  return {
    accepted:
      true,

    expiresInMinutes:
      PASSWORD_RECOVERY_CODE_EXPIRES_MINUTES,

    message:
      PASSWORD_RECOVERY_PUBLIC_MESSAGE,
  };
}


async function safeEvent(
  deps:
    PasswordRecoveryDependencies,

  input:
    EventInput
):
Promise<void> {
  try {
    await deps.registerEvent(
      input
    );
  } catch {
    return;
  }
}


async function safeActivity(
  deps:
    PasswordRecoveryDependencies,

  input:
    EventInput
):
Promise<void> {
  try {
    await deps.registerActivity(
      input
    );
  } catch {
    return;
  }
}


function invalidRecovery():
never {
  throw new AppError(
    PASSWORD_RECOVERY_INVALID_MESSAGE,
    400
  );
}


export function buildPasswordRecoveryService(
  deps:
    PasswordRecoveryDependencies =
      defaultDependencies
) {
  async function requestPasswordRecovery(
    correoInput: unknown,
    ipInput?: unknown
  ) {
    const correo =
      normalizeEmail(
        correoInput
      );


    if (
      !looksLikeEmail(
        correo
      )
    ) {
      return neutralRequestResponse();
    }


    const user =
      await deps.findEligibleUser(
        correo
      );


    if (!user) {
      return neutralRequestResponse();
    }


    const active =
      await deps.findLatestActiveChallenge(
        user.id
      );


    if (
      active &&
      active.secondsElapsed <
        PASSWORD_RECOVERY_COOLDOWN_SECONDS
    ) {
      return neutralRequestResponse();
    }


    const recentCount =
      await deps.countRecentChallenges(
        user.id,
        PASSWORD_RECOVERY_RATE_WINDOW_MINUTES
      );


    if (
      recentCount >=
      PASSWORD_RECOVERY_MAX_PER_USER_WINDOW
    ) {
      return neutralRequestResponse();
    }


    const challengeId =
      deps.generateChallengeId();

    const code =
      deps.generateCode();

    const codeHmac =
      deps.createCodeHmac(
        challengeId,
        code
      );

    const requestIpHash =
      deps.createIpHash(
        ipInput
      );


    await deps.invalidateActiveChallenges(
      user.id
    );


    await deps.createChallenge({
      challengeId,
      userId:
        user.id,
      codeHmac,
      requestIpHash,
      expiresInMinutes:
        PASSWORD_RECOVERY_CODE_EXPIRES_MINUTES,
      maxAttempts:
        PASSWORD_RECOVERY_MAX_ATTEMPTS,
    });


    try {
      await deps.sendResetCodeEmail({
        correo:
          user.correo,

        nombre:
          getFullName(
            user
          ),

        codigo:
          code,
      });

    } catch {
      await deps.invalidateActiveChallenges(
        user.id
      );

      await safeEvent(
        deps,
        {
          tipo:
            'RECUPERACION_PASSWORD_EMAIL_FALLIDO',

          usuario_id:
            user.id,

          correo:
            user.correo,

          modulo:
            'auth',

          descripcion:
            'No fue posible entregar el código de recuperación.',

          resultado:
            'fallido',
        }
      );

      return neutralRequestResponse();
    }


    await safeEvent(
      deps,
      {
        tipo:
          'RECUPERACION_PASSWORD',

        usuario_id:
          user.id,

        correo:
          user.correo,

        modulo:
          'auth',

        descripcion:
          'Código de recuperación seguro generado y enviado por correo.',

        resultado:
          'exitoso',

        metadata: {
          expiresInMinutes:
            PASSWORD_RECOVERY_CODE_EXPIRES_MINUTES,

          maxAttempts:
            PASSWORD_RECOVERY_MAX_ATTEMPTS,
        },
      }
    );


    return neutralRequestResponse();
  }


  async function completePasswordRecovery(
    correoInput: unknown,
    codeInput: unknown,
    newPasswordInput: unknown
  ) {
    const correo =
      normalizeEmail(
        correoInput
      );

    const code =
      String(
        codeInput ||
        ''
      )
        .trim();

    const newPassword =
      String(
        newPasswordInput ||
        ''
      );


    if (
      !looksLikeEmail(
        correo
      ) ||
      !deps.isValidCode(
        code
      ) ||
      !newPassword.trim()
    ) {
      invalidRecovery();
    }


    const user =
      await deps.findEligibleUser(
        correo
      );


    if (!user) {
      invalidRecovery();
    }


    const active =
      await deps.findLatestActiveChallenge(
        user.id
      );


    if (!active) {
      await safeEvent(
        deps,
        {
          tipo:
            'RESET_PASSWORD',

          usuario_id:
            user.id,

          correo:
            user.correo,

          modulo:
            'auth',

          descripcion:
            'Intento de restablecimiento sin challenge activo.',

          resultado:
            'fallido',
        }
      );

      invalidRecovery();
    }


    const candidateCodeHmac =
      deps.createCodeHmac(
        active.challengeId,
        code
      );


    const passwordHash =
      await deps.hashPassword(
        newPassword
      );


    const result =
      await deps.consumeChallenge(
        active.challengeId,
        candidateCodeHmac,
        passwordHash
      );


    if (
      result.status !==
      'ok'
    ) {
      await safeEvent(
        deps,
        {
          tipo:
            'RESET_PASSWORD',

          usuario_id:
            user.id,

          correo:
            user.correo,

          modulo:
            'auth',

          descripcion:
            'Código de recuperación inválido o expirado.',

          resultado:
            'fallido',
        }
      );

      invalidRecovery();
    }


    try {
      await deps.sendPasswordUpdatedEmail({
        correo:
          result.user.correo,

        nombre:
          getFullName(
            result.user
          ),
      });

    } catch {
      await safeEvent(
        deps,
        {
          tipo:
            'RESET_PASSWORD_CONFIRMATION_EMAIL_FALLIDO',

          usuario_id:
            result.user.id,

          correo:
            result.user.correo,

          modulo:
            'auth',

          descripcion:
            'La contraseña se actualizó, pero no fue posible enviar el correo de confirmación.',

          resultado:
            'fallido',
        }
      );
    }


    await safeEvent(
      deps,
      {
        tipo:
          'RESET_PASSWORD',

        usuario_id:
          result.user.id,

        correo:
          result.user.correo,

        modulo:
          'auth',

        descripcion:
          'Contraseña actualizada mediante challenge seguro de recuperación.',

        resultado:
          'exitoso',
      }
    );


    await safeActivity(
      deps,
      {
        usuario_id:
          result.user.id,

        tipo:
          'RESET_PASSWORD',

        titulo:
          'Contraseña actualizada',

        descripcion:
          'La contraseña del usuario fue actualizada correctamente.',

        modulo:
          'auth',

        origen:
          'api',

        metadata: {
          correo:
            result.user.correo,
        },
      }
    );


    return {
      message:
        'Contraseña actualizada correctamente',
    };
  }


  return {
    requestPasswordRecovery,
    completePasswordRecovery,
  };
}


const defaultService =
  buildPasswordRecoveryService();


export const requestPasswordRecovery =
  defaultService.requestPasswordRecovery;

export const completePasswordRecovery =
  defaultService.completePasswordRecovery;
