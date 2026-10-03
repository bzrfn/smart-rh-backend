import type { ChatbotMessageContext } from './chatbot.types.js';

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
