jest.mock('../../src/config/db.js', () => ({
  pool: {
    query: jest.fn(),
  },
}));

import fs from 'fs';
import path from 'path';
import { pool } from '../../src/config/db.js';
import {
  obtenerSugerenciasChatbot,
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

describe('Cambio #6 - Chatbot integral SMART RH', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('expone rutas protegidas con authJwt', () => {
    const routes = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/modules/chatbot/chatbot.routes.ts'
      ),
      'utf8'
    );

    expect(routes).toMatch(
      /chatbotRoutes\.get\(\s*['"]\/sugerencias['"]\s*,\s*authJwt\s*,\s*sugerenciasChatbotController\s*\)/
    );

    expect(routes).toMatch(
      /chatbotRoutes\.post\(\s*['"]\/mensaje['"]\s*,\s*authJwt\s*,\s*responderChatbotController\s*\)/
    );
  });

  it('registra el modulo chatbot en el router principal', () => {
    const index = fs.readFileSync(
      path.join(process.cwd(), 'src/routes/index.ts'),
      'utf8'
    );

    expect(index).toMatch(
      /router\.use\(\s*['"]\/chatbot['"]\s*,\s*chatbotRoutes\s*\)/
    );
  });

  it('conecta Max con datos vivos sin exponer conocimiento tecnico sensible', () => {
    const service = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/modules/chatbot/chatbot.service.ts'
      ),
      'utf8'
    );

    const controller = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/modules/chatbot/chatbot.controller.ts'
      ),
      'utf8'
    );

    const knowledge = fs.readFileSync(
      path.join(
        process.cwd(),
        'src/modules/chatbot/max.knowledge.ts'
      ),
      'utf8'
    );

    expect(knowledge).toMatch(/PROJECT_INTERNAL_KNOWLEDGE_LINES/);
    expect(knowledge).toMatch(/PROJECT_SAFE_OPERATIONAL_LINES/);
    expect(service).toMatch(/from '\.\/max\.intent\.js'/);
    expect(service).toMatch(/from '\.\/max\.entities\.js'/);
    expect(service).toMatch(/from '\.\/max\.context\.js'/);
    expect(service).toMatch(/findEmployeeCandidates/);
    expect(service).toMatch(/getEmployeeOperationalData/);
    expect(service).toMatch(/canQueryEmployeeData/);
    expect(controller).toMatch(/await responderChatbotConDatos/);
    expect(controller).toMatch(/usuarioId: auth\.usuarioId/);
  });

  it('responde consultas administrativas solo para rol admin', () => {
    const adminResponse = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje: 'donde administro usuarios y permisos',
    });

    expect(adminResponse.asistente).toBe('Max');
    expect(adminResponse.categoria).toBe('Usuarios y permisos');
    expect(adminResponse.requiere_escalamiento).toBe(false);

    const employeeResponse = responderChatbot({
      role: 'empleado',
      canal: 'web',
      mensaje: 'donde administro usuarios y permisos',
    });

    expect(employeeResponse.categoria).not.toBe('Usuarios y permisos');
    expect(employeeResponse.requiere_escalamiento).toBe(true);
  });

  it('marca escalamiento cuando no existe respuesta segura', () => {
    const response = responderChatbot({
      role: 'empleado',
      mensaje: 'necesito resolver algo que no esta en ningun modulo',
    });

    expect(response.requiere_escalamiento).toBe(true);
    expect(response.puede_crear_ticket).toBe(true);
    expect(response.preguntas_seguimiento.length).toBeGreaterThan(0);
  });

  it('mantiene sugerencias compactas para el widget flotante', () => {
    const suggestions = obtenerSugerenciasChatbot('empleado');

    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions.every((item) => item.length <= 24)).toBe(true);
    expect(suggestions).toContain('Tengo un problema');
  });

  it('responde como Max a una conversacion normal', () => {
    const response = responderChatbot({
      role: 'empleado',
      canal: 'mobile',
      mensaje: 'hola max',
    });

    expect(response.asistente).toBe('Max');
    expect(response.intent).toBe('saludo');
    expect(response.respuesta).toMatch(/soy Max/i);
    expect(response.respuesta).toMatch(/app movil/i);
    expect(response.preguntas_seguimiento.join(' ')).not.toMatch(/portal o app movil/i);
  });

  it('diagnostica problemas de acceso sin limitarse a mandar al modulo', () => {
    const response = responderChatbot({
      role: 'empleado',
      mensaje: 'me dice credenciales incorrectas en la app',
    });

    expect(response.categoria).toBe('Acceso');
    expect(response.intent).toBe('diagnostico');
    expect(response.confianza).not.toBe('baja');
    expect(response.pasos.join(' ')).toMatch(/api|correo|backend/i);
  });

  it('orienta a un admin para invitar un nuevo administrador', () => {
    const response = responderChatbot({
      role: 'admin',
      canal: 'web',
      mensaje:
        'NECESITO AGREGAR UN ADMINISTRADOR, ES DECIR ENVIARLE SU INVITACION, ME PODRIAS AYUDAR CON EL PROCESO POR FAVOR YA QUE NO PUEDO RECONOCER COMO HACERLO POR MI CUENTA',
    });

    expect(response.categoria).toBe('Usuarios y permisos');
    expect(response.intent).toBe('diagnostico');
    expect(response.respuesta).toMatch(/Usuarios y permisos/i);
    expect(response.respuesta).toMatch(/rol admin/i);
    expect(response.respuesta).not.toMatch(/brincar directo a soporte/i);
    expect(response.pasos.join(' ')).toMatch(/correo|invitacion|permisos/i);
    expect(response.pasos.join(' ')).not.toMatch(/portal o app movil/i);
    expect(response.preguntas_seguimiento.join(' ')).not.toMatch(/portal o app movil/i);
    expect(response.puede_crear_ticket).toBe(false);
    expect(response.acciones.some((action) => action.target === '/portal/usuarios')).toBe(true);
  });

  it('mantiene el contexto web en seguimiento de invitacion admin', () => {
    const response = responderChatbot({
      role: 'admin',
      canal: 'web',
      historial: [
        {
          author: 'user',
          text: 'necesito agregar un administrador y enviarle su invitacion',
        },
      ],
      mensaje: 'Estoy en portal web, necesito enviarle inivtacion a un nuevo admin',
    });

    expect(response.categoria).toBe('Usuarios y permisos');
    expect(response.respuesta).toMatch(/portal web/i);
    expect(response.pasos.join(' ')).toMatch(/Usuarios y permisos|correo|rol admin/i);
    expect(response.pasos.join(' ')).not.toMatch(/Indica si ocurrio/i);
    expect(response.puede_crear_ticket).toBe(false);
  });

  it('explica su aprendizaje contextual sin mandar directo a un modulo', () => {
    const response = responderChatbot({
      role: 'empleado',
      mensaje: 'puedes aprender del contexto de la conversacion?',
    });

    expect(response.intent).toBe('aprendizaje_contextual');
    expect(response.respuesta).toMatch(/contexto reciente/i);
    expect(response.acciones).toHaveLength(0);
  });

  it('prioriza el contexto movil sin preguntar si fue portal o app', () => {
    const response = responderChatbot({
      role: 'empleado',
      canal: 'mobile',
      mensaje: 'estoy tratando de crear mi periodo de vacaciones pero no le entiendo al apartado',
    });

    expect(response.categoria).toBe('Vacaciones');
    expect(response.respuesta).toMatch(/app movil/i);
    expect(response.pasos.join(' ')).not.toMatch(/portal o app movil/i);
  });

  it('deja el ticket como ultima salida cuando falta contexto', () => {
    const response = responderChatbot({
      role: 'empleado',
      canal: 'mobile',
      mensaje: 'algo se siente raro y no se que hacer',
    });

    expect(response.confianza).toBe('baja');
    expect(response.respuesta).toMatch(/Primero lo resolvemos|despues no queda solucionado/i);
    expect(response.puede_crear_ticket).toBe(true);
  });

  it('no expone rutas tecnicas ni stack en respuestas operativas de proyecto', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      mensaje: 'que sabes del proyecto y sus modulos',
    });

    expect(response.categoria).toBe('Conocimiento del proyecto');
    expect(response.pasos.join(' ')).not.toMatch(/\/auth|\/users|Node\.js|Express|MySQL|JWT|MongoDB/i);
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
    expect(response.pasos.join(' ')).toMatch(/ID 21|brandon\.bernal/i);
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
