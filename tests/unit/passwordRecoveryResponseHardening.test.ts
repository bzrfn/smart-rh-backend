import {
  readFileSync,
} from 'node:fs';

import {
  join,
} from 'node:path';


function getForgotPasswordBlock():
string {
  const source =
    readFileSync(
      join(
        process.cwd(),
        'src/modules/auth/auth.service.ts'
      ),
      'utf8'
    );

  const start =
    source.indexOf(
      'export async function forgotPassword'
    );

  const end =
    source.indexOf(
      'export async function resetPassword',
      start
    );

  if (
    start < 0 ||
    end <= start
  ) {
    throw new Error(
      'No se pudo localizar forgotPassword'
    );
  }

  return source.slice(
    start,
    end
  );
}


describe(
  'Password recovery response hardening',
  () => {
    test(
      'forgotPassword no devuelve resetToken por HTTP',
      () => {
        const block =
          getForgotPasswordBlock();

        expect(
          block
        ).not.toContain(
          'resetToken:'
        );
      }
    );


    test(
      'correo inexistente no produce 404 explicito',
      () => {
        const block =
          getForgotPasswordBlock();

        expect(
          block
        ).not.toContain(
          "throw new AppError('No existe una cuenta con ese correo', 404)"
        );
      }
    );


    test(
      'usa mensaje publico neutral',
      () => {
        const block =
          getForgotPasswordBlock();

        expect(
          block
        ).toContain(
          'Si existe una cuenta asociada a ese correo'
        );

        const responses =
          block.match(
            /message:\s*publicMessage/g
          ) || [];

        expect(
          responses.length
        ).toBe(
          2
        );
      }
    );


    test(
      'el codigo real solamente se utiliza para el correo',
      () => {
        const block =
          getForgotPasswordBlock();

        expect(
          block
        ).toContain(
          'codigo: reset.token'
        );

        expect(
          block
        ).not.toContain(
          'message: reset.token'
        );
      }
    );


    test(
      'resetPassword conserva consumo del codigo',
      () => {
        const source =
          readFileSync(
            join(
              process.cwd(),
              'src/modules/auth/auth.service.ts'
            ),
            'utf8'
          );

        const start =
          source.indexOf(
            'export async function resetPassword'
          );

        const block =
          source.slice(
            start,
            start + 1800
          );

        expect(
          block
        ).toContain(
          'consumeResetToken(token)'
        );
      }
    );
  }
);
