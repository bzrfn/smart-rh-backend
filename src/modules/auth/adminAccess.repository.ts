import {
  pool,
} from '../../config/db.js';

import {
  safeEqualAdminAccessHmac,
} from './adminAccess.crypto.js';


export type EligibleAdmin = {
  id: number;

  nombre: string;

  apellido: string;

  correo: string;
};


export type CreateAdminAccessChallengeInput = {
  challengeId: string;

  adminUserId: number;

  codeHmac: string;

  requestIpHash:
    string | null;

  expiresInMinutes:
    number;

  maxAttempts:
    number;
};


export type ConsumeAdminAccessChallengeResult =
  | {
      status: 'ok';

      admin: EligibleAdmin;
    }
  | {
      status: 'invalid';
    };


type LockedChallengeRow = {
  challenge_id: string;

  admin_user_id: number;

  code_hmac: string;

  attempts: number;

  max_attempts: number;

  expired: number;

  consumed: number;

  id: number;

  nombre: string;

  apellido: string;

  correo: string;

  activo: number;

  email_verificado: number;

  rol_nombre: string;
};


export async function findEligibleAdminByEmail(
  correoInput: string
): Promise<EligibleAdmin | null> {
  const correo =
    String(
      correoInput ||
      ''
    )
      .trim()
      .toLowerCase();

  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          u.id,
          u.nombre,
          u.apellido,
          u.correo

        FROM usuarios u

        INNER JOIN roles r
          ON r.id = u.rol_id

        WHERE
          LOWER(
            TRIM(
              u.correo
            )
          ) = ?

          AND u.activo = 1

          AND COALESCE(
            u.email_verificado,
            0
          ) = 1

          AND LOWER(
            TRIM(
              r.nombre
            )
          ) = 'admin'

        LIMIT 1
      `,
      [
        correo,
      ]
    );

  return (
    rows as EligibleAdmin[]
  )[0] || null;
}


export async function countRecentAdminChallenges(
  adminUserId: number,
  windowMinutes: number
): Promise<number> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total

        FROM admin_access_challenges

        WHERE
          admin_user_id = ?

          AND created_at >=
            DATE_SUB(
              NOW(),
              INTERVAL ? MINUTE
            )
      `,
      [
        adminUserId,
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


export async function countRecentIpChallenges(
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

        FROM admin_access_challenges

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


export async function secondsSinceLastAdminChallenge(
  adminUserId: number
): Promise<number | null> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          TIMESTAMPDIFF(
            SECOND,
            MAX(created_at),
            NOW()
          ) AS seconds_elapsed

        FROM admin_access_challenges

        WHERE
          admin_user_id = ?
      `,
      [
        adminUserId,
      ]
    );

  const row =
    (
      rows as Array<{
        seconds_elapsed:
          number |
          string |
          null;
      }>
    )[0];

  if (
    row?.seconds_elapsed ===
    null ||
    row?.seconds_elapsed ===
    undefined
  ) {
    return null;
  }

  return Number(
    row.seconds_elapsed
  );
}


export async function invalidateActiveAdminChallenges(
  adminUserId: number
): Promise<void> {
  await pool.query(
    `
      UPDATE admin_access_challenges

      SET
        used_at = COALESCE(
          used_at,
          NOW()
        )

      WHERE
        admin_user_id = ?

        AND used_at IS NULL
    `,
    [
      adminUserId,
    ]
  );
}


export async function createAdminAccessChallenge(
  input:
    CreateAdminAccessChallengeInput
): Promise<void> {
  await pool.query(
    `
      INSERT INTO admin_access_challenges (
        challenge_id,
        admin_user_id,
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
      input.adminUserId,
      input.codeHmac,
      input.requestIpHash,
      input.maxAttempts,
      input.expiresInMinutes,
    ]
  );
}


export async function consumeAdminAccessChallenge(
  challengeId: string,
  candidateHmac: string
): Promise<ConsumeAdminAccessChallengeResult> {
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
            c.challenge_id,
            c.admin_user_id,
            c.code_hmac,
            c.attempts,
            c.max_attempts,

            CASE
              WHEN c.expires_at <= NOW()
              THEN 1
              ELSE 0
            END AS expired,

            CASE
              WHEN c.used_at IS NOT NULL
              THEN 1
              ELSE 0
            END AS consumed,

            u.id,
            u.nombre,
            u.apellido,
            u.correo,
            u.activo,
            u.email_verificado,

            r.nombre AS rol_nombre

          FROM admin_access_challenges c

          INNER JOIN usuarios u
            ON u.id =
              c.admin_user_id

          INNER JOIN roles r
            ON r.id =
              u.rol_id

          WHERE
            c.challenge_id = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          challengeId,
        ]
      );

    const row =
      (
        rows as
          LockedChallengeRow[]
      )[0];

    if (!row) {
      await connection.commit();

      return {
        status:
          'invalid',
      };
    }

    const eligible =
      Number(
        row.activo
      ) === 1 &&
      Number(
        row.email_verificado
      ) === 1 &&
      String(
        row.rol_nombre ||
        ''
      )
        .trim()
        .toLowerCase() ===
        'admin';

    const unavailable =
      Number(
        row.expired
      ) === 1 ||
      Number(
        row.consumed
      ) === 1 ||
      Number(
        row.attempts
      ) >=
        Number(
          row.max_attempts
        );

    if (
      !eligible ||
      unavailable
    ) {
      if (
        Number(
          row.consumed
        ) !== 1
      ) {
        await connection.query(
          `
            UPDATE admin_access_challenges

            SET
              used_at =
                COALESCE(
                  used_at,
                  NOW()
                )

            WHERE
              challenge_id = ?
          `,
          [
            challengeId,
          ]
        );
      }

      await connection.commit();

      return {
        status:
          'invalid',
      };
    }

    const matches =
      safeEqualAdminAccessHmac(
        row.code_hmac,
        candidateHmac
      );

    if (!matches) {
      const nextAttempts =
        Number(
          row.attempts
        ) + 1;

      await connection.query(
        `
          UPDATE admin_access_challenges

          SET
            attempts = ?,

            last_attempt_at =
              NOW(),

            used_at =
              CASE
                WHEN ? >=
                  max_attempts
                THEN NOW()
                ELSE used_at
              END

          WHERE
            challenge_id = ?
        `,
        [
          nextAttempts,
          nextAttempts,
          challengeId,
        ]
      );

      await connection.commit();

      return {
        status:
          'invalid',
      };
    }

    await connection.query(
      `
        UPDATE admin_access_challenges

        SET
          used_at = NOW(),

          last_attempt_at =
            NOW()

        WHERE
          challenge_id = ?

          AND used_at IS NULL
      `,
      [
        challengeId,
      ]
    );

    await connection.commit();

    return {
      status:
        'ok',

      admin: {
        id:
          Number(
            row.id
          ),

        nombre:
          row.nombre,

        apellido:
          row.apellido,

        correo:
          row.correo,
      },
    };

  } catch (error) {
    await connection.rollback();

    throw error;

  } finally {
    connection.release();
  }
}


export type ActiveAdminAccessChallenge = {
  challengeId: string;

  secondsElapsed: number;
};


export async function findLatestActiveAdminChallenge(
  adminUserId: number
): Promise<ActiveAdminAccessChallenge | null> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          challenge_id,

          TIMESTAMPDIFF(
            SECOND,
            created_at,
            NOW()
          ) AS seconds_elapsed

        FROM admin_access_challenges

        WHERE
          admin_user_id = ?

          AND used_at IS NULL

          AND expires_at > NOW()

          AND attempts <
            max_attempts

        ORDER BY
          created_at DESC

        LIMIT 1
      `,
      [
        adminUserId,
      ]
    );

  const row =
    (
      rows as Array<{
        challenge_id:
          string;

        seconds_elapsed:
          number | string;
      }>
    )[0];

  if (!row) {
    return null;
  }

  return {
    challengeId:
      String(
        row.challenge_id
      ),

    secondsElapsed:
      Number(
        row.seconds_elapsed ||
        0
      ),
  };
}
