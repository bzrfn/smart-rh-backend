import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

import {
  env,
} from '../../config/env.js';


const CHALLENGE_ID_REGEX =
  /^[a-f0-9]{64}$/;

const LOGIN_CODE_REGEX =
  /^\d{6}$/;

const HMAC_REGEX =
  /^[a-f0-9]{64}$/;


function getLogin2faHmacSecret():
string {
  const secret =
    String(
      env.login2fa.hmacSecret ||
      ''
    );


  if (
    secret.length <
    32
  ) {
    throw new Error(
      'LOGIN_2FA_HMAC_SECRET no está configurado de forma segura'
    );
  }


  const otherSecrets = [
    env.jwt.secret,
    env.adminAccess.jwtSecret,
    env.adminAccess.hmacSecret,
    env.passwordRecovery.hmacSecret,
  ]
    .map(
      (value) =>
        String(
          value ||
          ''
        )
    )
    .filter(
      Boolean
    );


  if (
    otherSecrets.includes(
      secret
    )
  ) {
    throw new Error(
      'LOGIN_2FA_HMAC_SECRET debe ser distinto de los otros secretos'
    );
  }


  return secret;
}


function createHmacHex(
  namespace:
    string,
  value:
    string
):
string {
  return createHmac(
    'sha256',
    getLogin2faHmacSecret()
  )
    .update(
      `${namespace}:${value}`,
      'utf8'
    )
    .digest(
      'hex'
    );
}


export function generateLogin2faChallengeId():
string {
  return randomBytes(
    32
  ).toString(
    'hex'
  );
}


export function generateLogin2faCode():
string {
  return String(
    randomInt(
      0,
      1_000_000
    )
  ).padStart(
    6,
    '0'
  );
}


export function isValidLogin2faChallengeId(
  value:
    unknown
):
boolean {
  return CHALLENGE_ID_REGEX.test(
    String(
      value ||
      ''
    )
  );
}


export function isValidLogin2faCode(
  value:
    unknown
):
boolean {
  return LOGIN_CODE_REGEX.test(
    String(
      value ||
      ''
    )
  );
}


export function createLogin2faCodeHmac(
  challengeId:
    string,
  code:
    string
):
string {
  if (
    !isValidLogin2faChallengeId(
      challengeId
    ) ||
    !isValidLogin2faCode(
      code
    )
  ) {
    throw new Error(
      'Challenge o código LOGIN_2FA inválidos'
    );
  }


  return createHmacHex(
    'login2fa-code',
    `${challengeId}:${code}`
  );
}


export function createLogin2faIpHash(
  ipInput:
    unknown
):
string | null {
  const normalizedIp =
    String(
      ipInput ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    !normalizedIp
  ) {
    return null;
  }


  return createHmacHex(
    'login2fa-ip',
    normalizedIp
  );
}


export function safeEqualLogin2faHmac(
  expected:
    string,
  candidate:
    string
):
boolean {
  if (
    !HMAC_REGEX.test(
      expected
    ) ||
    !HMAC_REGEX.test(
      candidate
    )
  ) {
    return false;
  }


  const expectedBuffer =
    Buffer.from(
      expected,
      'hex'
    );

  const candidateBuffer =
    Buffer.from(
      candidate,
      'hex'
    );


  if (
    expectedBuffer.length !==
    candidateBuffer.length
  ) {
    return false;
  }


  return timingSafeEqual(
    expectedBuffer,
    candidateBuffer
  );
}
