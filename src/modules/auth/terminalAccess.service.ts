import {
  AppError,
} from '../../utils/AppError.js';

import {
  env,
} from '../../config/env.js';

import {
  createTerminalAccessIpHash,
  createTerminalAccessSessionProofHmac,
  generateTerminalAccessChallengeId,
  generateTerminalAccessSessionProof,
} from './terminalAccess.crypto.js';

import {
  consumeApprovedTerminalAccessChallenge,
  countRecentTerminalAccessRequests,
  createTerminalAccessChallenge,
  decideTerminalAccessChallenge,
  findTerminalAccessStatus,
} from './terminalAccess.repository.js';

import {
  sendTerminalAccessApprovalEmail,
  TerminalAccessApprovalEmailInput,
} from './terminalAccess.email.js';


export const TERMINAL_ACCESS_ENABLED =
  env.terminalAccess.enabled;


export const TERMINAL_ACCESS_EXPIRES_MINUTES =
  5;


export const TERMINAL_ACCESS_RATE_WINDOW_MINUTES =
  15;


export const TERMINAL_ACCESS_MAX_PER_IP_WINDOW =
  8;


export type TerminalAccessState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'consumed';


export type TerminalAccessDecision =
  | 'approve'
  | 'reject';


export type PersistedTerminalAccessStatus = {
  challengeId: string;

  terminalId: string;

  status:
    TerminalAccessState;

  decisionAdminUserId:
    number | null;

  expiresAt:
    Date | string;

  decidedAt:
    Date | string | null;

  usedAt:
    Date | string | null;

  createdAt:
    Date | string;
};


export type ConsumeTerminalAccessResult =
  | {
      status:
        'ok';

      terminalId:
        string;
    }
  | {
      status:
        'invalid';
    };


export type TerminalAccessDependencies = {
  generateChallengeId:
    () => string;

  generateSessionProof:
    () => string;

  createIpHash:
    (
      ipInput:
        unknown
    ) =>
      string | null;

  createSessionProofHmac:
    (
      sessionProofInput:
        unknown
    ) =>
      string;

  countRecentTerminalAccessRequests:
    (
      requestIpHash:
        string,

      windowMinutes:
        number
    ) =>
      Promise<number>;

  createTerminalAccessChallenge:
    (
      input: {
        challengeId:
          string;

        terminalId:
          string;

        sessionProofHmac:
          string;

        requestIpHash:
          string | null;

        expiresInMinutes:
          number;
      }
    ) =>
      Promise<void>;

  findTerminalAccessStatus:
    (
      challengeId:
        string
    ) =>
      Promise<
        PersistedTerminalAccessStatus |
        null
      >;

  decideTerminalAccessChallenge:
    (
      input: {
        challengeId:
          string;

        adminUserId:
          number;

        decision:
          TerminalAccessDecision;
      }
    ) =>
      Promise<boolean>;

  consumeApprovedTerminalAccessChallenge:
    (
      input: {
        challengeId:
          string;

        proofHmac:
          string;
      }
    ) =>
      Promise<
        ConsumeTerminalAccessResult
      >;

  approverEmail?:
    string;

  sendApprovalEmail?:
    (
      input:
        TerminalAccessApprovalEmailInput
    ) =>
      Promise<void>;
};


function normalizeRequiredString(
  value:
    unknown
): string {
  return String(
    value ??
    ''
  ).trim();
}


function normalizeTerminalId(
  value:
    unknown
): string {
  const terminalId =
    normalizeRequiredString(
      value
    );

  if (
    terminalId.length === 0 ||
    terminalId.length > 64
  ) {
    throw new AppError(
      'Identificador de terminal inválido',
      400
    );
  }

  return terminalId;
}


function normalizeChallengeId(
  value:
    unknown
): string {
  const challengeId =
    normalizeRequiredString(
      value
    );

  if (
    challengeId.length === 0 ||
    challengeId.length > 64
  ) {
    throw new AppError(
      'Solicitud de terminal inválida',
      400
    );
  }

  return challengeId;
}


function normalizeAdminUserId(
  value:
    unknown
): number {
  const adminUserId =
    Number(
      value
    );

  if (
    !Number.isInteger(
      adminUserId
    ) ||
    adminUserId <= 0
  ) {
    throw new AppError(
      'Administrador inválido',
      400
    );
  }

  return adminUserId;
}


export function isTerminalAccessDecision(
  value:
    unknown
): value is TerminalAccessDecision {
  return (
    value ===
      'approve' ||
    value ===
      'reject'
  );
}


export function getTerminalAccessAvailability() {
  return {
    enabled:
      TERMINAL_ACCESS_ENABLED,
  };
}


export function buildTerminalAccessService(
  deps:
    TerminalAccessDependencies
) {
  async function requestTerminalAccess(
    terminalIdInput:
      unknown,

    ipInput?:
      unknown
  ) {
    const terminalId =
      normalizeTerminalId(
        terminalIdInput
      );

    const challengeId =
      normalizeChallengeId(
        deps.generateChallengeId()
      );

    const sessionProof =
      normalizeRequiredString(
        deps.generateSessionProof()
      );

    if (
      !sessionProof
    ) {
      throw new AppError(
        'No se pudo generar la prueba de posesión de terminal',
        500
      );
    }

    const sessionProofHmac =
      deps.createSessionProofHmac(
        sessionProof
      );

    const requestIpHash =
      deps.createIpHash(
        ipInput
      );

    if (
      requestIpHash
    ) {
      const recentRequests =
        await deps.countRecentTerminalAccessRequests(
          requestIpHash,
          TERMINAL_ACCESS_RATE_WINDOW_MINUTES
        );

      if (
        recentRequests >=
        TERMINAL_ACCESS_MAX_PER_IP_WINDOW
      ) {
        throw new AppError(
          'Demasiadas solicitudes de autorización de terminal',
          429
        );
      }
    }

    await deps.createTerminalAccessChallenge({
      challengeId,

      terminalId,

      sessionProofHmac,

      requestIpHash,

      expiresInMinutes:
        TERMINAL_ACCESS_EXPIRES_MINUTES,
    });

    if (
      deps.sendApprovalEmail
    ) {
      const approverEmail =
        String(
          deps.approverEmail ||
          ''
        ).trim();

      if (!approverEmail) {
        throw new AppError(
          'Aprobador de terminal no configurado',
          503
        );
      }

      await deps.sendApprovalEmail({
        correo:
          approverEmail,

        terminalId,

        challengeId,

        expiresInMinutes:
          TERMINAL_ACCESS_EXPIRES_MINUTES,
      });
    }

    return {
      challengeId,

      sessionProof,

      status:
        'pending' as const,

      expiresInMinutes:
        TERMINAL_ACCESS_EXPIRES_MINUTES,
    };
  }


  async function getTerminalAccessStatus(
    challengeIdInput:
      unknown
  ) {
    const challengeId =
      normalizeChallengeId(
        challengeIdInput
      );

    const result =
      await deps.findTerminalAccessStatus(
        challengeId
      );

    if (!result) {
      throw new AppError(
        'Solicitud de terminal no encontrada',
        404
      );
    }

    return {
      challengeId:
        result.challengeId,

      status:
        result.status,
    };
  }


  async function decideTerminalAccess(
    challengeIdInput:
      unknown,

    adminUserIdInput:
      unknown,

    decisionInput:
      unknown
  ) {
    const challengeId =
      normalizeChallengeId(
        challengeIdInput
      );

    const adminUserId =
      normalizeAdminUserId(
        adminUserIdInput
      );

    if (
      !isTerminalAccessDecision(
        decisionInput
      )
    ) {
      throw new AppError(
        'Decisión de terminal inválida',
        400
      );
    }

    const updated =
      await deps.decideTerminalAccessChallenge({
        challengeId,

        adminUserId,

        decision:
          decisionInput,
      });

    if (!updated) {
      throw new AppError(
        'La solicitud de terminal ya no puede modificarse',
        409
      );
    }

    return {
      challengeId,

      status:
        decisionInput ===
          'approve'
          ? 'approved' as const
          : 'rejected' as const,
    };
  }


  async function consumeTerminalAccessForSession(
    challengeIdInput:
      unknown,

    sessionProofInput:
      unknown
  ) {
    const challengeId =
      normalizeChallengeId(
        challengeIdInput
      );

    const sessionProof =
      normalizeRequiredString(
        sessionProofInput
      );

    if (
      !sessionProof
    ) {
      throw new AppError(
        'Prueba de posesión de terminal requerida',
        400
      );
    }

    const proofHmac =
      deps.createSessionProofHmac(
        sessionProof
      );

    const result =
      await deps.consumeApprovedTerminalAccessChallenge({
        challengeId,

        proofHmac,
      });

    if (
      result.status !==
        'ok'
    ) {
      throw new AppError(
        'La autorización de terminal no es válida o ya fue utilizada',
        409
      );
    }

    return {
      terminalId:
        result.terminalId,
    };
  }


  return {
    requestTerminalAccess,

    getTerminalAccessStatus,

    decideTerminalAccess,

    consumeTerminalAccessForSession,
  };
}


const defaultService =
  buildTerminalAccessService({
    generateChallengeId:
      generateTerminalAccessChallengeId,


    generateSessionProof:
      generateTerminalAccessSessionProof,

    createSessionProofHmac:
      createTerminalAccessSessionProofHmac,

    createIpHash:
      createTerminalAccessIpHash,

    approverEmail:
      env.terminalAccess.approverEmail,

    sendApprovalEmail:
      sendTerminalAccessApprovalEmail,

    countRecentTerminalAccessRequests,

    createTerminalAccessChallenge,

    findTerminalAccessStatus,

    decideTerminalAccessChallenge,

    consumeApprovedTerminalAccessChallenge,
  });


export const requestTerminalAccess =
  defaultService.requestTerminalAccess;


export const getTerminalAccessStatus =
  defaultService.getTerminalAccessStatus;


export const decideTerminalAccess =
  defaultService.decideTerminalAccess;


export const consumeTerminalAccessForSession =
  defaultService.consumeTerminalAccessForSession;
