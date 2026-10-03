import type { ChatbotRole } from './chatbot.types.js';
import type { EmployeeLookup } from './max.entities.js';
import { shouldRestrictToSelf } from './max.policy.js';

export function buildEmployeeWhereClause(
  lookup: EmployeeLookup,
  role: ChatbotRole,
  actorUserId: number
) {
  const params: unknown[] = [];

  if (shouldRestrictToSelf(role)) {
    params.push(actorUserId);
    return { where: 'u.id = ?', params };
  }

  if (lookup.id) {
    params.push(lookup.id);
    return { where: 'u.id = ?', params };
  }

  if (lookup.correo) {
    params.push(lookup.correo.toLowerCase());
    return { where: 'LOWER(u.correo) = ?', params };
  }

  if (lookup.nombre) {
    params.push(`%${lookup.nombre.toLowerCase()}%`);
    return {
      where: "LOWER(CONCAT_WS(' ', u.nombre, u.apellido, u.correo)) LIKE ?",
      params,
    };
  }

  params.push(actorUserId);
  return { where: 'u.id = ?', params };
}
