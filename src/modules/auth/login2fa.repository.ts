import {
  pool,
} from '../../config/db.js';

import {
  safeEqualLogin2faHmac,
} from './login2fa.crypto.js';


export type Login2faAdminUser = {
  id: number;
  correo: string;
  nombre: string | null;
  apellido: string | null;
  role: string;
  sessionVersion: number;
};


export type ActiveLogin2faChallenge = {
  challengeId: string;
  secondsElapsed: number;
};


export type ReplaceLogin2faChallengeInput = {
  userId: number;
  expectedSessionVersion: number;
  challengeId: string;
  codeHmac: string;
  requestIpHash: string | null;
  expiresInMinutes: number;
  maxAttempts: number;
  cooldownSeconds: number;
  rateWindowMinutes: number;
  maxPerUserWindow: number;
  maxPerIpWindow: number;
};


export type ReplaceLogin2faChallengeResult =
  | {
      status: 'created';
    }
  | {
      status: 'blocked';
    }
  | {
      status: 'stale';
    }
  | {
      status: 'ineligible';
    };


export type ConsumeLogin2faChallengeResult =
  | {
      status: 'ok';
      user: Login2faAdminUser;
    }
  | {
      status: 'invalid';
    };


function mapAdminUser(
  row: any
): Login2faAdminUser {
  return {
    id:
      Number(row.id),

    correo:
      String(row.correo),

    nombre:
      row.nombre === null ||
      row.nombre === undefined
        ? null
        : String(row.nombre),

    apellido:
      row.apellido === null ||
      row.apellido === undefined
        ? null
        : String(row.apellido),

    role:
      String(row.rol_nombre),

    sessionVersion:
      Number(row.session_version),
  };
}


function isEligibleAdminRow(
  row: any
): boolean {
  return Boolean(
    row &&
    Number(row.activo) === 1 &&
    Number(row.email_verificado) === 1 &&
    String(row.rol_nombre)
      .trim()
      .toLowerCase() === 'admin'
  );
}


export async function findLatestActiveLogin2faChallenge(
  userId: number
): Promise<ActiveLogin2faChallenge | null> {
  const [rows] =
    await pool.query(
      `
        SELECT
          challenge_id,
          TIMESTAMPDIFF(
            SECOND,
            created_at,
            NOW()
          ) AS seconds_elapsed
        FROM login_2fa_challenges
        WHERE user_id = ?
          AND used_at IS NULL
          AND expires_at > NOW()
          AND attempts < max_attempts
        ORDER BY
          created_at DESC,
          challenge_id DESC
        LIMIT 1
      `,
      [userId]
    );

  const row =
    (
      rows as Array<{
        challenge_id: string;
        seconds_elapsed:
          number | string;
      }>
    )[0];

  if (!row) {
    return null;
  }

  return {
    challengeId:
      String(row.challenge_id),

    secondsElapsed:
      Number(
        row.seconds_elapsed || 0
      ),
  };
}


export async function countRecentLogin2faChallenges(
  userId: number,
  windowMinutes: number
): Promise<number> {
  const [rows] =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM login_2fa_challenges
        WHERE user_id = ?
          AND created_at >=
            DATE_SUB(
              NOW(),
              INTERVAL ? MINUTE
            )
      `,
      [
        userId,
        windowMinutes,
      ]
    );

  return Number(
    (
      rows as Array<{
        total:
          number | string;
      }>
    )[0]?.total || 0
  );
}


export async function countRecentLogin2faIpChallenges(
  requestIpHash: string,
  windowMinutes: number
): Promise<number> {
  const [rows] =
    await pool.query(
      `
        SELECT COUNT(*) AS total
        FROM login_2fa_challenges
        WHERE request_ip_hash = ?
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

  return Number(
    (
      rows as Array<{
        total:
          number | string;
      }>
    )[0]?.total || 0
  );
}


export async function invalidateActiveLogin2faChallenges(
  userId: number
): Promise<void> {
  await pool.query(
    `
      UPDATE login_2fa_challenges
      SET used_at =
        COALESCE(
          used_at,
          NOW()
        )
      WHERE user_id = ?
        AND used_at IS NULL
    `,
    [userId]
  );
}


export async function invalidateLogin2faChallenge(
  challengeId: string
): Promise<void> {
  await pool.query(
    `
      UPDATE login_2fa_challenges
      SET used_at =
        COALESCE(
          used_at,
          NOW()
        )
      WHERE challenge_id = ?
        AND used_at IS NULL
    `,
    [challengeId]
  );
}


export async function replaceLogin2faChallenge(
  input:
    ReplaceLogin2faChallengeInput
): Promise<ReplaceLogin2faChallengeResult> {
  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] =
      await connection.query(
        `
          SELECT
            u.id,
            u.correo,
            u.nombre,
            u.apellido,
            u.activo,
            COALESCE(
              u.email_verificado,
              0
            ) AS email_verificado,
            u.session_version,
            r.nombre AS rol_nombre
          FROM usuarios u
          JOIN roles r
            ON r.id = u.rol_id
          WHERE u.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [input.userId]
      );

    const user =
      (userRows as any[])[0];

    if (
      !isEligibleAdminRow(
        user
      )
    ) {
      await connection.rollback();

      return {
        status: 'ineligible',
      };
    }

    if (
      Number(
        user.session_version
      ) !==
      Number(
        input.expectedSessionVersion
      )
    ) {
      await connection.rollback();

      return {
        status: 'stale',
      };
    }

    const [latestRows] =
      await connection.query(
        `
          SELECT
            challenge_id,
            TIMESTAMPDIFF(
              SECOND,
              created_at,
              NOW()
            ) AS seconds_elapsed
          FROM login_2fa_challenges
          WHERE user_id = ?
            AND used_at IS NULL
            AND expires_at > NOW()
            AND attempts < max_attempts
          ORDER BY
            created_at DESC,
            challenge_id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [input.userId]
      );

    const latest =
      (
        latestRows as Array<{
          challenge_id: string;
          seconds_elapsed:
            number | string;
        }>
      )[0];

    if (
      latest &&
      Number(
        latest.seconds_elapsed
      ) <
        Number(
          input.cooldownSeconds
        )
    ) {
      await connection.rollback();

      return {
        status: 'blocked',
      };
    }

    const [userCountRows] =
      await connection.query(
        `
          SELECT COUNT(*) AS total
          FROM login_2fa_challenges
          WHERE user_id = ?
            AND created_at >=
              DATE_SUB(
                NOW(),
                INTERVAL ? MINUTE
              )
        `,
        [
          input.userId,
          input.rateWindowMinutes,
        ]
      );

    const recentUserCount =
      Number(
        (
          userCountRows as Array<{
            total:
              number | string;
          }>
        )[0]?.total || 0
      );

    if (
      recentUserCount >=
      input.maxPerUserWindow
    ) {
      await connection.rollback();

      return {
        status: 'blocked',
      };
    }

    if (
      input.requestIpHash
    ) {
      const [ipCountRows] =
        await connection.query(
          `
            SELECT COUNT(*) AS total
            FROM login_2fa_challenges
            WHERE request_ip_hash = ?
              AND created_at >=
                DATE_SUB(
                  NOW(),
                  INTERVAL ? MINUTE
                )
          `,
          [
            input.requestIpHash,
            input.rateWindowMinutes,
          ]
        );

      const recentIpCount =
        Number(
          (
            ipCountRows as Array<{
              total:
                number | string;
            }>
          )[0]?.total || 0
        );

      if (
        recentIpCount >=
        input.maxPerIpWindow
      ) {
        await connection.rollback();

        return {
          status: 'blocked',
        };
      }
    }

    await connection.query(
      `
        UPDATE login_2fa_challenges
        SET used_at =
          COALESCE(
            used_at,
            NOW()
          )
        WHERE user_id = ?
          AND used_at IS NULL
      `,
      [input.userId]
    );

    await connection.query(
      `
        INSERT INTO login_2fa_challenges (
          challenge_id,
          user_id,
          session_version,
          code_hmac,
          request_ip_hash,
          attempts,
          max_attempts,
          expires_at,
          used_at,
          last_attempt_at,
          created_at
        )
        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          0,
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
        input.userId,
        input.expectedSessionVersion,
        input.codeHmac,
        input.requestIpHash,
        input.maxAttempts,
        input.expiresInMinutes,
      ]
    );

    await connection.commit();

    return {
      status: 'created',
    };

  } catch (error) {
    await connection.rollback();

    throw error;

  } finally {
    connection.release();
  }
}


export async function consumeLogin2faChallenge(
  challengeId: string,
  candidateHmac: string
): Promise<ConsumeLogin2faChallengeResult> {
  const [preliminaryRows] =
    await pool.query(
      `
        SELECT user_id
        FROM login_2fa_challenges
        WHERE challenge_id = ?
        LIMIT 1
      `,
      [challengeId]
    );

  const preliminary =
    (
      preliminaryRows as Array<{
        user_id:
          number | string;
      }>
    )[0];

  if (!preliminary) {
    return {
      status: 'invalid',
    };
  }

  const userId =
    Number(
      preliminary.user_id
    );

  const connection =
    await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [userRows] =
      await connection.query(
        `
          SELECT
            u.id,
            u.correo,
            u.nombre,
            u.apellido,
            u.activo,
            COALESCE(
              u.email_verificado,
              0
            ) AS email_verificado,
            u.session_version,
            r.nombre AS rol_nombre
          FROM usuarios u
          JOIN roles r
            ON r.id = u.rol_id
          WHERE u.id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [userId]
      );

    const user =
      (userRows as any[])[0];

    if (
      !isEligibleAdminRow(
        user
      )
    ) {
      await connection.rollback();

      return {
        status: 'invalid',
      };
    }

    const [challengeRows] =
      await connection.query(
        `
          SELECT
            challenge_id,
            user_id,
            session_version,
            code_hmac,
            attempts,
            max_attempts,
            used_at,
            (
              expires_at > NOW()
            ) AS not_expired
          FROM login_2fa_challenges
          WHERE challenge_id = ?
          LIMIT 1
          FOR UPDATE
        `,
        [challengeId]
      );

    const challenge =
      (challengeRows as any[])[0];

    if (
      !challenge ||
      Number(
        challenge.user_id
      ) !== userId ||
      challenge.used_at ||
      Number(
        challenge.not_expired
      ) !== 1 ||
      Number(
        challenge.attempts
      ) >=
        Number(
          challenge.max_attempts
        )
    ) {
      await connection.rollback();

      return {
        status: 'invalid',
      };
    }

    if (
      Number(
        challenge.session_version
      ) !==
        Number(
          user.session_version
        )
    ) {
      await connection.query(
        `
          UPDATE login_2fa_challenges
          SET used_at =
            COALESCE(
              used_at,
              NOW()
            )
          WHERE challenge_id = ?
        `,
        [challengeId]
      );

      await connection.commit();

      return {
        status: 'invalid',
      };
    }

    const [latestRows] =
      await connection.query(
        `
          SELECT challenge_id
          FROM login_2fa_challenges
          WHERE user_id = ?
            AND used_at IS NULL
            AND expires_at > NOW()
            AND attempts < max_attempts
          ORDER BY
            created_at DESC,
            challenge_id DESC
          LIMIT 1
          FOR UPDATE
        `,
        [userId]
      );

    const latest =
      (
        latestRows as Array<{
          challenge_id: string;
        }>
      )[0];

    if (
      !latest ||
      String(
        latest.challenge_id
      ) !== challengeId
    ) {
      await connection.query(
        `
          UPDATE login_2fa_challenges
          SET used_at =
            COALESCE(
              used_at,
              NOW()
            )
          WHERE challenge_id = ?
        `,
        [challengeId]
      );

      await connection.commit();

      return {
        status: 'invalid',
      };
    }

    const matches =
      safeEqualLogin2faHmac(
        String(
          challenge.code_hmac
        ),
        candidateHmac
      );

    if (!matches) {
      const nextAttempts =
        Number(
          challenge.attempts
        ) + 1;

      await connection.query(
        `
          UPDATE login_2fa_challenges
          SET
            attempts = ?,
            last_attempt_at = NOW(),
            used_at =
              CASE
                WHEN ? >= max_attempts
                THEN
                  COALESCE(
                    used_at,
                    NOW()
                  )
                ELSE
                  used_at
              END
          WHERE challenge_id = ?
        `,
        [
          nextAttempts,
          nextAttempts,
          challengeId,
        ]
      );

      await connection.commit();

      return {
        status: 'invalid',
      };
    }

    await connection.query(
      `
        UPDATE login_2fa_challenges
        SET
          used_at =
            COALESCE(
              used_at,
              NOW()
            ),
          last_attempt_at =
            NOW()
        WHERE challenge_id = ?
      `,
      [challengeId]
    );

    await connection.commit();

    return {
      status: 'ok',

      user:
        mapAdminUser(
          user
        ),
    };

  } catch (error) {
    await connection.rollback();

    throw error;

  } finally {
    connection.release();
  }
}
