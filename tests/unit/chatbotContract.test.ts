import fs from 'fs';
import path from 'path';
import {
  responderChatbot,
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

    expect(adminResponse.categoria).toBe('Usuarios y permisos');
    expect(adminResponse.requiere_escalamiento).toBe(false);

    const employeeResponse = responderChatbot({
      role: 'empleado',
      mensaje: 'donde administro usuarios y permisos',
    });

    expect(employeeResponse.categoria).not.toBe('Usuarios y permisos');
  });

  it('marca escalamiento cuando no existe respuesta segura', () => {
    const response = responderChatbot({
      role: 'empleado',
      mensaje: 'necesito resolver algo que no esta en ningun modulo',
    });

    expect(response.requiere_escalamiento).toBe(true);
    expect(response.puede_crear_ticket).toBe(true);
  });
});
