import type { ChatbotAction, ChatbotResponse, ChatbotRole } from './chatbot.types.js';

export function buildMaxResponse(data: {
  categoria: string;
  titulo: string;
  intent: string;
  confianza?: ChatbotResponse['confianza'];
  respuesta: string;
  pasos?: string[];
  preguntas_seguimiento?: string[];
  acciones?: ChatbotAction[];
  sugerencias?: string[];
  requiere_escalamiento?: boolean;
  puede_crear_ticket?: boolean;
  role?: ChatbotRole;
}): ChatbotResponse {
  return {
    asistente: 'Max',
    categoria: data.categoria,
    titulo: data.titulo,
    intent: data.intent,
    confianza: data.confianza || 'media',
    respuesta: data.respuesta,
    pasos: data.pasos || [],
    preguntas_seguimiento: data.preguntas_seguimiento || [],
    acciones: data.acciones || [],
    sugerencias: data.sugerencias || [],
    requiere_escalamiento: Boolean(data.requiere_escalamiento),
    puede_crear_ticket: Boolean(data.puede_crear_ticket),
  };
}
