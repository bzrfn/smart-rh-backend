import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

import {
  env,
} from '../../config/env.js';


const HEX_64 =
  /^[a-f0-9]{64}$/;


function getAdminInviteHmacSecret():
string {
  const secret =
    String(
      env.adminInvite.hmacSecret ||
      ''
    );


  const forbiddenSecrets =
    [
      env.jwt.secret,
      env.adminAccess.jwtSecret,
      env.adminAccess.hmacSecret,
      env.passwordRecovery.hmacSecret,
      env.login2fa.hmacSecret,
    ]
      .map(
        value =>
          String(
            value ||
            ''
          )
      )
      .filter(
        Boolean
      );


  if (
    secret.length < 32 ||
    forbiddenSecrets.includes(
      secret
    )
  ) {
    throw new Error(
      'Configuración criptográfica de invitaciones administrativas inválida'
    );
  }


  return secret;
}


function createAdminInviteHmac(
  namespace: string,
  value: string
): string {
  return createHmac(
    'sha256',
    getAdminInviteHmacSecret()
  )
    .update(
      `${namespace}:${value}`,
      'utf8'
    )
    .digest(
      'hex'
    );
}


export function generateAdminInviteId():
string {
  return randomBytes(
    32
  ).toString(
    'hex'
  );
}


export function generateAdminInviteToken():
string {
  return randomBytes(
    32
  ).toString(
    'hex'
  );
}


export function isValidAdminInviteId(
  value: unknown
): boolean {
  return HEX_64.test(
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase()
  );
}


export function isValidAdminInviteToken(
  value: unknown
): boolean {
  return HEX_64.test(
    String(
      value ||
      ''
    )
      .trim()
      .toLowerCase()
  );
}


export function createAdminInviteTokenHmac(
  invitationId: string,
  token: string
): string {
  const normalizedInvitationId =
    String(
      invitationId ||
      ''
    )
      .trim()
      .toLowerCase();

  const normalizedToken =
    String(
      token ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    !isValidAdminInviteId(
      normalizedInvitationId
    ) ||
    !isValidAdminInviteToken(
      normalizedToken
    )
  ) {
    throw new Error(
      'Invitación administrativa inválida'
    );
  }


  return createAdminInviteHmac(
    'admin-invite-token',
    `${normalizedInvitationId}:${normalizedToken}`
  );
}


export function createAdminInviteIpHash(
  value: unknown
): string | null {
  const normalized =
    String(
      value ||
      ''
    )
      .trim();


  if (!normalized) {
    return null;
  }


  return createAdminInviteHmac(
    'admin-invite-ip',
    normalized
  );
}


export function safeEqualAdminInviteHmac(
  expected: string,
  candidate: string
): boolean {
  const normalizedExpected =
    String(
      expected ||
      ''
    )
      .trim()
      .toLowerCase();

  const normalizedCandidate =
    String(
      candidate ||
      ''
    )
      .trim()
      .toLowerCase();


  if (
    !HEX_64.test(
      normalizedExpected
    ) ||
    !HEX_64.test(
      normalizedCandidate
    )
  ) {
    return false;
  }


  return timingSafeEqual(
    Buffer.from(
      normalizedExpected,
      'hex'
    ),
    Buffer.from(
      normalizedCandidate,
      'hex'
    )
  );
}
