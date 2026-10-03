jest.mock('../../src/config/db.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../src/config/db.js';
import {
  responderChatbotConDatos,
} from '../../src/modules/chatbot/chatbot.service.js';

const mockedQuery = pool.query as jest.Mock;

function mockEmployeeData() {
  mockedQuery
    .mockResolvedValueOnce([
      [
        {
          id: 21,
          nombre: 'Brandon',
          apellido: 'Bernal',
          correo: 'brandon.bernal@smart-rh.test',
          telefono: '5550001111',
          direccion: 'No visible',
          fecha_ingreso: '2026-01-15',
          dias_vacaciones_disponibles: 9,
          activo: 1,
          created_at: '2026-01-15',
          updated_at: '2026-01-15',
          foto_perfil_url: null,
          credencial_url: null,
          role: 'admin',
        },
      ],
    ])
    .mockResolvedValueOnce([[{ modulo: 'usuarios', habilitado: 1 }]])
    .mockResolvedValueOnce([
      [
        {
          id: 7,
          tipo_contrato: 'Indeterminado',
          salario_base: 15000,
          fecha_inicio: '2026-01-15',
          fecha_fin: null,
          estado: 'activo',
          contrato_pdf_url: null,
        },
      ],
    ])
    .mockResolvedValueOnce([
      [
        {
          id: 9,
          salario_base: 15000,
          deducciones: 0,
          bonos: 0,
          total: 15000,
          estado: 'pagada',
          periodo_inicio: '2026-09-01',
          periodo_fin: '2026-09-15',
        },
      ],
    ])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([[]])
    .mockResolvedValueOnce([[]]);
}

describe('Max intelligence core', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('no expone rutas tecnicas ni stack en respuestas operativas de proyecto', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      mensaje: 'que sabes del proyecto y sus modulos',
    });

    expect(response.categoria).toBe('Conocimiento del proyecto');
    expect(response.pasos.join(' ')).not.toMatch(
      new RegExp('(/auth|/users|Node\\.js|Express|MySQL|JWT|MongoDB)', 'i')
    );
    expect(response.pasos.join(' ')).toMatch(/Usuarios y permisos|Incapacidades|Asistencia/i);
  });

  it.each([
    ['Quiero agregar un usuario y asignarle permisos, ¿dónde entro?', 'Usuarios y permisos'],
    ['¿Cómo reviso incapacidades pendientes de un empleado?', 'Incapacidades'],
    ['¿Cómo apruebo o rechazo una incapacidad desde el portal?', 'Incapacidades'],
    ['¿Cómo puedo revisar los pendientes de asistencia?', 'Asistencia administrativa'],
    ['Un empleado dice que no le aparece su incapacidad, ¿qué reviso primero?', 'Incapacidades'],
    ['Necesito ver la información de un empleado antes de aprobar una incapacidad.', 'Incapacidades'],
    ['¿Cómo cambio los permisos de un usuario sin afectar su cuenta?', 'Usuarios y permisos'],
    ['¿Cómo reviso si un empleado ya tiene contrato cargado?', 'Credencial y documentos'],
    ['¿Cómo puedo validar una credencial desde el portal?', 'Credencial y documentos'],
  ])(
    'prioriza proceso operativo antes de busqueda de empleado: %s',
    async (mensaje, categoria) => {
      const response = await responderChatbotConDatos({
        role: 'admin',
        canal: 'web',
        usuarioId: 1,
        mensaje,
      });

      expect(response.categoria).toBe(categoria);
      expect(response.categoria).not.toBe('Datos de empleado');
      expect(response.respuesta).not.toMatch(/No encontre un empleado/i);
      expect(response.pasos.join(' ')).not.toMatch(/ID, correo o nombre completo tal como esta registrado/i);
      expect(mockedQuery).not.toHaveBeenCalled();
    }
  );

  it('busca empleados por nombre completo cuando la intencion es explicita', async () => {
    mockEmployeeData();

    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      mensaje: 'busca a Brandon Bernal',
    });

    expect(response.categoria).toBe('Datos de empleado');
    expect(response.intent).toBe('consulta_empleado');
    expect(response.respuesta).toMatch(/Brandon Bernal/i);
    expect(response.pasos.join(' ')).toMatch(/ID 21|brandon\\.bernal/i);
    expect(mockedQuery.mock.calls[0][1]).toEqual(['%brandon bernal%']);
  });

  it('usa continuidad conversacional para resolver id 21 como busqueda de empleado', async () => {
    mockEmployeeData();

    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'user',
          text: 'busca a Brandon Bernal',
        },
      ],
      mensaje: 'id 21',
    });

    expect(response.categoria).toBe('Datos de empleado');
    expect(response.intent).toBe('consulta_empleado');
    expect(response.categoria).not.toBe('Acceso');
    expect(response.respuesta).not.toMatch(/credenciales incorrectas|backend sea el ambiente/i);
    expect(mockedQuery.mock.calls[0][1]).toEqual([21]);
  });
});
