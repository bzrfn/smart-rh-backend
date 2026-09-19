import {
  existsSync,
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


function read(
  relativePath: string
):
string {
  return readFileSync(
    join(
      process.cwd(),
      relativePath
    ),
    'utf8'
  );
}


describe(
  'Password recovery response hardening',
  () => {
    test(
      'respuesta publica no expone secretos',
      () => {
        const source =
          read(
            'src/modules/auth/passwordRecovery.service.ts'
          );

        const start =
          source.indexOf(
            'function neutralRequestResponse'
          );

        const end =
          source.indexOf(
            'async function safeEvent',
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
          'PASSWORD_RECOVERY_PUBLIC_MESSAGE'
        );

        expect(
          block
        ).not.toContain(
          'resetToken'
        );

        expect(
          block
        ).not.toContain(
          'challengeId'
        );

        expect(
          block
        ).not.toContain(
          'codeHmac'
        );

        expect(
          block
        ).not.toContain(
          'codigo:'
        );
      }
    );


    test(
      'auth service usa recovery persistente',
      () => {
        const source =
          read(
            'src/modules/auth/auth.service.ts'
          );

        expect(
          source
        ).toContain(
          'requestPasswordRecovery('
        );

        expect(
          source
        ).toContain(
          'completePasswordRecovery('
        );

        expect(
          source
        ).not.toContain(
          'createResetToken'
        );

        expect(
          source
        ).not.toContain(
          'consumeResetToken'
        );

        expect(
          source
        ).not.toContain(
          'auth.reset.store'
        );
      }
    );


    test(
      'store temporal fue retirado',
      () => {
        expect(
          existsSync(
            join(
              process.cwd(),
              'src/modules/auth/auth.reset.store.ts'
            )
          )
        ).toBe(
          false
        );
      }
    );


    test(
      'controller usa nuevo contrato',
      () => {
        const source =
          read(
            'src/modules/auth/auth.controller.ts'
          );

        expect(
          source
        ).toContain(
          'forgotPassword(correo, req.ip)'
        );

        expect(
          source
        ).toContain(
          'resetPassword(correo, codigo, nuevaContrasena)'
        );

        expect(
          source
        ).not.toContain(
          'resetPassword(token, nuevaContrasena)'
        );
      }
    );


    test(
      'validator usa correo codigo y password',
      () => {
        const source =
          read(
            'src/validators/authValidators.ts'
          );

        const start =
          source.indexOf(
            'export function validateResetPassword'
          );

        expect(
          start
        ).toBeGreaterThanOrEqual(
          0
        );

        const block =
          source.slice(
            start
          );

        expect(
          block
        ).toContain(
          'body?.correo'
        );

        expect(
          block
        ).toContain(
          'body?.codigo'
        );

        expect(
          block
        ).toContain(
          'nuevaContrasena'
        );

        expect(
          block
        ).toContain(
          '/^\\d{6}$/'
        );

        expect(
          block
        ).not.toContain(
          'body?.token'
        );
      }
    );
  }
);
