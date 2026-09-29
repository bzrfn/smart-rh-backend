import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Admin invitation repository hardening',
  () => {
    const source =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/auth/adminInvite.repository.ts'
        ),
        'utf8'
      );


    test(
      'serializa operaciones por correo',
      () => {
        expect(
          source
        ).toContain(
          'GET_LOCK'
        );

        expect(
          source
        ).toContain(
          'RELEASE_LOCK'
        );

        expect(
          source
        ).toContain(
          'buildEmailLockName'
        );
      }
    );


    test(
      'revalida sponsor admin activo verificado',
      () => {
        expect(
          source
        ).toContain(
          'isEligibleSponsor'
        );

        expect(
          source
        ).toContain(
          'email_verificado'
        );

        expect(
          source
        ).toContain(
          "'admin'"
        );

        expect(
          source
        ).toContain(
          'FOR UPDATE'
        );
      }
    );


    test(
      'emision esta ligada a session version del sponsor',
      () => {
        const start =
          source.indexOf(
            'export async function createAdminInvitation'
          );

        const end =
          source.indexOf(
            'export async function revokeAdminInvitation',
            start
          );

        const block =
          source.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'sponsorSessionVersion'
        );

        expect(
          block
        ).toContain(
          'sponsor.session_version'
        );

        expect(
          block
        ).toContain(
          "'sponsor_stale'"
        );
      }
    );


    test(
      'solo permite una invitacion activa por correo',
      () => {
        const start =
          source.indexOf(
            'export async function createAdminInvitation'
          );

        const end =
          source.indexOf(
            'export async function revokeAdminInvitation',
            start
          );

        const block =
          source.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'invite_email = ?'
        );

        expect(
          block
        ).toContain(
          'accepted_at IS NULL'
        );

        expect(
          block
        ).toContain(
          'revoked_at IS NULL'
        );

        expect(
          block
        ).toContain(
          "'active'"
        );
      }
    );


    test(
      'no invita correos que ya son usuarios',
      () => {
        expect(
          source
        ).toContain(
          "'user_exists'"
        );

        expect(
          source
        ).toContain(
          'FROM\n            usuarios'
        );
      }
    );


    test(
      'revocacion es exacta por invitacion y sponsor',
      () => {
        const start =
          source.indexOf(
            'export async function revokeAdminInvitation'
          );

        const end =
          source.indexOf(
            'export async function acceptAdminInvitation',
            start
          );

        const block =
          source.slice(
            start,
            end
          );

        expect(
          block
        ).toContain(
          'invitation_id = ?'
        );

        expect(
          block
        ).toContain(
          'sponsor_admin_id = ?'
        );

        expect(
          block
        ).toContain(
          'accepted_at IS NULL'
        );
      }
    );


    test(
      'aceptacion verifica HMAC y session version',
      () => {
        const start =
          source.indexOf(
            'export async function acceptAdminInvitation'
          );

        const block =
          source.slice(
            start
          );

        expect(
          block
        ).toContain(
          'safeEqualAdminInviteHmac'
        );

        expect(
          block
        ).toContain(
          'sponsor_session_version'
        );

        expect(
          block
        ).toContain(
          'sponsor.session_version'
        );
      }
    );


    test(
      'aceptacion crea admin verificado dentro de transaccion',
      () => {
        const start =
          source.indexOf(
            'export async function acceptAdminInvitation'
          );

        const block =
          source.slice(
            start
          );

        expect(
          block
        ).toContain(
          'beginTransaction'
        );

        expect(
          block
        ).toContain(
          'INSERT INTO usuarios'
        );

        expect(
          block
        ).toContain(
          'email_verificado'
        );

        expect(
          block
        ).toContain(
          'accepted_at = NOW()'
        );

        expect(
          block
        ).toContain(
          'accepted_user_id = ?'
        );

        expect(
          block
        ).toContain(
          'commit'
        );
      }
    );


    test(
      'rol admin se resuelve por nombre y no por ID fijo',
      () => {
        const start =
          source.indexOf(
            'export async function acceptAdminInvitation'
          );

        const block =
          source.slice(
            start
          );

        expect(
          block
        ).toContain(
          'FROM\n            roles'
        );

        expect(
          block
        ).toContain(
          "'admin'"
        );

        expect(
          block
        ).toContain(
          'adminRoleId'
        );
      }
    );


    test(
      'no persiste token de invitacion en claro',
      () => {
        expect(
          source
        ).toContain(
          'token_hmac'
        );

        expect(
          source
        ).not.toMatch(
          /\btoken\s+(?:CHAR|VARCHAR|TEXT|BINARY|VARBINARY)/i
        );
      }
    );
  }
);
