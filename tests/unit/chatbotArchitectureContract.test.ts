import fs from 'fs';
import path from 'path';
import {
  PROJECT_SAFE_OPERATIONAL_LINES,
} from '../../src/modules/chatbot/max.knowledge.js';
import {
  containsTechnicalLeak,
} from '../../src/modules/chatbot/max.security.js';
import {
  MAX_TRAINING_CASES,
} from '../../src/modules/chatbot/max.training-cases.js';
import {
  MAX_PROJECT_FLOWS,
} from '../../src/modules/chatbot/max.project-flows.js';

describe('Max modular intelligence architecture', () => {
  const chatbotDir = path.join(process.cwd(), 'src/modules/chatbot');

  it('mantiene el nucleo de Max separado por responsabilidad', () => {
    const expectedFiles = [
      'max.intent.ts',
      'max.context.ts',
      'max.entities.ts',
      'max.policy.ts',
      'max.response.ts',
      'max.knowledge.ts',
      'max.project-flows.ts',
      'max.employee-tools.ts',
      'max.ticket-tools.ts',
      'max.security.ts',
      'max.training-cases.ts',
    ];

    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(chatbotDir, file))).toBe(true);
    }
  });

  it('no publica conocimiento tecnico sensible en lineas operativas', () => {
    expect(PROJECT_SAFE_OPERATIONAL_LINES.length).toBeGreaterThanOrEqual(6);
    expect(
      PROJECT_SAFE_OPERATIONAL_LINES.every((line) => !containsTechnicalLeak(line))
    ).toBe(true);
  });

  it('cubre casos de entrenamiento operativos y de datos', () => {
    const prompts = MAX_TRAINING_CASES.map((item) => item.prompt).join(' ');

    expect(prompts).toMatch(/administrador|permisos/i);
    expect(prompts).toMatch(/incapacidades/i);
    expect(prompts).toMatch(/asistencia/i);
    expect(prompts).toMatch(/Brandon Bernal|id 21/i);
  });

  it('mantiene catalogo operativo amplio para Max v6', () => {
    const flowIds = MAX_PROJECT_FLOWS.map((flow) => flow.id);

    expect(MAX_PROJECT_FLOWS.length).toBeGreaterThanOrEqual(10);
    expect(flowIds).toEqual(
      expect.arrayContaining([
        'usuarios-admin',
        'incapacidades',
        'asistencia-admin',
        'asistencia-empleado',
        'credencial',
        'vacaciones',
        'nomina',
        'calendario',
        'terminal-admin',
      ])
    );
  });

  it('permite confirmar ticket desde continuidad conversacional', () => {
    const controller = fs.readFileSync(
      path.join(chatbotDir, 'chatbot.controller.ts'),
      'utf8'
    );

    expect(controller).toMatch(/isConfirmation/);
    expect(controller).toMatch(/recentTicketOffer/);
    expect(controller).toMatch(/crear ticket\|ticket con contexto/);
  });
});
