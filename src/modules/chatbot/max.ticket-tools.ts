import type { ChatbotResponse } from './chatbot.types.js';

export function buildMaxTicketDescription(message: string, response: ChatbotResponse) {
  return [
    'Consulta registrada desde Max, asistente interno SMART RH.',
    '',
    `Pregunta del usuario: ${message}`,
    '',
    `Categoria detectada: ${response.categoria}`,
    `Intencion: ${response.intent}`,
    `Confianza: ${response.confianza}`,
    '',
    `Respuesta entregada: ${response.respuesta}`,
  ].join('\n');
}
