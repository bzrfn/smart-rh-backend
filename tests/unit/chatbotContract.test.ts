import fs from 'fs';
import path from 'path';
import {
  obtenerSugerenciasChatbot,
  responderChatbot,
  responderChatbotConDatos,
} from '../../src/modules/chatbot/chatbot.service.js';

describe('Cambio #6 - Chatbot integral SMART RH', () => {
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

  it('responde consultas administrativas solo para rol admin', () => {
    const adminResponse = responderChatbot({
      role: 'admin',
      mensaje: 'donde administro usuarios y permisos',
    });

    expect(adminResponse.asistente).toBe('Max');
    expect(adminResponse.categoria).toBe('Usuarios y permisos');
    expect(adminResponse.requiere_escalamiento).toBe(false);
    expect(adminResponse.pasos.length).toBeGreaterThan(0);

    const employeeResponse = responderChatbot({
      role: 'empleado',
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

  it('responde como Max a una conversacion normal', () => {
    const response = responderChatbot({
      role: 'empleado',
      mensaje: 'hola max',
    });

    expect(response.asistente).toBe('Max');
    expect(response.intent).toBe('saludo');
    expect(response.respuesta).toMatch(/soy Max/i);
    expect(response.respuesta).not.toMatch(/^Claro/i);
    expect(response.pasos).toHaveLength(0);
    expect(response.preguntas_seguimiento.length).toBeGreaterThan(0);
  });

  it('saluda con contexto de app movil sin preguntar el canal', () => {
    const response = responderChatbot({
      role: 'empleado',
      canal: 'mobile',
      mensaje: 'hola max',
    });

    expect(response.intent).toBe('saludo');
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
      mensaje: 'necesito agregar y mandar invitacion a un nuevo administrador',
    });

    expect(response.categoria).toBe('Usuarios y permisos');
    expect(response.intent).toBe('orientacion');
    expect(response.respuesta).toMatch(/Usuarios y permisos/i);
    expect(response.respuesta).toMatch(/rol admin/i);
    expect(response.pasos.join(' ')).toMatch(/correo|invitacion|CRUD/i);
    expect(response.acciones.some((action) => action.target === '/portal/usuarios')).toBe(true);
  });

  it('mantiene sugerencias compactas para el widget flotante', () => {
    const suggestions = obtenerSugerenciasChatbot('empleado');

    expect(suggestions.length).toBeGreaterThanOrEqual(3);
    expect(suggestions.every((item) => item.length <= 24)).toBe(true);
    expect(suggestions).toContain('Tengo un problema');
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


  it('conecta Max con conocimiento del proyecto y datos vivos con control de rol', () => {
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

    expect(service).toMatch(/PROJECT_INTERNAL_KNOWLEDGE_LINES/);
    expect(service).toMatch(/PROJECT_SAFE_OPERATIONAL_LINES/);
    expect(service).toMatch(/findEmployeeCandidates/);
    expect(service).toMatch(/getEmployeeOperationalData/);
    expect(service).toMatch(/contratos/);
    expect(service).toMatch(/nominas/);
    expect(service).toMatch(/vacaciones/);
    expect(service).toMatch(/asistencias/);
    expect(service).toMatch(/incapacidades/);
    expect(service).toMatch(/role !== 'admin'/);
    expect(service).not.toMatch(/u\.contrasena|password_hash|contrasena_hash/);
    expect(service).not.toMatch(/SELECT[\s\S]{0,500}qr_token[\s\S]{0,500}FROM asistencias/);
    expect(controller).toMatch(/await responderChatbotConDatos/);
    expect(controller).toMatch(/usuarioId: auth\.usuarioId/);
  });


  it('no expone rutas tecnicas ni stack en respuestas operativas', async () => {
    const response = await responderChatbotConDatos({
      role: 'empleado',
      canal: 'web',
      usuarioId: 1,
      mensaje: 'que rutas y endpoints tiene el proyecto',
    });

    const visible = [
      response.respuesta,
      ...(response.pasos || []),
      ...(response.preguntas_seguimiento || []),
    ].join(' ');

    expect(visible).not.toMatch(/\/auth|\/users|\/roles|\/incapacidades|Node\.js|Express|TypeScript|MySQL|MongoDB|JWT/i);
    expect(visible).toMatch(/modulo|Usuarios|Asistencia|Incapacidades|permisos/i);
  });

  it('responde incapacidades pendientes como flujo operativo y no como mapa tecnico', async () => {
    const response = await responderChatbotConDatos({
      role: 'admin',
      canal: 'web',
      usuarioId: 1,
      mensaje: 'Como puedo revisar las incapacidades pendientes de un empleado?',
    });

    const visible = [
      response.respuesta,
      ...(response.pasos || []),
      ...(response.preguntas_seguimiento || []),
    ].join(' ');

    expect(response.categoria).toBe('Incapacidades');
    expect(visible).toMatch(/incapacidad|empleado|adjunto|aprobar|rechazar|revision/i);
    expect(visible).not.toMatch(/\/auth|\/users|Node\.js|Express|TypeScript|MySQL|MongoDB|JWT/i);
  });

});
