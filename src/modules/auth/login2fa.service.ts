import {
  AppError,
} from '../../utils/AppError.js';

import {
  signJwt,
} from '../../config/jwt.js';

import {
  enviarCodigoLoginEmail,
} from './auth.email.service.js';

import {
  createLogin2faCodeHmac,
  createLogin2faIpHash,
  generateLogin2faChallengeId,
  generateLogin2faCode,
  isValidLogin2faChallengeId,
  isValidLogin2faCode,
} from './login2fa.crypto.js';

import {
  consumeLogin2faChallenge,
  findLatestActiveLogin2faChallenge,
  invalidateLogin2faChallenge,
  replaceLogin2faChallenge,
} from './login2fa.repository.js';


export const LOGIN_2FA_CODE_EXPIRES_MINUTES =
  10;

export const LOGIN_2FA_MAX_ATTEMPTS =
  5;

export const LOGIN_2FA_COOLDOWN_SECONDS =
  60;

export const LOGIN_2FA_RATE_WINDOW_MINUTES =
  15;

export const LOGIN_2FA_MAX_PER_USER_WINDOW =
  3;

export const LOGIN_2FA_MAX_PER_IP_WINDOW =
  8;


export type Login2faIssueUser = {
  id:
    number;

  correo:
    string;

  nombre?:
    string | null;

  apellido?:
    string | null;

  role:
    string;

  sessionVersion:
    number;
};


export type Login2faDependencies = {
  findLatestActiveChallenge:
    typeof findLatestActiveLogin2faChallenge;

  replaceChallenge:
    typeof replaceLogin2faChallenge;

  invalidateChallenge:
    typeof invalidateLogin2faChallenge;

  consumeChallenge:
    typeof consumeLogin2faChallenge;

  generateChallengeId:
    typeof generateLogin2faChallengeId;

  generateCode:
    typeof generateLogin2faCode;

  createCodeHmac:
    typeof createLogin2faCodeHmac;

  createIpHash:
    typeof createLogin2faIpHash;

  isValidChallengeId:
    typeof isValidLogin2faChallengeId;

  isValidCode:
    typeof isValidLogin2faCode;

  sendLoginCodeEmail:
    typeof enviarCodigoLoginEmail;

  signSessionToken:
    typeof signJwt;
};


const defaultDependencies:
  Login2faDependencies = {
    findLatestActiveChallenge:
      findLatestActiveLogin2faChallenge,

    replaceChallenge:
      replaceLogin2faChallenge,

    invalidateChallenge:
      invalidateLogin2faChallenge,

    consumeChallenge:
      consumeLogin2faChallenge,

    generateChallengeId:
      generateLogin2faChallengeId,

    generateCode:
      generateLogin2faCode,

    createCodeHmac:
      createLogin2faCodeHmac,

    createIpHash:
      createLogin2faIpHash,

    isValidChallengeId:
      isValidLogin2faChallengeId,

    isValidCode:
      isValidLogin2faCode,

    sendLoginCodeEmail:
      enviarCodigoLoginEmail,

    signSessionToken:
      signJwt,
  };


function getFullName(
  user:
    Login2faIssueUser
):
string {
  const fullName =
    [
      user.nombre,
      user.apellido,
    ]
      .filter(
        Boolean
      )
      .join(
        ' '
      )
      .trim();


  return (
    fullName ||
    user.correo
  );
}


function assertAdminUser(
  user:
    Login2faIssueUser
):
void {
  if (
    String(
      user.role ||
      ''
    )
      .trim()
      .toLowerCase() !==
      'admin'
  ) {
    throw new AppError(
      'Segundo factor administrativo no disponible',
      403
    );
  }
}


export function buildLogin2faService(
  overrides:
    Partial<Login2faDependencies> =
      {}
) {
  const deps:
    Login2faDependencies = {
      ...defaultDependencies,
      ...overrides,
    };


  async function issueAdminLogin2fa(
    user:
      Login2faIssueUser,

    requestIp?:
      unknown
  ) {
    assertAdminUser(
      user
    );


    const active =
      await deps.findLatestActiveChallenge(
        user.id
      );


    if (
      active &&
      active.secondsElapsed <
        LOGIN_2FA_COOLDOWN_SECONDS
    ) {
      const remainingSeconds =
        Math.max(
          1,
          (
            LOGIN_2FA_CODE_EXPIRES_MINUTES *
            60
          ) -
            active.secondsElapsed
        );


      return {
        requires2FA:
          true,

        challengeId:
          active.challengeId,

        correo:
          user.correo,

        expiresInMinutes:
          Math.max(
            1,
            Math.ceil(
              remainingSeconds /
              60
            )
          ),

        reused:
          true,

        message:
          'Usa el código de acceso enviado anteriormente.',
      };
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
        requestIp
      );


    const result =
      await deps.replaceChallenge({
        userId:
          user.id,

        expectedSessionVersion:
          user.sessionVersion,

        challengeId,

        codeHmac,

        requestIpHash,

        expiresInMinutes:
          LOGIN_2FA_CODE_EXPIRES_MINUTES,

        maxAttempts:
          LOGIN_2FA_MAX_ATTEMPTS,

        cooldownSeconds:
          LOGIN_2FA_COOLDOWN_SECONDS,

        rateWindowMinutes:
          LOGIN_2FA_RATE_WINDOW_MINUTES,

        maxPerUserWindow:
          LOGIN_2FA_MAX_PER_USER_WINDOW,

        maxPerIpWindow:
          LOGIN_2FA_MAX_PER_IP_WINDOW,
      });


    if (
      result.status ===
      'blocked'
    ) {
      throw new AppError(
        'Demasiados intentos de acceso. Intenta nuevamente más tarde.',
        429
      );
    }


    if (
      result.status !==
      'created'
    ) {
      throw new AppError(
        'No fue posible completar el inicio de sesión',
        401
      );
    }


    try {

      await deps.sendLoginCodeEmail({
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

      await deps.invalidateChallenge(
        challengeId
      );


      throw new AppError(
        'No fue posible enviar el código de acceso',
        503
      );

    }


    return {
      requires2FA:
        true,

      challengeId,

      correo:
        user.correo,

      expiresInMinutes:
        LOGIN_2FA_CODE_EXPIRES_MINUTES,

      reused:
        false,

      message:
        'Código de acceso enviado al correo.',
    };
  }


  async function verifyAdminLogin2fa(
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
      !deps.isValidChallengeId(
        challengeId
      ) ||
      !deps.isValidCode(
        code
      )
    ) {
      throw new AppError(
        'Código inválido o expirado',
        400
      );
    }


    const candidateHmac =
      deps.createCodeHmac(
        challengeId,
        code
      );


    const result =
      await deps.consumeChallenge(
        challengeId,
        candidateHmac
      );


    if (
      result.status !==
      'ok'
    ) {
      throw new AppError(
        'Código inválido o expirado',
        400
      );
    }


    const token =
      deps.signSessionToken({
        userId:
          result.user.id,

        role:
          result.user.role,

        sessionVersion:
          result.user.sessionVersion,
      });


    return {
      token,

      userId:
        result.user.id,

      role:
        result.user.role,

      sessionVersion:
        result.user.sessionVersion,
    };
  }


  return {
    issueAdminLogin2fa,
    verifyAdminLogin2fa,
  };
}


const defaultService =
  buildLogin2faService();


export const issueAdminLogin2fa =
  defaultService.issueAdminLogin2fa;

export const verifyAdminLogin2fa =
  defaultService.verifyAdminLogin2fa;
