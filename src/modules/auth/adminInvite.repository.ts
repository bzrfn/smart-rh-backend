import { INITIAL_INVITATION_VACATION_DAYS, validateInvitationProfile, type InvitationProfile } from './adminInvite.profile.js';
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
  accountType?: 'admin' | 'empleado';
  replacesInvitationId?: string;
  replacesInvitationEmail?: string;
  profileCompletionRequired?: boolean;
  existingUserId?: number;
  existingUserSessionVersion?: number;
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
    }
  | { status: 'invitation_unavailable' | 'cooldown' };


export type AcceptAdminInvitationResult =
  | {
      status: 'ok';

      user: {
        id: number;
        correo: string;
        role: 'admin' | 'empleado';
        sessionVersion: number;
      };
    }
  | { status: 'profile_required' }
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
  account_type?: 'admin' | 'empleado' | null;
  profile_completion_required?: number;
  existing_user_id?: number | null;
  existing_user_session_version?: number | null;
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


function normalizeInviteRole(
  value: unknown
): 'admin' | 'empleado' {
  return String(
    value || ''
  )
    .trim()
    .toLowerCase() === 'empleado'
    ? 'empleado'
    : 'admin';
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

  const emailLocks: string[] = [];
  const originalEmail = normalizeEmail(input.replacesInvitationEmail || inviteEmail);
  const emailChanging = Boolean(input.replacesInvitationId && originalEmail !== inviteEmail);

  try {
    // Every creator/acceptor uses the same per-email lock; sort both keys to prevent opposite corrections from deadlocking.
    for (const email of [...new Set([inviteEmail, originalEmail])].sort()) emailLocks.push(await acquireEmailLock(conn, email));

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
            id, rol_id, activo, session_version, (SELECT nombre FROM roles WHERE id=usuarios.rol_id) AS role

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

    const existing = (existingUsers as any[])[0];
    if (input.existingUserId) {
      if (!existing || Number(existing.id) !== input.existingUserId || Number(existing.activo) !== 1 ||
          Number(existing.session_version) !== input.existingUserSessionVersion || String(existing.role).toLowerCase() !== input.accountType) {
        await conn.commit(); return { status: 'invitation_unavailable' };
      }
      const [recent] = await conn.query(`SELECT invitation_id FROM admin_invitations WHERE invite_email=? AND created_at>DATE_SUB(NOW(), INTERVAL 60 SECOND) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [inviteEmail]);
      if ((recent as any[]).length) { await conn.commit(); return { status: 'cooldown' }; }
      await conn.query(`UPDATE admin_invitations SET revoked_at=NOW(), delivery_failed_at=NULL WHERE invite_email=? AND accepted_at IS NULL AND (revoked_at IS NULL OR delivery_failed_at IS NOT NULL)`, [originalEmail]);
    } else if ((existingUsers as any[]).length) {
      await conn.commit(); return { status: 'user_exists' };
    }

    if (input.replacesInvitationId) {
      const [targets] = await conn.query(
        `SELECT invitation_id, account_type, created_at, accepted_at, revoked_at, delivery_failed_at, existing_user_id FROM admin_invitations
         WHERE invitation_id = ? AND invite_email = ? LIMIT 1 FOR UPDATE`,
        [input.replacesInvitationId, originalEmail]
      );
      const target = (targets as any[])[0];
      if (!target || target.accepted_at || (target.revoked_at && !target.delivery_failed_at) ||
          (target.account_type && target.account_type !== input.accountType) || (emailChanging && target.existing_user_id)) {
        await conn.commit(); return { status: 'invitation_unavailable' };
      }
      if (!emailChanging && new Date(target.created_at).getTime() > Date.now() - 60000) {
        await conn.commit(); return { status: 'cooldown' };
      }
      if (emailChanging) {
        const [conflicts] = await conn.query(`SELECT invitation_id FROM admin_invitations
          WHERE invite_email=? AND accepted_at IS NULL AND (revoked_at IS NULL OR delivery_failed_at IS NOT NULL)
          AND invitation_id<>? LIMIT 1 FOR UPDATE`, [inviteEmail, input.replacesInvitationId]);
        if ((conflicts as any[]).length) { await conn.commit(); return { status: 'active' }; }
      }
      await conn.query(
        `UPDATE admin_invitations SET revoked_at = NOW(), delivery_failed_at = NULL
         WHERE invite_email = ? AND accepted_at IS NULL AND (revoked_at IS NULL OR delivery_failed_at IS NOT NULL)`, [originalEmail]
      );
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

          expires_at,
          account_type,
          existing_user_id, existing_user_session_version, profile_completion_required
        )
        VALUES (
          ?,
          ?, ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?,
          ?,
          ?, ?, ?, ?, ?
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
        input.accountType || null,
        input.existingUserId || null, input.existingUserSessionVersion ?? null, input.profileCompletionRequired ? 1 : 0,
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
    for (const name of emailLocks.reverse()) await releaseEmailLock(conn, name);

    conn.release();
  }
}


export async function revokeAdminInvitation(
  invitationIdInput: string,
  sponsorAdminIdInput: number,
  reason: 'revoked' | 'delivery_failed' = 'revoked'
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
            ),
          delivery_failed_at = CASE WHEN ? THEN NOW() ELSE NULL END

        WHERE
          invitation_id = ?

          AND sponsor_admin_id = ?

          AND accepted_at IS NULL
          AND revoked_at IS NULL
      `,
      [
        reason === 'delivery_failed',
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
  passwordHashInput: string,
  inviteRoleInput: 'admin' | 'empleado' = 'admin',
  profileInput?: InvitationProfile
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

  const inviteRole =
    normalizeInviteRole(
      inviteRoleInput
    );

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

            revoked_at, existing_user_id, existing_user_session_version, account_type, profile_completion_required

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

    if (invitation.account_type && invitation.account_type !== inviteRole) { await conn.commit(); return { status: 'invalid' }; }
    const requiresProfile = Number(invitation.profile_completion_required) === 1;
    if (requiresProfile && !profileInput) { await conn.commit(); return { status: 'profile_required' }; }
    const profile = profileInput ? validateInvitationProfile(profileInput) : undefined;

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

    if (invitation.existing_user_id) {
      const [targets] = await conn.query(`SELECT u.id, u.correo, u.activo, u.session_version, r.nombre AS role FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=? FOR UPDATE`, [invitation.existing_user_id]);
      const target = (targets as any[])[0];
      if (!target || (existingUsers as any[]).length !== 1 || Number((existingUsers as any[])[0].id) !== Number(target.id) ||
          normalizeEmail(target.correo) !== normalizeEmail(invitation.invite_email) || Number(target.activo) !== 1 ||
          Number(target.session_version) !== Number(invitation.existing_user_session_version) || String(target.role).toLowerCase() !== inviteRole) {
        await conn.commit(); return { status: 'invalid' };
      }
      const [updated] = await conn.query(`UPDATE usuarios SET contrasena=?, email_verificado=1, session_version=session_version+1, updated_at=NOW() WHERE id=? AND session_version=? AND activo=1`, [passwordHash, target.id, target.session_version]);
      if (Number((updated as any).affectedRows) !== 1) throw new Error('La cuenta cambió durante la aceptación');
      const [consumed] = await conn.query(`UPDATE admin_invitations SET accepted_at=NOW(), accepted_user_id=? WHERE invitation_id=? AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at>NOW()`, [target.id, invitationId]);
      if (Number((consumed as any).affectedRows) !== 1) throw new Error('La invitación cambió durante la aceptación');
      await conn.commit();
      return { status: 'ok', user: { id: Number(target.id), correo: target.correo, role: inviteRole, sessionVersion: Number(target.session_version)+1 } };
    }

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
              ?

          LIMIT 1
        `,
        [
          normalizeInviteRole(
            inviteRole
          ),
        ]
      );

    const invitedRoleId =
      Number(
        (
          roleRows as any[]
        )?.[0]?.id
      );

    if (
      !Number.isInteger(
        invitedRoleId
      ) ||
      invitedRoleId <= 0
    ) {
      throw new Error(
        'Rol de la invitación no encontrado'
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
          profile?.nombre ?? invitation.nombre,
          profile?.apellido ?? invitation.apellido,
          invitation.invite_email,
          passwordHash,

          invitedRoleId,

          profile?.telefono ?? invitation.telefono,
          profile?.direccion ?? invitation.direccion,
          invitation.fecha_ingreso,

          requiresProfile ? INITIAL_INVITATION_VACATION_DAYS : invitation.dias_vacaciones_disponibles,
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
        'No fue posible crear la cuenta invitada'
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
        normalizeInviteRole(
          inviteRole
        )
    ) {
      throw new Error(
        'Cuenta invitada inválida'
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
          normalizeInviteRole(
            inviteRole
          ),

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

export type PendingInvitation = {
  existing_user_id?: number | null;
  profile_completion_required: number;
  invitation_id: string; invite_email: string; nombre: string; apellido: string;
  account_type: 'admin' | 'empleado' | null;
  telefono: string | null; direccion: string | null; fecha_ingreso: Date | string | null;
  delivery_failed_at: Date | string | null;
  dias_vacaciones_disponibles: number; created_at: Date | string; expires_at: Date | string;
};
export async function listPendingInvitations(): Promise<PendingInvitation[]> {
  const [rows] = await pool.query(`
    SELECT i.invitation_id, i.invite_email, i.nombre, i.apellido, i.account_type,
      i.telefono, i.direccion, i.fecha_ingreso, i.profile_completion_required, i.dias_vacaciones_disponibles, i.created_at, i.expires_at, i.delivery_failed_at
    FROM admin_invitations i
    WHERE i.accepted_at IS NULL AND (i.revoked_at IS NULL OR i.delivery_failed_at IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.correo = i.invite_email)
      AND NOT EXISTS (SELECT 1 FROM admin_invitations newer
        WHERE newer.invite_email = i.invite_email AND newer.accepted_at IS NULL AND (newer.revoked_at IS NULL OR newer.delivery_failed_at IS NOT NULL)
          AND (newer.created_at > i.created_at OR (newer.created_at = i.created_at AND newer.invitation_id > i.invitation_id)))
    ORDER BY i.created_at DESC LIMIT 1000
  `);
  return rows as PendingInvitation[];
}
export async function findPendingInvitation(id: string): Promise<PendingInvitation | null> {
  if (!HEX_64.test(id)) return null;
  const [rows] = await pool.query(`
    SELECT invitation_id, invite_email, nombre, apellido, account_type, existing_user_id,
      telefono, direccion, fecha_ingreso, profile_completion_required, dias_vacaciones_disponibles, created_at, expires_at, delivery_failed_at
    FROM admin_invitations WHERE invitation_id = ? AND accepted_at IS NULL AND (revoked_at IS NULL OR delivery_failed_at IS NOT NULL) LIMIT 1
  `, [id]);
  return (rows as PendingInvitation[])[0] || null;
}

export type InvitationPreview = {
  correo: string; tipoCuenta: 'admin' | 'empleado'; fechaIngreso: string | null;
  diasVacaciones: number; requiresProfileCompletion: boolean; existingAccount: boolean;
  perfil: { nombre: string; apellido: string; telefono: string; direccion: string };
};
export async function inspectAdminInvitation(id: string, candidateHmac: string, role: 'admin' | 'empleado'): Promise<InvitationPreview | null> {
  const [rows] = await pool.query(`SELECT i.*, s.activo AS sponsor_active, s.email_verificado AS sponsor_verified,
    s.session_version AS current_sponsor_version, r.nombre AS sponsor_role,
    u.id AS target_id, u.correo AS target_email, u.activo AS target_active, u.session_version AS target_version,
    ur.nombre AS target_role
    FROM admin_invitations i JOIN usuarios s ON s.id=i.sponsor_admin_id JOIN roles r ON r.id=s.rol_id
    LEFT JOIN usuarios u ON u.id=i.existing_user_id LEFT JOIN roles ur ON ur.id=u.rol_id
    WHERE i.invitation_id=? LIMIT 1`, [id]);
  const item = (rows as any[])[0];
  if (!item || item.accepted_at || item.revoked_at || new Date(item.expires_at).getTime() <= Date.now() ||
      !safeEqualAdminInviteHmac(item.token_hmac, candidateHmac) || (item.account_type && item.account_type !== role) ||
      Number(item.sponsor_active)!==1 || Number(item.sponsor_verified)!==1 || normalizeEmail(item.sponsor_role)!=='admin' ||
      Number(item.current_sponsor_version)!==Number(item.sponsor_session_version)) return null;
  if (item.existing_user_id && (Number(item.target_id)!==Number(item.existing_user_id) || Number(item.target_active)!==1 ||
      normalizeEmail(item.target_email)!==normalizeEmail(item.invite_email) || normalizeEmail(item.target_role)!==role ||
      Number(item.target_version)!==Number(item.existing_user_session_version))) return null;
  const requiresProfileCompletion=Number(item.profile_completion_required)===1;
  const value: unknown=item.fecha_ingreso;
  return { correo:item.invite_email, tipoCuenta:role,
    fechaIngreso:value instanceof Date ? value.toISOString().slice(0,10) : value ? String(value).slice(0,10) : null,
    diasVacaciones:requiresProfileCompletion?INITIAL_INVITATION_VACATION_DAYS:Number(item.dias_vacaciones_disponibles),
    requiresProfileCompletion, existingAccount:Boolean(item.existing_user_id),
    perfil:{nombre:item.nombre||'',apellido:item.apellido||'',telefono:item.telefono||'',direccion:item.direccion||''} };
}

export async function cancelPendingInvitation(sponsorId: number, sponsorVersion: number, invitationId: string): Promise<'ok' | 'invalid' | 'sponsor_invalid'> {
  if (!HEX_64.test(invitationId)) return 'invalid';
  const [rows] = await pool.query('SELECT invite_email FROM admin_invitations WHERE invitation_id=? LIMIT 1', [invitationId]);
  const email=normalizeEmail((rows as any[])[0]?.invite_email);
  if (!email) return 'invalid';
  const conn=await pool.getConnection();let lock: string | null=null;
  try {
    lock=await acquireEmailLock(conn,email);await conn.beginTransaction();
    const sponsor=await lockSponsor(conn,sponsorId);
    if (!isEligibleSponsor(sponsor) || Number(sponsor?.session_version)!==sponsorVersion) { await conn.commit();return 'sponsor_invalid'; }
    const [targets]=await conn.query(`SELECT invitation_id, invite_email, accepted_at, revoked_at, delivery_failed_at
      FROM admin_invitations WHERE invitation_id=? AND invite_email=? LIMIT 1 FOR UPDATE`,[invitationId,email]);
    const target=(targets as any[])[0];
    if (!target || target.accepted_at || (target.revoked_at && !target.delivery_failed_at)) { await conn.commit();return 'invalid'; }
    // Include older pending generations so canceling the latest row cannot uncover an older draft in the listing.
    const [changed]=await conn.query(`UPDATE admin_invitations SET revoked_at=COALESCE(revoked_at,NOW()), delivery_failed_at=NULL
      WHERE invite_email=? AND accepted_at IS NULL AND (revoked_at IS NULL OR delivery_failed_at IS NOT NULL)`,[email]);
    if (Number((changed as any).affectedRows)<1) throw new Error('No se confirmó la cancelación de la invitación');
    await conn.commit();return 'ok';
  } catch(error) { await conn.rollback();throw error; }
  finally { await releaseEmailLock(conn,lock);conn.release(); }
}
