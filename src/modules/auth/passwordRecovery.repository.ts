import {
  pool,
} from '../../config/db.js';

import {
  comparePasswordRecoveryHmac,
} from './passwordRecovery.crypto.js';


export type PasswordRecoveryUser = {
  id: number;
  nombre: string;
  apellido: string;
  correo: string;
  activo: number;
  email_verificado: number;
};


export type ActivePasswordResetChallenge = {
  challengeId: string;
  secondsElapsed: number;
};


export type ConsumePasswordResetResult =
  |
  {
      status: 'ok';
      user: {
        id: number;
        nombre: string;
        apellido: string;
        correo: string;
      };
    }
  |
  {
      status: 'invalid';
    };


export async function findEligiblePasswordRecoveryUserByEmail(
  correo: string
):
Promise<
  PasswordRecoveryUser |
  null
> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          id,
          nombre,
          apellido,
          correo,
          activo,
          COALESCE(
            email_verificado,
            0
          ) AS email_verificado

        FROM usuarios

        WHERE
          LOWER(correo) =
            LOWER(?)

          AND activo = 1

          AND COALESCE(
            email_verificado,
            0
          ) = 1

        LIMIT 1
      `,
      [
        correo,
      ]
    );


  const row =
    (
      rows as Array<
        PasswordRecoveryUser
      >
    )[0];


  return (
    row ||
    null
  );
}


export async function findLatestActivePasswordResetChallenge(
  userId: number
):
Promise<
  ActivePasswordResetChallenge |
  null
> {
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

        FROM password_reset_challenges

        WHERE
          user_id = ?

          AND used_at IS NULL

          AND expires_at > NOW()

          AND attempts <
            max_attempts

        ORDER BY
          created_at DESC

        LIMIT 1
      `,
      [
        userId,
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


export async function countRecentPasswordResetChallenges(
  userId: number,
  windowMinutes: number
):
Promise<number> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total

        FROM password_reset_challenges

        WHERE
          user_id = ?

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
    )[0]?.total ||
    0
  );
}


export async function countRecentPasswordResetIpChallenges(
  requestIpHash: string,
  windowMinutes: number
):
Promise<number> {
  const [
    rows,
  ] =
    await pool.query(
      `
        SELECT
          COUNT(*) AS total

        FROM password_reset_challenges

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


  return Number(
    (
      rows as Array<{
        total:
          number | string;
      }>
    )[0]?.total ||
    0
  );
}


export async function invalidateActivePasswordResetChallenges(
  userId: number
):
Promise<void> {
  await pool.query(
    `
      UPDATE
        password_reset_challenges

      SET
        used_at =
          COALESCE(
            used_at,
            NOW()
          )

      WHERE
        user_id = ?

        AND used_at IS NULL
    `,
    [
      userId,
    ]
  );
}


export async function createPasswordResetChallenge(
  input: {
    challengeId: string;
    userId: number;
    codeHmac: string;
    requestIpHash:
      string | null;
    expiresInMinutes: number;
    maxAttempts: number;
  }
):
Promise<void> {
  await pool.query(
    `
      INSERT INTO
        password_reset_challenges
      (
        challenge_id,
        user_id,
        code_hmac,
        request_ip_hash,
        attempts,
        max_attempts,
        expires_at,
        used_at,
        last_attempt_at,
        created_at
      )
      VALUES
      (
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
      input.codeHmac,
      input.requestIpHash,
      input.maxAttempts,
      input.expiresInMinutes,
    ]
  );
}


export async function consumePasswordResetChallenge(
  challengeId: string,
  candidateCodeHmac: string,
  passwordHash: string
):
Promise<
  ConsumePasswordResetResult
> {
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
            c.user_id,
            c.code_hmac,
            c.attempts,
            c.max_attempts,
            c.expires_at,
            c.used_at,

            CASE
              WHEN c.expires_at > NOW()
              THEN 1
              ELSE 0
            END AS not_expired,

            u.nombre,
            u.apellido,
            u.correo,
            u.activo,

            COALESCE(
              u.email_verificado,
              0
            ) AS email_verificado

          FROM
            password_reset_challenges c

          INNER JOIN
            usuarios u
              ON u.id =
                c.user_id

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
        rows as Array<{
          challenge_id:
            string;

          user_id:
            number;

          code_hmac:
            string;

          attempts:
            number;

          max_attempts:
            number;

          expires_at:
            Date;

          used_at:
            Date | null;

          not_expired:
            number;

          nombre:
            string;

          apellido:
            string;

          correo:
            string;

          activo:
            number;

          email_verificado:
            number;
        }>
      )[0];


    if (!row) {
      await connection.rollback();

      return {
        status:
          'invalid',
      };
    }


    const unavailable =
      Boolean(
        row.used_at
      ) ||
      !Boolean(
        Number(
          row.not_expired
        )
      ) ||
      Number(
        row.attempts
      ) >=
        Number(
          row.max_attempts
        ) ||
      Number(
        row.activo
      ) !==
        1 ||
      Number(
        row.email_verificado
      ) !==
        1;


    if (unavailable) {
      if (
        !row.used_at &&
        (
          Number(
            row.activo
          ) !==
            1 ||
          Number(
            row.email_verificado
          ) !==
            1
        )
      ) {
        await connection.query(
          `
            UPDATE
              password_reset_challenges

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

        await connection.commit();
      } else {
        await connection.rollback();
      }

      return {
        status:
          'invalid',
      };
    }


    const matches =
      comparePasswordRecoveryHmac(
        row.code_hmac,
        candidateCodeHmac
      );


    if (!matches) {
      const nextAttempts =
        Number(
          row.attempts
        ) +
        1;


      await connection.query(
        `
          UPDATE
            password_reset_challenges

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
        UPDATE
          usuarios

        SET
          contrasena = ?,
          session_version =
            session_version + 1,
          updated_at = NOW()

        WHERE
          id = ?
      `,
      [
        passwordHash,
        row.user_id,
      ]
    );



    await connection.query(
      `
        UPDATE
          email_verification_codes

        SET
          usado = 1

        WHERE
          usuario_id = ?
          AND tipo = 'LOGIN_2FA'
          AND usado = 0
      `,
      [
        row.user_id,
      ]
    );


    await connection.query(
      `
        UPDATE
          password_reset_challenges

        SET
          used_at = NOW(),
          last_attempt_at = NOW()

        WHERE
          challenge_id = ?

          AND used_at IS NULL
      `,
      [
        challengeId,
      ]
    );


    await connection.query(
      `
        UPDATE
          password_reset_challenges

        SET
          used_at =
            COALESCE(
              used_at,
              NOW()
            )

        WHERE
          user_id = ?

          AND used_at IS NULL
      `,
      [
        row.user_id,
      ]
    );


    await connection.commit();


    return {
      status:
        'ok',

      user: {
        id:
          Number(
            row.user_id
          ),

        nombre:
          String(
            row.nombre ||
            ''
          ),

        apellido:
          String(
            row.apellido ||
            ''
          ),

        correo:
          String(
            row.correo ||
            ''
          ),
      },
    };

  } catch (error) {
    await connection.rollback();

    throw error;

  } finally {
    connection.release();
  }
}
