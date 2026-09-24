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


const TERMINAL_CHALLENGE_BYTES =
  24;

const TERMINAL_CODE_MIN =
  0;

const TERMINAL_CODE_MAX =
  1_000_000;

const TERMINAL_CRYPTO_CONTEXT =
  'SMART_RH_TERMINAL_ACCESS';


function getTerminalAccessHmacSecret():
  string {
  const secret =
    String(
      env.terminalAccess.hmacSecret ||
      ''
    ).trim();

  if (
    secret.length <
    32
  ) {
    throw new AppError(
      'Configuración criptográfica de terminal no disponible',
      503
    );
  }

  return secret;
}


function createTerminalHmacHex(
  purpose:
    string,

  value:
    string
): string {
  return createHmac(
    'sha256',
    getTerminalAccessHmacSecret()
  )
    .update(
      `${TERMINAL_CRYPTO_CONTEXT}:${purpose}:${value}`
    )
    .digest(
      'hex'
    );
}


export function generateTerminalAccessChallengeId():
  string {
  return randomBytes(
    TERMINAL_CHALLENGE_BYTES
  ).toString(
    'hex'
  );
}


export function generateTerminalAccessCode():
  string {
  return String(
    randomInt(
      TERMINAL_CODE_MIN,
      TERMINAL_CODE_MAX
    )
  ).padStart(
    6,
    '0'
  );
}


export function createTerminalAccessIpHash(
  ipInput:
    unknown
): string | null {
  const ip =
    String(
      ipInput ??
      ''
    )
      .trim()
      .toLowerCase();

  if (!ip) {
    return null;
  }

  return createTerminalHmacHex(
    'IP',
    ip
  );
}


export function generateTerminalAccessSessionProof():
  string {
  return randomBytes(
    32
  ).toString(
    'hex'
  );
}


export function createTerminalAccessSessionProofHmac(
  sessionProofInput:
    unknown
): string {
  const sessionProof =
    String(
      sessionProofInput ??
      ''
    )
      .trim()
      .toLowerCase();

  if (
    !/^[a-f0-9]{64}$/.test(
      sessionProof
    )
  ) {
    throw new AppError(
      'Prueba de posesión de terminal inválida',
      400
    );
  }

  return createTerminalHmacHex(
    'SESSION_PROOF',
    sessionProof
  );
}


export function safeEqualTerminalAccessValue(
  leftInput:
    unknown,

  rightInput:
    unknown
): boolean {
  const left =
    Buffer.from(
      String(
        leftInput ??
        ''
      )
    );

  const right =
    Buffer.from(
      String(
        rightInput ??
        ''
      )
    );

  if (
    left.length === 0 ||
    left.length !==
      right.length
  ) {
    return false;
  }

  return timingSafeEqual(
    left,
    right
  );
}
