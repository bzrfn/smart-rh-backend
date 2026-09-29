import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

import {
  env,
} from '../../config/env.js';

import {
  AppError,
} from '../../utils/AppError.js';


const ADMIN_ACCESS_CRYPTO_CONTEXT =
  'SMART_RH_ADMIN_ACCESS_V1';


function getSecret(): string {
  const secret =
    String(
      env.adminAccess.hmacSecret ||
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

  if (
    secret.length < 32 ||
    secret === sessionSecret ||
    secret === adminJwtSecret
  ) {
    throw new AppError(
      'Configuración criptográfica administrativa inválida',
      500
    );
  }

  return secret;
}


function normalizeChallengeId(
  value: unknown
): string {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}


function normalizeCode(
  value: unknown
): string {
  return String(
    value ||
    ''
  )
    .trim();
}


function createHmacHex(
  purpose: string,
  value: string
): string {
  return createHmac(
    'sha256',
    getSecret()
  )
    .update(
      `${ADMIN_ACCESS_CRYPTO_CONTEXT}:${purpose}:${value}`,
      'utf8'
    )
    .digest(
      'hex'
    );
}


export function generateAdminAccessChallengeId():
string {
  return randomBytes(
    32
  ).toString(
    'hex'
  );
}


export function generateAdminAccessCode():
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


export function isValidAdminAccessChallengeId(
  value: unknown
): boolean {
  const challengeId =
    normalizeChallengeId(
      value
    );

  return /^[a-f0-9]{64}$/.test(
    challengeId
  );
}


export function isValidAdminAccessCode(
  value: unknown
): boolean {
  const code =
    normalizeCode(
      value
    );

  return /^\d{6}$/.test(
    code
  );
}


export function createAdminAccessCodeHmac(
  challengeIdInput: unknown,
  codeInput: unknown
): string {
  const challengeId =
    normalizeChallengeId(
      challengeIdInput
    );

  const code =
    normalizeCode(
      codeInput
    );

  if (
    !isValidAdminAccessChallengeId(
      challengeId
    ) ||
    !isValidAdminAccessCode(
      code
    )
  ) {
    throw new AppError(
      'Datos de autorización administrativa inválidos',
      400
    );
  }

  return createHmacHex(
    'CODE',
    `${challengeId}:${code}`
  );
}


export function createAdminAccessIpHash(
  ipInput: unknown
): string | null {
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


export function safeEqualAdminAccessHmac(
  leftInput: unknown,
  rightInput: unknown
): boolean {
  const left =
    String(
      leftInput ||
      ''
    )
      .trim()
      .toLowerCase();

  const right =
    String(
      rightInput ||
      ''
    )
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]{64}$/.test(
      left
    ) ||
    !/^[a-f0-9]{64}$/.test(
      right
    )
  ) {
    return false;
  }

  const leftBuffer =
    Buffer.from(
      left,
      'hex'
    );

  const rightBuffer =
    Buffer.from(
      right,
      'hex'
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}
