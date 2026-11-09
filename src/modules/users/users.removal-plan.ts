import { AppError } from '../../utils/AppError.js';
export type RemovalTable = { name: string; pk: string[]; rows: Record<string, any>[]; columns: string[] };
export type RemovalEdge = { child: string; column: string; parent: string; parentColumn: string; rule: string; constraint: string };
export const ownerFields = ['usuario_id','user_id','usuarioId','userId','empleado_id'];
const actorFields = ['admin_usuario_id','admin_user_id','admin_id','sponsor_admin_id','accepted_user_id','existing_user_id','decision_admin_user_id','revisado_por_admin_id','actualizado_por'];
export const rowKey = (table: RemovalTable, row: Record<string, any>) => JSON.stringify(table.pk.map(name => String(row[name])));
export function assertRemovalAllowed(target: any, actorId: number, confirmEmail: unknown, activeAdminCount: number) {
  if (!target) throw new AppError('Usuario no encontrado', 404);
  if (target.id === actorId || Number(target.id) === 1 || String(target.correo).toLowerCase() === 'brandonbernal413@gmail.com') throw new AppError('Esta cuenta está protegida y no se puede eliminar', 409);
  if (target.role === 'admin' && target.activo && activeAdminCount <= 1) throw new AppError('No se puede eliminar al último administrador activo', 409);
  if (target.activo) throw new AppError('Desactiva la cuenta antes de eliminarla', 409);
  if (typeof confirmEmail !== 'string' || confirmEmail.trim().toLowerCase() !== String(target.correo).toLowerCase()) throw new AppError('Escribe el correo exacto de la cuenta para confirmar', 400);
}
export function buildRemovalPlan(tables: RemovalTable[], edges: RemovalEdge[], target: { id: number; correo: string }, usersTable = 'usuarios') {
  const selected = new Map(tables.map(table => [table.name, new Map<string, Record<string, any>>()]));
  const owners = (row: Record<string, any>) => ownerFields.filter(field => row[field] != null).map(field => String(row[field]));
  function mark(table: RemovalTable, row: Record<string, any>) {
    if (!table.pk.length) throw new AppError('Una tabla relacionada no tiene clave primaria; requiere revisión', 409);
    if (table.name !== 'asistencia_revisiones' && owners(row).some(id => id !== String(target.id))) throw new AppError('Un registro relacionado pertenece a otra cuenta; requiere revisión', 409);
    if (table.pk.some(column => row[column] == null || (typeof row[column] === 'number' && !Number.isSafeInteger(row[column])))) throw new AppError('Una clave relacionada requiere revisión',409);
    const key = rowKey(table, row), rows = selected.get(table.name)!;
    if (rows.has(key)) return false; rows.set(key, row); return true;
  }
  for (const table of tables) for (const row of table.rows) {
    if (table.name === usersTable) { if (Number(row.id) === target.id) mark(table, row); continue; }
    if ([...ownerFields,...actorFields].some(field => row[field] != null && String(row[field]) === String(target.id)) ||
        (['admin_invitations','email_verification_codes'].includes(table.name) && [row.invite_email,row.correo].some(email => email && String(email).toLowerCase() === target.correo.toLowerCase()))) mark(table,row);
  }
  let changed = true, passes = 0;
  while (changed) {
    if (++passes > tables.length + 1) throw new AppError('Relaciones circulares; requiere revisión',409);
    changed = false;
    for (const edge of edges) {
      const parents = selected.get(edge.parent); if (!parents?.size) continue;
      if (edges.filter(item => item.child === edge.child && item.constraint === edge.constraint).length !== 1) throw new AppError('Relación compuesta; requiere revisión',409);
      const values = new Set([...parents.values()].map(row => String(row[edge.parentColumn])));
      const child = tables.find(table => table.name === edge.child)!;
      for (const row of child.rows) if (row[edge.column] != null && values.has(String(row[edge.column]))) {
        if (child.name === usersTable) throw new AppError('La eliminación afectaría otra cuenta',409);
        changed = mark(child,row) || changed;
      }
    }
  }
  const pending = new Set(tables.filter(table => selected.get(table.name)!.size).map(table => table.name)), order: string[] = [];
  while (pending.size) {
    const leaves = [...pending].filter(parent => !edges.some(edge => edge.parent === parent && pending.has(edge.child)));
    if (!leaves.length) throw new AppError('Relaciones circulares; requiere revisión',409);
    for (const name of leaves) { pending.delete(name); order.push(name); }
  }
  return { selected, order };
}
