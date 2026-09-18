import {
  validateActiveValue,
  validateCreateUserPayload,
  validateUserId,
  validateVacationDays,
} from '../../src/modules/users/users.validation.js';

import {
  validatePermissionsPayload,
} from '../../src/modules/permisos/permisos.service.js';

import {
  canAccessModule,
  requireModule,
} from '../../src/middlewares/requireModule.js';

import {
  resolveAuthContext,
} from '../../src/middlewares/authJwt.js';

describe(
  'Users and permissions hardening',
  () => {
    test(
      'normaliza correo al crear usuario',
      () => {
        const result =
          validateCreateUserPayload({
            nombre: ' Brandon ',
            apellido: ' Bernal ',
            correo:
              ' Brandon@Example.COM ',
            contrasena:
              'Password123!',
            rol_id: 2,
            telefono: null,
            direccion: null,
            fecha_ingreso:
              '2026-09-18',
            dias_vacaciones_disponibles:
              12,
          });

        expect(
          result.correo
        ).toBe(
          'brandon@example.com'
        );

        expect(
          result.nombre
        ).toBe(
          'Brandon'
        );
      }
    );

    test(
      'rechaza contraseña menor a 8 caracteres',
      () => {
        expect(() =>
          validateCreateUserPayload({
            nombre: 'A',
            apellido: 'B',
            correo:
              'a@example.com',
            contrasena:
              '1234567',
            rol_id: 2,
          })
        ).toThrow(
          'La contraseña debe tener entre 8 y 128 caracteres'
        );
      }
    );

    test(
      'rechaza correo inválido',
      () => {
        expect(() =>
          validateCreateUserPayload({
            nombre: 'A',
            apellido: 'B',
            correo:
              'correo-invalido',
            contrasena:
              'Password123!',
            rol_id: 2,
          })
        ).toThrow(
          'Correo inválido'
        );
      }
    );

    test(
      'rechaza id de usuario inválido',
      () => {
        expect(() =>
          validateUserId(
            'abc'
          )
        ).toThrow(
          'ID de usuario inválido'
        );
      }
    );

    test(
      'rechaza vacaciones negativas',
      () => {
        expect(() =>
          validateVacationDays(
            -1
          )
        ).toThrow(
          'Los días de vacaciones'
        );
      }
    );

    test(
      'rechaza string false como booleano activo',
      () => {
        expect(() =>
          validateActiveValue(
            'false'
          )
        ).toThrow(
          'El campo activo debe ser booleano'
        );
      }
    );

    test(
      'acepta false booleano correctamente',
      () => {
        expect(
          validateActiveValue(
            false
          )
        ).toBe(false);
      }
    );

    test(
      'rechaza módulos desconocidos',
      () => {
        expect(() =>
          validatePermissionsPayload({
            asistencia: true,
            inventado: true,
          })
        ).toThrow(
          'Módulo no permitido'
        );
      }
    );

    test(
      'rechaza valores de permiso no booleanos',
      () => {
        expect(() =>
          validatePermissionsPayload({
            asistencia: 'true',
          })
        ).toThrow(
          'debe ser booleano'
        );
      }
    );

    test(
      'acepta los cuatro módulos permitidos',
      () => {
        expect(
          validatePermissionsPayload({
            asistencia: true,
            contratos: false,
            nomina: true,
            vacaciones: false,
          })
        ).toEqual({
          asistencia: true,
          contratos: false,
          nomina: true,
          vacaciones: false,
        });
      }
    );

    test(
      'admin siempre tiene bypass de módulo',
      () => {
        expect(
          canAccessModule(
            'admin',
            false
          )
        ).toBe(true);
      }
    );

    test(
      'empleado sin módulo queda bloqueado',
      () => {
        expect(
          canAccessModule(
            'empleado',
            false
          )
        ).toBe(false);
      }
    );

    test(
      'empleado con módulo puede acceder',
      () => {
        expect(
          canAccessModule(
            'empleado',
            true
          )
        ).toBe(true);
      }
    );

    test(
      'requireModule devuelve 401 sin auth',
      async () => {
        const next =
          jest.fn();

        await requireModule(
          'asistencia'
        )(
          {
            auth: undefined,
          } as any,
          {} as any,
          next
        );

        expect(
          next
        ).toHaveBeenCalledTimes(
          1
        );

        expect(
          next.mock.calls[0][0]
            .statusCode
        ).toBe(401);
      }
    );

    test(
      'requireModule permite admin sin consultar permisos',
      async () => {
        const next =
          jest.fn();

        await requireModule(
          'asistencia'
        )(
          {
            auth: {
              userId: 1,
              role: 'admin',
            },
          } as any,
          {} as any,
          next
        );

        expect(
          next
        ).toHaveBeenCalledWith();
      }
    );

    test(
      'auth rechaza usuario desactivado aunque JWT sea válido',
      () => {
        expect(() =>
          resolveAuthContext(
            {
              userId: 10,
              role: 'empleado',
            },
            {
              id: 10,
              activo: 0,
              role: 'empleado',
            }
          )
        ).toThrow(
          'Usuario inactivo'
        );
      }
    );

    test(
      'auth usa rol actual de base y no rol antiguo del JWT',
      () => {
        expect(
          resolveAuthContext(
            {
              userId: 10,
              role: 'admin',
            },
            {
              id: 10,
              activo: 1,
              role: 'empleado',
            }
          )
        ).toEqual({
          userId: 10,
          role: 'empleado',
        });
      }
    );
  }
);
