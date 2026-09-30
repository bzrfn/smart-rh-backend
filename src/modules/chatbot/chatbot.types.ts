export type ChatbotRole = 'admin' | 'empleado' | 'usuario' | 'tecnico';

export type ChatbotAction = {
  label: string;
  target: string;
  scope: 'web' | 'mobile' | 'both';
};

export type ChatbotKnowledgeEntry = {
  id: string;
  categoria: string;
  titulo: string;
  roles: Array<ChatbotRole | 'all'>;
  keywords: string[];
  respuesta: string;
  acciones: ChatbotAction[];
};

export type ChatbotResponse = {
  categoria: string;
  titulo: string;
  respuesta: string;
  acciones: ChatbotAction[];
  sugerencias: string[];
  requiere_escalamiento: boolean;
  puede_crear_ticket: boolean;
};
