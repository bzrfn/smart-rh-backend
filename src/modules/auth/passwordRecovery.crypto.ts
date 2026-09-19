import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

import {
  env,
} from '../../config/env.js';


const PASSWORD_RECOVERY_CONTEXT =
  'SMART_RH_PASSWORD_RECOVERY_V1';


function getPasswordRecoveryHmacSecret():
string {
  const secret =
    String(
      env.passwordRecovery.hmacSecret ||
      ''
    );

  const sessionSecret =
    String(
      env.jwt.secret ||
      ''
    );

  const adminJwtSecret =
    String(
      env.adminAccess.jwtSecret ||
      ''
    );

  const adminHmacSecret =
    String(
      env.adminAccess.hmacSecret ||
      ''
    );


  if (
    secret.length < 32
  ) {
    throw new Error(
      'PASSWORD_RECOVERY_HMAC_SECRET debe tener al menos 32 caracteres.'
    );
  }


  if (
    secret === sessionSecret ||
    secret === adminJwtSecret ||
    secret === adminHmacSecret
  ) {
    throw new Error(
      'PASSWORD_RECOVERY_HMAC_SECRET debe ser independiente de las demás claves criptográficas.'
    );
  }


  return secret;
}


function createHmacHex(
  purpose: string,
  value: string
):
string {
  return createHmac(
    'sha256',
    getPasswordRecoveryHmacSecret()
  )
    .update(
      `${PASSWORD_RECOVERY_CONTEXT}:${purpose}:${value}`,
      'utf8'
    )
    .digest(
      'hex'
    );
}


export function generatePasswordRecoveryChallengeId():
string {
  return randomBytes(
    32
  )
    .toString(
      'hex'
    );
}


export function generatePasswordRecoveryCode():
string {
  return String(
    randomInt(
      0,
      1_000_000
    )
  )
    .padStart(
      6,
      '0'
    );
}


export function isValidPasswordRecoveryChallengeId(
  value: unknown
):
boolean {
  return /^[a-f0-9]{64}$/.test(
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase()
  );
}


export function isValidPasswordRecoveryCode(
  value: unknown
):
boolean {
  return /^\d{6}$/.test(
    String(
      value ||
      ''
    )
      .trim()
  );
}


export function createPasswordRecoveryCodeHmac(
  challengeId: string,
  code: string
):
string {
  return createHmacHex(
    'CODE',
    `${challengeId}:${code}`
  );
}


export function createPasswordRecoveryIpHash(
  ipInput: unknown
):
string | null {
  const ip =
    String(
      ipInput ||
      ''
    )
      .trim()
      .toLowerCase();

  if (!ip) {
    return null;
  }

  return createHmacHex(
    'IP',
    ip
  );
}


export function comparePasswordRecoveryHmac(
  expectedInput: unknown,
  candidateInput: unknown
):
boolean {
  const expected =
    String(
      expectedInput ||
      ''
    )
      .trim()
      .toLowerCase();

  const candidate =
    String(
      candidateInput ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]{64}$/.test(
      expected
    ) ||
    !/^[a-f0-9]{64}$/.test(
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
