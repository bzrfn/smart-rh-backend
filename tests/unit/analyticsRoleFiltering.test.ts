import {
  isAnalyticsEmployee,
} from '../../src/modules/analytics/analytics.repository.js';

describe(
  'Analytics role filtering',
  () => {
    test(
      'excluye admin aunque su rol_id no sea 1',
      () => {
        expect(
          isAnalyticsEmployee({
            id: 10,
            activo: 1,
            rol_id: 99,
            rol_nombre: 'Admin',
          })
        ).toBe(false);
      }
    );

    test(
      'excluye variante administrador',
      () => {
        expect(
          isAnalyticsEmployee({
            id: 11,
            activo: 1,
            rol_id: 7,
            rol_nombre: 'Administrador',
          })
        ).toBe(false);
      }
    );

    test(
      'incluye empleado aunque su rol_id sea 1',
      () => {
        expect(
          isAnalyticsEmployee({
            id: 12,
            activo: 1,
            rol_id: 1,
            rol_nombre: 'Empleado',
          })
        ).toBe(true);
      }
    );

    test(
      'mantiene incluido otro perfil laboral activo',
      () => {
        expect(
          isAnalyticsEmployee({
            id: 13,
            activo: 1,
            rol_id: 8,
            rol_nombre: 'Tecnico',
          })
        ).toBe(true);
      }
    );

    test(
      'excluye usuario inactivo',
      () => {
        expect(
          isAnalyticsEmployee({
            id: 14,
            activo: 0,
            rol_id: 2,
            rol_nombre: 'Empleado',
          })
        ).toBe(false);
      }
    );
  }
);
