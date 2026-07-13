export type HistorialAccesoEvento =
  | 'LOGIN_EXITOSO'
  | 'LOGIN_FALLIDO'
  | 'LOGOUT'
  | 'SESION_EXPIRADA';

export type RegistrarHistorialAccesoInput = {
  usuario_id?: number | null;
  correo?: string | null;
  evento: HistorialAccesoEvento;
  resultado: 'exitoso' | 'fallido';
  origen?: 'web' | 'mobile' | 'api' | 'desconocido';
  ip?: string | null;
  user_agent?: string | null;
  motivo?: string | null;
  metadata?: Record<string, any>;
};