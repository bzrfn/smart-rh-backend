jest.mock('../../src/config/db.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import { pool } from '../../src/config/db.js';
import {
  responderChatbot,
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

  it('usa continuidad conversacional para resolver correo despues de pedir un empleado', async () => {
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
      mensaje: 'su correo es brandon.bernal@smart-rh.test',
    });

    expect(response.categoria).toBe('Datos de empleado');
    expect(response.intent).toBe('consulta_empleado');
    expect(response.respuesta).toMatch(/Brandon Bernal/i);
    expect(mockedQuery.mock.calls[0][1]).toEqual(['brandon.bernal@smart-rh.test']);
  });

  it('cambia de tema despues de consultar un empleado y no repite expediente', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'user',
          text: 'su correo es brandon.bernal@smart-rh.test',
        },
        {
          author: 'assistant',
          text: 'Encontre el expediente de Brandon Bernal.',
        },
      ],
      mensaje: '¿Cómo cambio los permisos de un usuario sin afectar su cuenta?',
    });

    expect(response.categoria).toBe('Usuarios y permisos');
    expect(response.categoria).not.toBe('Datos de empleado');
    expect(response.respuesta).not.toMatch(/Encontre el expediente/i);
    expect(response.pasos.join(' ')).toMatch(/Usuarios y permisos|rol|modulos|permisos/i);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('cambia a flujo de incapacidades aunque el historial tenga datos de empleado', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'user',
          text: 'su correo es brandon.bernal@smart-rh.test',
        },
      ],
      mensaje: '¿Cómo reviso incapacidades pendientes de un empleado?',
    });

    expect(response.categoria).toBe('Incapacidades');
    expect(response.categoria).not.toBe('Datos de empleado');
    expect(response.respuesta).not.toMatch(/No encontre un empleado/i);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('no expone telefono ni direccion en resumen general de empleado', async () => {
    mockEmployeeData();

    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      mensaje: 'busca a Brandon Bernal',
    });

    const visibleText = [response.respuesta, ...response.pasos].join(' ');

    expect(response.categoria).toBe('Datos de empleado');
    expect(visibleText).toMatch(/Datos de contacto: ocultos/i);
    expect(visibleText).not.toMatch(/5550001111|telefono|direccion|No visible/i);
  });

  it('diferencia invitacion de administrador y cambio de permisos', () => {
    const inviteResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: 'Necesito invitar a un nuevo administrador, ¿cómo lo hago?',
    });

    const permissionsResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: '¿Cómo cambio los permisos de un usuario sin afectar su cuenta?',
    });

    expect(inviteResponse.categoria).toBe('Usuarios y permisos');
    expect(permissionsResponse.categoria).toBe('Usuarios y permisos');
    expect(inviteResponse.respuesta).toMatch(/invitar/i);
    expect(permissionsResponse.respuesta).toMatch(/cambiar permisos|ajusta rol y modulos/i);
    expect(inviteResponse.respuesta).not.toBe(permissionsResponse.respuesta);
  });

  it('no repite muletillas de interfaz cuando no hay incertidumbre visual', () => {
    const permissionsResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: '¿Cómo cambio los permisos de un usuario sin afectar su cuenta?',
    });

    const attendanceResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: '¿Cómo reviso pendientes de asistencia?',
    });

    const visibleText = [
      permissionsResponse.respuesta,
      attendanceResponse.respuesta,
    ].join(' ');

    expect(visibleText).not.toMatch(/Si algun boton aparece con otro nombre/i);
  });

  it('diferencia incapacidad no visible de aprobacion o rechazo', () => {
    const missingResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: 'Un empleado dice que no le aparece su incapacidad, ¿qué reviso primero?',
    });

    const reviewResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: '¿Cómo apruebo o rechazo una incapacidad desde el portal?',
    });

    expect(missingResponse.categoria).toBe('Incapacidades');
    expect(reviewResponse.categoria).toBe('Incapacidades');
    expect(missingResponse.respuesta).toMatch(/existe|asociada/i);
    expect(reviewResponse.respuesta).toMatch(/aprobar o rechazar/i);
    expect(missingResponse.pasos.join(' ')).not.toBe(reviewResponse.pasos.join(' '));
  });

  it('prepara ticket con contexto cuando el usuario no pudo resolver el flujo', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'user',
          text: '¿Cómo reviso pendientes de asistencia?',
        },
        {
          author: 'assistant',
          text: 'Revisa empleado, fecha, tipo de registro y evidencia.',
        },
      ],
      mensaje: 'No pude resolverlo, ¿puedes ayudarme a levantar un ticket con este contexto?',
    });

    expect(response.categoria).toBe('Soporte');
    expect(response.intent).toBe('preparar_ticket_contexto');
    expect(response.respuesta).not.toMatch(/Max usa el contexto reciente/i);
    expect(response.pasos.join(' ')).toMatch(/Modulo probable: Asistencia/i);
    expect(response.puede_crear_ticket).toBe(true);
  });

  it('prepara ticket con el ultimo modulo operativo cuando hubo varios temas', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'user',
          text: '¿Cómo reviso pendientes de asistencia?',
        },
        {
          author: 'assistant',
          text: 'Revisa empleado, fecha, tipo de registro y evidencia.',
        },
        {
          author: 'user',
          text: '¿Cómo valido una credencial desde el portal?',
        },
        {
          author: 'assistant',
          text: 'Usa el verificador administrativo de QR.',
        },
      ],
      mensaje: 'No pude resolverlo, ¿puedes ayudarme a levantar un ticket con este contexto?',
    });

    const visibleText = response.pasos.join(' ');

    expect(response.intent).toBe('preparar_ticket_contexto');
    expect(visibleText).toMatch(/Modulo probable: Credencial y documentos/i);
    expect(visibleText).toMatch(/Tambien se hablaron antes otros temas/i);
  });

  it('interpreta si como confirmacion de ticket cuando habia oferta previa', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'assistant',
          text: 'Quieres crear el ticket ahora? Crear ticket con contexto',
        },
      ],
      mensaje: 'si',
    });

    expect(response.categoria).toBe('Soporte');
    expect(response.intent).toBe('confirmacion_ticket_contexto');
    expect(response.puede_crear_ticket).toBe(true);
  });

  it('no vuelve a preparar ticket si el folio ya fue creado', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      historial: [
        {
          author: 'assistant',
          text: 'Listo. Cree el ticket con folio 6ac3e3c9b0f9047825cd714a. Puedes darle seguimiento desde Soporte.',
        },
      ],
      mensaje: 'si',
    });

    expect(response.intent).toBe('ticket_contexto_ya_creado');
    expect(response.puede_crear_ticket).toBe(false);
    expect(response.acciones).toHaveLength(0);
  });

});
