import { isOperationalFlowIntent } from './max.intent.js';

export type EmployeeLookup = {
  id?: number;
  correo?: string;
  nombre?: string;
};

function compactText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function hasEmployeeSearchVerb(message: string) {
  return /busca|buscar|buscame|encuentra|localiza|consulta|consultar|muestra|mostrar|dame|ver/.test(message);
}

export function hasEmployeeDataTerm(message: string) {
  return /informacion|datos|perfil|resumen|detalle|estatus|estado|expediente|contrato|nomina|vacaciones|asistencia|incapacidad|incapacidades|permisos/.test(message);
}

export function hasEmployeeSubject(message: string) {
  return /empleado|empleada|colaborador|colaboradora|trabajador|trabajadora|usuario|persona|admin|administrador|administradora|correo|id\s*\d+/.test(message);
}

export function isLikelyName(value: string) {
  const tokens = value
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length < 2 || tokens.length > 4) return false;

  const blocked = new Set([
    'empleado',
    'usuario',
    'colaborador',
    'trabajador',
    'administrador',
    'admin',
    'informacion',
    'datos',
    'perfil',
    'resumen',
    'detalle',
    'contrato',
    'nomina',
    'vacaciones',
    'asistencia',
    'incapacidad',
    'incapacidades',
    'pendiente',
    'pendientes',
    'permiso',
    'permisos',
    'como',
    'donde',
    'reviso',
    'aprobar',
    'rechazar',
    'cambiar',
    'validar',
    'credencial',
    'portal',
    'movil',
    'app',
    'antes',
    'despues',
    'para',
    'quiero',
    'necesito',
  ]);

  return tokens.every((token) => /^[a-zñ.'-]{2,}$/.test(token) && !blocked.has(token));
}

export function extractEmployeeLookup(rawMessage: string): EmployeeLookup | null {
  const normalized = compactText(rawMessage);
  const email = normalized.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)?.[0];
  if (email) return { correo: email };

  const idMatch = normalized.match(/(?:empleado|usuario|colaborador|trabajador|id)\s*#?\s*(\d+)/i);
  if (idMatch) return { id: Number(idMatch[1]) };

  const dataOwnerName = normalized.match(
    /(?:contrato|contratos|nomina|vacaciones|asistencia|incapacidad|incapacidades|permisos|expediente|perfil)\s+(?:de|del|para)\s+([a-zñ.'-]+(?:\s+[a-zñ.'-]+){1,3})/i
  );

  if (dataOwnerName) {
    const nombre = dataOwnerName[1].replace(/\s+/g, ' ').trim();
    if (isLikelyName(nombre)) return { nombre };
  }

  const explicitSearchName = normalized.match(
    /(?:busca|buscar|buscame|encuentra|localiza|consulta|consultar|muestra|mostrar|dame|revisa|revisar)\s+(?:a\s+)?([a-zñ.'-]+(?:\s+[a-zñ.'-]+){1,3})/i
  );

  if (explicitSearchName) {
    const nombre = explicitSearchName[1].replace(/\s+/g, ' ').trim();
    if (isLikelyName(nombre)) return { nombre };
  }

  const labeledName = normalized.match(
    /(?:empleado|colaborador|trabajador|usuario|persona|admin|administrador)\s+(?:llamado|llamada|con nombre|nombre)\s+([a-zñ.'-]+(?:\s+[a-zñ.'-]+){1,3})/i
  );

  if (labeledName) {
    const nombre = labeledName[1].replace(/\s+/g, ' ').trim();
    if (isLikelyName(nombre)) return { nombre };
  }

  return null;
}

export function isEmployeeDataIntent(message: string) {
  const lookup = extractEmployeeLookup(message);
  if (!lookup) return false;

  if (isOperationalFlowIntent(message) && !hasEmployeeSearchVerb(message)) {
    return false;
  }

  return (
    hasEmployeeSearchVerb(message) ||
    hasEmployeeDataTerm(message) ||
    Boolean(lookup.id) ||
    Boolean(lookup.correo)
  );
}

export function shouldAskEmployeeIdentifier(message: string) {
  if (isOperationalFlowIntent(message)) return false;

  return (
    hasEmployeeSubject(message) &&
    (hasEmployeeSearchVerb(message) || hasEmployeeDataTerm(message)) &&
    !extractEmployeeLookup(message)
  );
}
