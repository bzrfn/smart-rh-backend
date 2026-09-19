import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Login 2FA repository hardening',
  () => {
    const source =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/auth/login2fa.repository.ts'
        ),
        'utf8'
      );


    test(
      'helper de elegibilidad exige admin activo y verificado',
      () => {
        const start =
          source.indexOf(
            'function isEligibleAdminRow'
          );

        const end =
          source.indexOf(
            'export async function findLatestActiveLogin2faChallenge',
            start
          );

        expect(
          start
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          end
        ).toBeGreaterThan(
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
          'row.activo'
        );

        expect(
          block
        ).toContain(
          'row.email_verificado'
        );

        expect(
          block
        ).toContain(
          'row.rol_nombre'
        );

        expect(
          block
        ).toContain(
          "'admin'"
        );
      }
    );


    test(
      'emision transaccional reutiliza helper de admin y bloquea usuario',
      () => {
        const start =
          source.indexOf(
            'export async function replaceLogin2faChallenge'
          );

        const end =
          source.indexOf(
            'export async function consumeLogin2faChallenge',
            start
          );

        const block =
          source.slice(
            start,
            end
          );

        expect(
          start
        ).toBeGreaterThanOrEqual(
          0
        );

        expect(
          end
        ).toBeGreaterThan(
          start
        );

        expect(
          block
        ).toContain(
          'beginTransaction()'
        );

        expect(
          block
        ).toContain(
          'FOR UPDATE'
        );

        expect(
          block
        ).toContain(
          'isEligibleAdminRow'
        );

        expect(
          block
        ).toContain(
          'session_version'
        );

        expect(
          block
        ).toContain(
          'expectedSessionVersion'
        );

        expect(
          block
        ).toContain(
          'commit()'
        );
      }
    );


    test(
      'emision invalida anteriores e inserta challenge nuevo',
      () => {
        const start =
          source.indexOf(
            'export async function replaceLogin2faChallenge'
          );

        const end =
          source.indexOf(
            'export async function consumeLogin2faChallenge',
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
          'AND used_at IS NULL'
        );

        expect(
          block
        ).toContain(
          'INSERT INTO login_2fa_challenges'
        );

        expect(
          block
        ).toContain(
          'code_hmac'
        );

        expect(
          block
        ).toContain(
          'request_ip_hash'
        );
      }
    );


    test(
      'consumo usa mismo orden usuario challenge y comparacion segura',
      () => {
        const start =
          source.indexOf(
            'export async function consumeLogin2faChallenge'
          );

        const block =
          source.slice(
            start
          );

        expect(
          block
        ).toContain(
          'beginTransaction()'
        );

        expect(
          block.match(
            /FOR UPDATE/g
          )?.length
        ).toBeGreaterThanOrEqual(
          3
        );

        expect(
          block
        ).toContain(
          'isEligibleAdminRow'
        );

        expect(
          block
        ).toContain(
          'safeEqualLogin2faHmac'
        );

        expect(
          block
        ).toContain(
          'session_version'
        );

        expect(
          block
        ).toContain(
          'latest.challenge_id'
        );
      }
    );


    test(
      'codigo incorrecto incrementa intentos',
      () => {
        const start =
          source.indexOf(
            'export async function consumeLogin2faChallenge'
          );

        const block =
          source.slice(
            start
          );

        expect(
          block
        ).toContain(
          'nextAttempts'
        );

        expect(
          block
        ).toContain(
          'attempts = ?'
        );

        expect(
          block
        ).toContain(
          'last_attempt_at'
        );

        expect(
          block
        ).toContain(
          'max_attempts'
        );
      }
    );


    test(
      'cleanup SMTP puede invalidar challenge exacto',
      () => {
        const start =
          source.indexOf(
            'export async function invalidateLogin2faChallenge'
          );

        const end =
          source.indexOf(
            'export async function replaceLogin2faChallenge',
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
          'challenge_id = ?'
        );

        expect(
          block
        ).toContain(
          'AND used_at IS NULL'
        );
      }
    );


    test(
      'rate checks existen por usuario e IP',
      () => {
        expect(
          source
        ).toContain(
          'countRecentLogin2faChallenges'
        );

        expect(
          source
        ).toContain(
          'countRecentLogin2faIpChallenges'
        );

        expect(
          source
        ).toContain(
          'maxPerUserWindow'
        );

        expect(
          source
        ).toContain(
          'maxPerIpWindow'
        );
      }
    );
  }
);
