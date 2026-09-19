import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';


describe(
  'Admin invitation users boundary',
  () => {
    const usersService =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/users/users.service.ts'
        ),
        'utf8'
      );

    const emailSource =
      readFileSync(
        resolve(
          process.cwd(),
          'src/modules/auth/adminInvite.email.ts'
        ),
        'utf8'
      );


    test(
      'POST users no puede crear administradores',
      () => {
        const start =
          usersService.indexOf(
            'export async function addUser'
          );

        const end =
          usersService.indexOf(
            'export async function editUser',
            start
          );

        const block =
          usersService.slice(
            start,
            end
          );


        expect(
          block
        ).toContain(
          'findRoleNameById'
        );

        expect(
          block
        ).toContain(
          'isAdminRole'
        );

        expect(
          block
        ).toContain(
          'únicamente mediante invitación'
        );

        expect(
          block.indexOf(
            'únicamente mediante invitación'
          )
        ).toBeLessThan(
          block.indexOf(
            'hashPassword'
          )
        );
      }
    );


    test(
      'PUT users no puede promocionar empleado a admin',
      () => {
        const start =
          usersService.indexOf(
            'export async function editUser'
          );

        const end =
          usersService.indexOf(
            'export async function toggleUser',
            start
          );

        const block =
          usersService.slice(
            start,
            end
          );


        expect(
          block
        ).toContain(
          'exists.rol_id'
        );

        expect(
          block
        ).toContain(
          'data.rol_id'
        );

        expect(
          block
        ).not.toContain(
          'exists.rol_nombre'
        );

        expect(
          block
        ).toContain(
          'isAdminRole'
        );

        expect(
          block
        ).toContain(
          'promoción a administrador requiere una invitación'
        );
      }
    );


    test(
      'correo de invitacion escapa valores HTML',
      () => {
        expect(
          emailSource
        ).toContain(
          'function escapeHtml('
        );

        expect(
          emailSource
        ).toContain(
          '${escapeHtml(nombre)}'
        );

        expect(
          emailSource
        ).toContain(
          'href="${escapeHtml(acceptUrl)}"'
        );
      }
    );
  }
);
