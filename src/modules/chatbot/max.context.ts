import type { ChatbotMessageContext } from './chatbot.types.js';
import { isOperationalFlowIntent } from './max.intent.js';

function compactText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildMaxContextMessage(
  message: string,
  historial?: ChatbotMessageContext[]
) {
  const recentContext = (historial || [])
    .slice(-4)
    .map((item) => item.text)
    .filter(Boolean)
    .map(compactText)
    .join(' ');

  return compactText([recentContext, message].filter(Boolean).join(' '));
}

function isEmployeeLookupContinuation(message: string) {
  return (
    /^(?:id\s*#?\s*)?\d{1,8}$/.test(message) ||
    /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(message) ||
    /^(?:su\s+)?correo\s+(?:es|seria|sería)\s+[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(message) ||
    /^(?:el\s+)?id\s+(?:es|seria|sería)\s*\d{1,8}$/.test(message)
  );
}

export function buildMaxIntentMessage(
  message: string,
  historial?: ChatbotMessageContext[]
) {
  const currentMessage = compactText(message);

  if (!historial?.length) {
    return currentMessage;
  }

  if (isOperationalFlowIntent(currentMessage)) {
    return currentMessage;
  }

  if (!isEmployeeLookupContinuation(currentMessage)) {
    return currentMessage;
  }

  return buildMaxContextMessage(message, historial);
}
