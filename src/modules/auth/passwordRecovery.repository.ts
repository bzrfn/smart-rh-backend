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
  session_version: number;
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
          ) AS email_verificado,
            session_version

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


export type ReplacePasswordResetChallengeResult =
  |
    {
      status:
        'created';
    }
  |
    {
      status:
        'blocked' |
        'stale' |
        'ineligible';
    };


export async function replacePasswordResetChallenge(
  input: {
    challengeId: string;
    userId: number;
    expectedSessionVersion: number;
    codeHmac: string;

    requestIpHash:
      string | null;

    expiresInMinutes: number;
    maxAttempts: number;
    cooldownSeconds: number;
    rateWindowMinutes: number;
    maxPerUserWindow: number;
  }
):
Promise<
  ReplacePasswordResetChallengeResult
> {
  const connection =
    await pool.getConnection();


  try {
    await connection.beginTransaction();


    // Orden de lock global:
    // 1. usuario
    // 2. challenge
    const [
      userRows,
    ] =
      await connection.query(
        `
          SELECT
            id,
            activo,

            COALESCE(
              email_verificado,
              0
            ) AS email_verificado,

            session_version

          FROM usuarios

          WHERE
            id = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          input.userId,
        ]
      );


    const user =
      (
        userRows as Array<{
          id:
            number;

          activo:
            number;

          email_verificado:
            number;

          session_version:
            number;
        }>
      )[0];


    if (
      !user ||
      Number(
        user.activo
      ) !==
        1 ||
      Number(
        user.email_verificado
      ) !==
        1
    ) {
      await connection.rollback();

      return {
        status:
          'ineligible',
      };
    }


    const currentSessionVersion =
      Number(
        user.session_version
      );

    const expectedSessionVersion =
      Number(
        input.expectedSessionVersion
      );


    if (
      !Number.isInteger(
        currentSessionVersion
      ) ||
      currentSessionVersion < 1 ||
      !Number.isInteger(
        expectedSessionVersion
      ) ||
      expectedSessionVersion < 1 ||
      currentSessionVersion !==
        expectedSessionVersion
    ) {
      await connection.rollback();

      return {
        status:
          'stale',
      };
    }


    // Revalidacion dentro de la transaccion.
    const [
      activeRows,
    ] =
      await connection.query(
        `
          SELECT
            challenge_id,

            TIMESTAMPDIFF(
              SECOND,
              created_at,
              NOW()
            ) AS seconds_elapsed

          FROM
            password_reset_challenges

          WHERE
            user_id = ?

            AND used_at IS NULL

            AND expires_at >
              NOW()

            AND attempts <
              max_attempts

          ORDER BY
            created_at DESC,
            challenge_id DESC

          LIMIT 1

          FOR UPDATE
        `,
        [
          input.userId,
        ]
      );


    const active =
      (
        activeRows as Array<{
          challenge_id:
            string;

          seconds_elapsed:
            number | string;
        }>
      )[0];


    if (
      active &&
      Number(
        active.seconds_elapsed ||
        0
      ) <
        input.cooldownSeconds
    ) {
      await connection.rollback();

      return {
        status:
          'blocked',
      };
    }


    const [
      recentRows,
    ] =
      await connection.query(
        `
          SELECT
            COUNT(*) AS total

          FROM
            password_reset_challenges

          WHERE
            user_id = ?

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


    const recentCount =
      Number(
        (
          recentRows as Array<{
            total:
              number | string;
          }>
        )[0]?.total ||
        0
      );


    if (
      recentCount >=
        input.maxPerUserWindow
    ) {
      await connection.rollback();

      return {
        status:
          'blocked',
      };
    }


    // Invalida anteriores e inserta el nuevo
    // dentro de la MISMA transaccion.
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
        input.userId,
      ]
    );


    await connection.query(
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


    await connection.commit();


    return {
      status:
        'created',
    };

  } catch (error) {
    await connection.rollback();

    throw error;

  } finally {
    connection.release();
  }
}


export async function invalidatePasswordResetChallenge(
  challengeId: string
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
        challenge_id = ?

        AND used_at IS NULL
    `,
    [
      challengeId,
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


    // Lectura no bloqueante para conocer al propietario.
    // user_id es inmutable durante la vida del challenge.
    const [
      ownerRows,
    ] =
      await connection.query(
        `
          SELECT
            user_id

          FROM
            password_reset_challenges

          WHERE
            challenge_id = ?

          LIMIT 1
        `,
        [
          challengeId,
        ]
      );


    const owner =
      (
        ownerRows as Array<{
          user_id:
            number;
        }>
      )[0];


    if (!owner) {
      await connection.rollback();

      return {
        status:
          'invalid',
      };
    }


    const userId =
      Number(
        owner.user_id
      );


    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      await connection.rollback();

      return {
        status:
          'invalid',
      };
    }


    // Primer lock real: USUARIO.
    const [
      userRows,
    ] =
      await connection.query(
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
            id = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          userId,
        ]
      );


    const user =
      (
        userRows as Array<{
          id:
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


    if (!user) {
      await connection.rollback();

      return {
        status:
          'invalid',
      };
    }


    if (
      Number(
        user.activo
      ) !==
        1 ||
      Number(
        user.email_verificado
      ) !==
        1
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
            user_id = ?

            AND used_at IS NULL
        `,
        [
          userId,
        ]
      );


      await connection.commit();


      return {
        status:
          'invalid',
      };
    }


    // Segundo lock: challenge ACTUAL del usuario.
    // No basta con que el challenge recibido exista.
    const [
      rows,
    ] =
      await connection.query(
        `
          SELECT
            challenge_id,
            user_id,
            code_hmac,
            attempts,
            max_attempts,
            expires_at,
            used_at

          FROM
            password_reset_challenges

          WHERE
            user_id = ?

            AND used_at IS NULL

            AND expires_at >
              NOW()

            AND attempts <
              max_attempts

          ORDER BY
            created_at DESC,
            challenge_id DESC

          LIMIT 1

          FOR UPDATE
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
        }>
      )[0];


    // Si durante la espera se emitio uno nuevo,
    // el challenge viejo ya no puede consumirse.
    if (
      !row ||
      String(
        row.challenge_id
      ) !==
        challengeId
    ) {
      await connection.rollback();

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


    // Password + revocacion de sesiones son atomicos
    // con el consumo del challenge.
    await connection.query(
      `
        UPDATE
          usuarios

        SET
          contrasena = ?,

          session_version =
            session_version + 1,

          updated_at =
            NOW()

        WHERE
          id = ?
      `,
      [
        passwordHash,
        userId,
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
        userId,
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
            ),

          last_attempt_at =
            CASE
              WHEN challenge_id = ?
              THEN NOW()
              ELSE last_attempt_at
            END

        WHERE
          user_id = ?

          AND used_at IS NULL
      `,
      [
        challengeId,
        userId,
      ]
    );


    await connection.commit();


    return {
      status:
        'ok',

      user: {
        id:
          Number(
            user.id
          ),

        nombre:
          String(
            user.nombre ||
            ''
          ),

        apellido:
          String(
            user.apellido ||
            ''
          ),

        correo:
          String(
            user.correo ||
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
