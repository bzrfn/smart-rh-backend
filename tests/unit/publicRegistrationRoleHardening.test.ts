import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';

import {
  PUBLIC_REGISTRATION_ROLE_ID,
  resolvePublicRegistrationRoleId,
} from '../../src/modules/auth/publicRegistration.policy.js';


describe(
  'Public registration role hardening',
  () => {
    test(
      'el registro publico usa exclusivamente el rol empleado',
      () => {
        expect(
          PUBLIC_REGISTRATION_ROLE_ID
        ).toBe(
          2
        );
      }
    );


    test(
      'ignora una solicitud de rol admin',
      () => {
        expect(
          resolvePublicRegistrationRoleId(
            1
          )
        ).toBe(
          2
        );
      }
    );


    test(
      'ignora cualquier otro rol enviado por cliente',
      () => {
        expect(
          resolvePublicRegistrationRoleId(
            999
          )
        ).toBe(
          2
        );

        expect(
          resolvePublicRegistrationRoleId(
            undefined
          )
        ).toBe(
          2
        );

        expect(
          resolvePublicRegistrationRoleId(
            'admin'
          )
        ).toBe(
          2
        );
      }
    );


    test(
      'auth.service aplica la politica antes de crear el usuario',
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              'src/modules/auth/auth.service.ts'
            ),
            'utf8'
          );

        expect(
          source
        ).toContain(
          'resolvePublicRegistrationRoleId('
        );

        expect(
          source
        ).not.toContain(
          'rol_id: data.rol_id,'
        );
      }
    );
  }
);
