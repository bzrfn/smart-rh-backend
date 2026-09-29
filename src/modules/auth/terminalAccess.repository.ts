import {
  pool,
} from '../../config/db.js';

export type PersistedTerminalAccessState =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'consumed'
  | 'expired';

export type CreateTerminalAccessChallengeInput = {
  challengeId: string;
  terminalId: string;
  requestIpHash:
    string | null;
  expiresInMinutes: number;
};

export type TerminalAccessStatusResult = {
  challengeId: string;
  terminalId: string;
  status:
    PersistedTerminalAccessState;
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

export type TerminalAccessDecisionInput = {
  challengeId: string;
  adminUserId: number;
  decision:
    'approve' | 'reject';
};

export type ConsumeApprovedTerminalAccessResult =
  | {
      status: 'ok';
      terminalId: string;
    }
  | {
      status: 'invalid';
    };

type TerminalAccessStatusRow = {
  challenge_id: string;
  terminal_id: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'consumed'
    | 'expired';
  decision_admin_user_id:
    number | null;
  expires_at:
    Date | string;
  decided_at:
    Date | string | null;
  used_at:
    Date | string | null;
  created_at:
    Date | string;
};

type LockedTerminalAccessRow = {
  challenge_id: string;
  terminal_id: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'consumed';
  expired: number;
  used_at:
    Date | string | null;
};

export async function countRecentTerminalAccessRequests(
  requestIpHash: string,
  windowMinutes: number
): Promise<number> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total

        FROM terminal_access_challenges

        WHERE
          request_ip_hash = ?

          AND created_at >=
            DATE_SUB(
              NOW(),
              INTERVAL ? MINUTE
            )
      `,
      [
        requestIpHash,
        windowMinutes,
      ]
    );

  const row =
    (
      rows as Array<{
        total:
          number | string;
      }>
    )[0];

  return Number(
    row?.total ||
    0
  );
}

export async function createTerminalAccessChallenge(
  input: {
    challengeId: string;
    terminalId: string;
    sessionProofHmac: string;
    requestIpHash: string | null;
    expiresInMinutes: number;
  }
): Promise<void> {
  await pool.query(
    `
      INSERT INTO terminal_access_challenges (
        challenge_id,
        terminal_id,
        session_proof_hmac,
        status,
        decision_admin_user_id,
        request_ip_hash,
        expires_at,
        decided_at,
        used_at,
        created_at
      )

      VALUES (
        ?,
        ?,
        ?,
        'pending',
        NULL,
        ?,
        DATE_ADD(
          NOW(),
          INTERVAL ? MINUTE
        ),
        NULL,
        NULL,
        NOW()
      )
    `,
    [
      input.challengeId,
      input.terminalId,
      input.sessionProofHmac,
      input.requestIpHash,
      input.expiresInMinutes,
    ]
  );
}

export async function findTerminalAccessStatus(
  challengeId: string
): Promise<TerminalAccessStatusResult | null> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          challenge_id,
          terminal_id,

          CASE
            WHEN
              expires_at <= NOW()
              AND status = 'pending'
            THEN 'expired'
            ELSE status
          END AS status,

          decision_admin_user_id,
          expires_at,
          decided_at,
          used_at,
          created_at

        FROM terminal_access_challenges

        WHERE
          challenge_id = ?

        LIMIT 1
      `,
      [
        challengeId,
      ]
    );

  const row =
    (
      rows as
        TerminalAccessStatusRow[]
    )[0];

  if (!row) {
    return null;
  }

  return {
    challengeId:
      String(
        row.challenge_id
      ),

    terminalId:
      String(
        row.terminal_id
      ),

    status:
      row.status,

    decisionAdminUserId:
      row.decision_admin_user_id ===
        null
        ? null
        : Number(
            row.decision_admin_user_id
          ),

    expiresAt:
      row.expires_at,

    decidedAt:
      row.decided_at,

    usedAt:
      row.used_at,

    createdAt:
      row.created_at,
  };
}

export async function decideTerminalAccessChallenge(
  input:
    TerminalAccessDecisionInput
): Promise<boolean> {
  const nextStatus =
    input.decision ===
      'approve'
      ? 'approved'
      : 'rejected';

  const [
    result,
  ]: any =
    await pool.query(
      `
        UPDATE terminal_access_challenges

        SET
          status = ?,
          decision_admin_user_id = ?,
          decided_at = NOW()

        WHERE
          challenge_id = ?

          AND status = 'pending'

          AND expires_at > NOW()

          AND used_at IS NULL
      `,
      [
        nextStatus,
        input.adminUserId,
        input.challengeId,
      ]
    );

  return Number(
    result?.affectedRows ||
    0
  ) === 1;
}

export async function consumeApprovedTerminalAccessChallenge(
  input: {
    challengeId: string;
    proofHmac: string;
  }
): Promise<ConsumeApprovedTerminalAccessResult> {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [
      rows,
    ] =
      await connection.query(
        `
          SELECT
            challenge_id,
            terminal_id,
            status,

            CASE
              WHEN expires_at <= NOW()
              THEN 1
              ELSE 0
            END AS expired,

            used_at

          FROM terminal_access_challenges

          WHERE
            challenge_id = ?

            AND session_proof_hmac = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          input.challengeId,
          input.proofHmac,
        ]
      );

    const row =
      (
        rows as
          LockedTerminalAccessRow[]
      )[0];

    if (
      !row ||
      row.status !== 'approved' ||
      Number(
        row.expired
      ) === 1 ||
      row.used_at !== null
    ) {
      await connection.commit();

      return {
        status:
          'invalid',
      };
    }

    const [
      updateResult,
    ]: any =
      await connection.query(
        `
          UPDATE terminal_access_challenges

          SET
            status = 'consumed',
            used_at = NOW()

          WHERE
            challenge_id = ?

            AND session_proof_hmac = ?

            AND status = 'approved'

            AND expires_at > NOW()

            AND used_at IS NULL
        `,
        [
          input.challengeId,
          input.proofHmac,
        ]
      );

    if (
      Number(
        updateResult?.affectedRows ||
        0
      ) !== 1
    ) {
      await connection.rollback();

      return {
        status:
          'invalid',
      };
    }

    await connection.commit();

    return {
      status:
        'ok',

      terminalId:
        String(
          row.terminal_id
        ),
    };
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}
