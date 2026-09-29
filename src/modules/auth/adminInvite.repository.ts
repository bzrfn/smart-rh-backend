import {
  createHash,
} from 'node:crypto';

import type {
  PoolConnection,
} from 'mysql2/promise';

import {
  pool,
} from '../../config/db.js';

import {
  safeEqualAdminInviteHmac,
} from './adminInvite.crypto.js';


export type CreateAdminInvitationInput = {
  invitationId: string;
  tokenHmac: string;

  sponsorAdminId: number;
  sponsorSessionVersion: number;

  inviteEmail: string;
  nombre: string;
  apellido: string;

  telefono?: string | null;
  direccion?: string | null;
  fechaIngreso?: string | null;

  diasVacacionesDisponibles?: number;

  requestIpHash?: string | null;

  expiresInMinutes: number;
};


export type CreateAdminInvitationResult =
  | {
      status: 'created';
    }
  | {
      status: 'active';
    }
  | {
      status: 'user_exists';
    }
  | {
      status: 'sponsor_invalid';
    }
  | {
      status: 'sponsor_stale';
    };


export type AcceptAdminInvitationResult =
  | {
      status: 'ok';

      user: {
        id: number;
        correo: string;
        role: 'admin';
        sessionVersion: number;
      };
    }
  | {
      status: 'invalid';
    }
  | {
      status: 'user_exists';
    };


type SponsorRow = {
  id: number;
  correo: string;
  activo: number;
  email_verificado: number;
  session_version: number;
  rol_nombre: string;
};


type InvitationRow = {
  invitation_id: string;
  token_hmac: string;

  sponsor_admin_id: number;
  sponsor_session_version: number;

  invite_email: string;

  nombre: string;
  apellido: string;

  telefono: string | null;
  direccion: string | null;
  fecha_ingreso: string | null;

  dias_vacaciones_disponibles: number;

  expires_at: Date | string;

  accepted_at: Date | null;
  accepted_user_id: number | null;

  revoked_at: Date | null;
};


const HEX_64 =
  /^[a-f0-9]{64}$/;


function normalizeEmail(
  value: unknown
): string {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}


function normalizeHex64(
  value: unknown
): string {
  return String(
    value ||
    ''
  )
    .trim()
    .toLowerCase();
}


function positiveInteger(
  value: unknown,
  fallback: number
): number {
  const numeric =
    Number(
      value
    );

  if (
    !Number.isInteger(
      numeric
    ) ||
    numeric <= 0
  ) {
    return fallback;
  }

  return numeric;
}


function isEligibleSponsor(
  sponsor:
    SponsorRow |
    null |
    undefined
): sponsor is SponsorRow {
  return Boolean(
    sponsor &&
    Number(
      sponsor.activo
    ) ===
      1 &&
    Number(
      sponsor.email_verificado
    ) ===
      1 &&
    String(
      sponsor.rol_nombre ||
      ''
    )
      .trim()
      .toLowerCase() ===
      'admin'
  );
}


function buildEmailLockName(
  correo: string
): string {
  const digest =
    createHash(
      'sha256'
    )
      .update(
        correo,
        'utf8'
      )
      .digest(
        'hex'
      )
      .slice(
        0,
        48
      );

  return (
    'smarth:admin-invite:' +
    digest
  );
}


async function acquireEmailLock(
  conn: PoolConnection,
  correo: string
): Promise<string> {
  const lockName =
    buildEmailLockName(
      correo
    );

  const [
    rows,
  ] =
    await conn.query(
      `
        SELECT
          GET_LOCK(
            ?,
            5
          ) AS acquired
      `,
      [
        lockName,
      ]
    );

  const acquired =
    Number(
      (
        rows as any[]
      )?.[0]?.acquired
    );

  if (
    acquired !==
    1
  ) {
    throw new Error(
      'No fue posible bloquear la invitación administrativa'
    );
  }

  return lockName;
}


async function releaseEmailLock(
  conn: PoolConnection,
  lockName: string | null
): Promise<void> {
  if (
    !lockName
  ) {
    return;
  }

  try {
    await conn.query(
      `
        SELECT
          RELEASE_LOCK(
            ?
          )
      `,
      [
        lockName,
      ]
    );
  } catch {
    // Liberación best-effort.
  }
}


async function lockSponsor(
  conn: PoolConnection,
  sponsorAdminId: number
): Promise<SponsorRow | null> {
  const [
    rows,
  ] =
    await conn.query(
      `
        SELECT
          u.id,
          u.correo,
          u.activo,

          COALESCE(
            u.email_verificado,
            0
          ) AS email_verificado,

          COALESCE(
            u.session_version,
            0
          ) AS session_version,

          r.nombre AS rol_nombre

        FROM
          usuarios u

        JOIN
          roles r
            ON r.id =
              u.rol_id

        WHERE
          u.id = ?

        LIMIT 1

        FOR UPDATE
      `,
      [
        sponsorAdminId,
      ]
    );

  return (
    (
      rows as SponsorRow[]
    )?.[0] ||
    null
  );
}


export async function createAdminInvitation(
  input: CreateAdminInvitationInput
): Promise<CreateAdminInvitationResult> {
  const invitationId =
    normalizeHex64(
      input.invitationId
    );

  const tokenHmac =
    normalizeHex64(
      input.tokenHmac
    );

  const inviteEmail =
    normalizeEmail(
      input.inviteEmail
    );

  const sponsorAdminId =
    positiveInteger(
      input.sponsorAdminId,
      0
    );

  const sponsorSessionVersion =
    Number(
      input.sponsorSessionVersion
    );

  const expiresInMinutes =
    positiveInteger(
      input.expiresInMinutes,
      30
    );

  if (
    !HEX_64.test(
      invitationId
    ) ||
    !HEX_64.test(
      tokenHmac
    ) ||
    !inviteEmail ||
    sponsorAdminId <= 0 ||
    !Number.isInteger(
      sponsorSessionVersion
    ) ||
    sponsorSessionVersion < 0
  ) {
    throw new Error(
      'Datos de invitación administrativa inválidos'
    );
  }

  const conn =
    await pool.getConnection();

  let lockName:
    string | null =
      null;

  try {
    lockName =
      await acquireEmailLock(
        conn,
        inviteEmail
      );

    await conn.beginTransaction();

    const sponsor =
      await lockSponsor(
        conn,
        sponsorAdminId
      );

    if (
      !isEligibleSponsor(
        sponsor
      )
    ) {
      await conn.commit();

      return {
        status:
          'sponsor_invalid',
      };
    }

    if (
      Number(
        sponsor.session_version
      ) !==
        sponsorSessionVersion
    ) {
      await conn.commit();

      return {
        status:
          'sponsor_stale',
      };
    }

    const [
      existingUsers,
    ] =
      await conn.query(
        `
          SELECT
            id

          FROM
            usuarios

          WHERE
            correo = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          inviteEmail,
        ]
      );

    if (
      (
        existingUsers as any[]
      ).length >
        0
    ) {
      await conn.commit();

      return {
        status:
          'user_exists',
      };
    }

    const [
      activeInvitations,
    ] =
      await conn.query(
        `
          SELECT
            invitation_id

          FROM
            admin_invitations

          WHERE
            invite_email = ?

            AND accepted_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > NOW()

          ORDER BY
            created_at DESC

          LIMIT 1

          FOR UPDATE
        `,
        [
          inviteEmail,
        ]
      );

    if (
      (
        activeInvitations as any[]
      ).length >
        0
    ) {
      await conn.commit();

      return {
        status:
          'active',
      };
    }

    const expiresAt =
      new Date(
        Date.now() +
        expiresInMinutes *
          60_000
      );

    await conn.query(
      `
        INSERT INTO admin_invitations (
          invitation_id,
          token_hmac,

          sponsor_admin_id,
          sponsor_session_version,

          invite_email,

          nombre,
          apellido,

          telefono,
          direccion,
          fecha_ingreso,

          dias_vacaciones_disponibles,

          request_ip_hash,

          expires_at
        )
        VALUES (
          ?, ?,
          ?, ?,
          ?,
          ?, ?,
          ?, ?, ?,
          ?,
          ?,
          ?
        )
      `,
      [
        invitationId,
        tokenHmac,

        sponsorAdminId,
        sponsorSessionVersion,

        inviteEmail,

        String(
          input.nombre ||
          ''
        ).trim(),

        String(
          input.apellido ||
          ''
        ).trim(),

        input.telefono ||
          null,

        input.direccion ||
          null,

        input.fechaIngreso ||
          null,

        positiveInteger(
          input.diasVacacionesDisponibles,
          12
        ),

        input.requestIpHash ||
          null,

        expiresAt,
      ]
    );

    await conn.commit();

    return {
      status:
        'created',
    };

  } catch (
    error
  ) {
    try {
      await conn.rollback();
    } catch {
      // Rollback best-effort.
    }

    throw error;

  } finally {
    await releaseEmailLock(
      conn,
      lockName
    );

    conn.release();
  }
}


export async function revokeAdminInvitation(
  invitationIdInput: string,
  sponsorAdminIdInput: number
): Promise<boolean> {
  const invitationId =
    normalizeHex64(
      invitationIdInput
    );

  const sponsorAdminId =
    positiveInteger(
      sponsorAdminIdInput,
      0
    );

  if (
    !HEX_64.test(
      invitationId
    ) ||
    sponsorAdminId <= 0
  ) {
    return false;
  }

  const [
    result,
  ] =
    await pool.query(
      `
        UPDATE
          admin_invitations

        SET
          revoked_at =
            COALESCE(
              revoked_at,
              NOW()
            )

        WHERE
          invitation_id = ?

          AND sponsor_admin_id = ?

          AND accepted_at IS NULL
          AND revoked_at IS NULL
      `,
      [
        invitationId,
        sponsorAdminId,
      ]
    );

  return (
    Number(
      (
        result as any
      ).affectedRows
    ) ===
      1
  );
}


export async function acceptAdminInvitation(
  invitationIdInput: string,
  candidateTokenHmacInput: string,
  passwordHashInput: string
): Promise<AcceptAdminInvitationResult> {
  const invitationId =
    normalizeHex64(
      invitationIdInput
    );

  const candidateTokenHmac =
    normalizeHex64(
      candidateTokenHmacInput
    );

  const passwordHash =
    String(
      passwordHashInput ||
      ''
    )
      .trim();

  if (
    !HEX_64.test(
      invitationId
    ) ||
    !HEX_64.test(
      candidateTokenHmac
    ) ||
    !passwordHash
  ) {
    return {
      status:
        'invalid',
    };
  }

  const [
    preliminaryRows,
  ] =
    await pool.query(
      `
        SELECT
          invite_email

        FROM
          admin_invitations

        WHERE
          invitation_id = ?

        LIMIT 1
      `,
      [
        invitationId,
      ]
    );

  const preliminary =
    (
      preliminaryRows as any[]
    )?.[0];

  if (
    !preliminary
  ) {
    return {
      status:
        'invalid',
    };
  }

  const inviteEmail =
    normalizeEmail(
      preliminary.invite_email
    );

  const conn =
    await pool.getConnection();

  let lockName:
    string | null =
      null;

  try {
    lockName =
      await acquireEmailLock(
        conn,
        inviteEmail
      );

    await conn.beginTransaction();

    const [
      invitationRows,
    ] =
      await conn.query(
        `
          SELECT
            invitation_id,
            token_hmac,

            sponsor_admin_id,
            sponsor_session_version,

            invite_email,

            nombre,
            apellido,

            telefono,
            direccion,
            fecha_ingreso,

            dias_vacaciones_disponibles,

            expires_at,

            accepted_at,
            accepted_user_id,

            revoked_at

          FROM
            admin_invitations

          WHERE
            invitation_id = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          invitationId,
        ]
      );

    const invitation =
      (
        invitationRows as InvitationRow[]
      )?.[0];

    if (
      !invitation ||
      invitation.accepted_at ||
      invitation.revoked_at ||
      new Date(
        invitation.expires_at
      ).getTime() <=
        Date.now()
    ) {
      await conn.commit();

      return {
        status:
          'invalid',
      };
    }

    if (
      !safeEqualAdminInviteHmac(
        invitation.token_hmac,
        candidateTokenHmac
      )
    ) {
      await conn.commit();

      return {
        status:
          'invalid',
      };
    }

    const sponsor =
      await lockSponsor(
        conn,
        Number(
          invitation.sponsor_admin_id
        )
      );

    if (
      !isEligibleSponsor(
        sponsor
      ) ||
      Number(
        sponsor.session_version
      ) !==
        Number(
          invitation.sponsor_session_version
        )
    ) {
      await conn.query(
        `
          UPDATE
            admin_invitations

          SET
            revoked_at = NOW()

          WHERE
            invitation_id = ?

            AND accepted_at IS NULL
            AND revoked_at IS NULL
        `,
        [
          invitationId,
        ]
      );

      await conn.commit();

      return {
        status:
          'invalid',
      };
    }

    const [
      existingUsers,
    ] =
      await conn.query(
        `
          SELECT
            id

          FROM
            usuarios

          WHERE
            correo = ?

          LIMIT 1

          FOR UPDATE
        `,
        [
          invitation.invite_email,
        ]
      );

    if (
      (
        existingUsers as any[]
      ).length >
        0
    ) {
      await conn.query(
        `
          UPDATE
            admin_invitations

          SET
            revoked_at = NOW()

          WHERE
            invitation_id = ?

            AND accepted_at IS NULL
            AND revoked_at IS NULL
        `,
        [
          invitationId,
        ]
      );

      await conn.commit();

      return {
        status:
          'user_exists',
      };
    }

    const [
      roleRows,
    ] =
      await conn.query(
        `
          SELECT
            id

          FROM
            roles

          WHERE
            LOWER(
              TRIM(
                nombre
              )
            ) =
              'admin'

          LIMIT 1
        `
      );

    const adminRoleId =
      Number(
        (
          roleRows as any[]
        )?.[0]?.id
      );

    if (
      !Number.isInteger(
        adminRoleId
      ) ||
      adminRoleId <= 0
    ) {
      throw new Error(
        'Rol admin no encontrado'
      );
    }

    const [
      insertResult,
    ] =
      await conn.query(
        `
          INSERT INTO usuarios (
            nombre,
            apellido,
            correo,
            contrasena,

            rol_id,

            activo,
            email_verificado,

            telefono,
            direccion,
            fecha_ingreso,

            dias_vacaciones_disponibles
          )
          VALUES (
            ?, ?, ?, ?,
            ?,
            1,
            1,
            ?, ?, ?,
            ?
          )
        `,
        [
          invitation.nombre,
          invitation.apellido,
          invitation.invite_email,
          passwordHash,

          adminRoleId,

          invitation.telefono,
          invitation.direccion,
          invitation.fecha_ingreso,

          invitation.dias_vacaciones_disponibles,
        ]
      );

    const userId =
      Number(
        (
          insertResult as any
        ).insertId
      );

    if (
      !Number.isInteger(
        userId
      ) ||
      userId <= 0
    ) {
      throw new Error(
        'No fue posible crear el administrador invitado'
      );
    }

    const [
      createdRows,
    ] =
      await conn.query(
        `
          SELECT
            u.id,
            u.correo,

            COALESCE(
              u.session_version,
              0
            ) AS session_version,

            r.nombre AS rol_nombre

          FROM
            usuarios u

          JOIN
            roles r
              ON r.id =
                u.rol_id

          WHERE
            u.id = ?

          LIMIT 1
        `,
        [
          userId,
        ]
      );

    const created =
      (
        createdRows as any[]
      )?.[0];

    if (
      !created ||
      String(
        created.rol_nombre ||
        ''
      )
        .trim()
        .toLowerCase() !==
        'admin'
    ) {
      throw new Error(
        'Administrador invitado inválido'
      );
    }

    const [
      consumeResult,
    ] =
      await conn.query(
        `
          UPDATE
            admin_invitations

          SET
            accepted_at = NOW(),
            accepted_user_id = ?

          WHERE
            invitation_id = ?

            AND accepted_at IS NULL
            AND revoked_at IS NULL
            AND expires_at > NOW()
        `,
        [
          userId,
          invitationId,
        ]
      );

    if (
      Number(
        (
          consumeResult as any
        ).affectedRows
      ) !==
        1
    ) {
      throw new Error(
        'La invitación cambió durante la aceptación'
      );
    }

    await conn.commit();

    return {
      status:
        'ok',

      user: {
        id:
          userId,

        correo:
          String(
            created.correo
          ),

        role:
          'admin',

        sessionVersion:
          Number(
            created.session_version ||
            0
          ),
      },
    };

  } catch (
    error
  ) {
    try {
      await conn.rollback();
    } catch {
      // Rollback best-effort.
    }

    throw error;

  } finally {
    await releaseEmailLock(
      conn,
      lockName
    );

    conn.release();
  }
}
