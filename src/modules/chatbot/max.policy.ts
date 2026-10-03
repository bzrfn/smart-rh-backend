import type { ChatbotRole } from './chatbot.types.js';

export function canQueryEmployeeData(role: ChatbotRole, actorUserId?: number | null) {
  if (!Number.isInteger(Number(actorUserId)) || Number(actorUserId) <= 0) {
    return false;
  }

  return ['admin', 'empleado', 'usuario', 'tecnico'].includes(role);
}

export function shouldRestrictToSelf(role: ChatbotRole) {
  return role !== 'admin';
}
