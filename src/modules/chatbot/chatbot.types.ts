export type ChatbotRole = 'admin' | 'empleado' | 'usuario' | 'tecnico';
export type ChatbotChannel = 'web' | 'mobile';

export type ChatbotAction = {
  label: string;
  target: string;
  scope: 'web' | 'mobile' | 'both';
};

export type ChatbotMessageContext = {
  author?: 'user' | 'assistant';
  text?: string;
};

export type ChatbotKnowledgeEntry = {
  id: string;
  categoria: string;
  titulo: string;
  roles: Array<ChatbotRole | 'all'>;
  keywords: string[];
  respuesta: string;
  pasos: string[];
  preguntas_seguimiento: string[];
  acciones: ChatbotAction[];
};

export type ChatbotResponse = {
  asistente: 'Max';
  categoria: string;
  titulo: string;
  intent: string;
  confianza: 'alta' | 'media' | 'baja';
  respuesta: string;
  pasos: string[];
  preguntas_seguimiento: string[];
  acciones: ChatbotAction[];
  sugerencias: string[];
  requiere_escalamiento: boolean;
  puede_crear_ticket: boolean;
};
