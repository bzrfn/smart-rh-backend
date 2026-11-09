import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { serialize } from 'node:v8';
import mongoose from 'mongoose';
import { pool } from '../../config/db.js';
import { deleteStorageObject, readStorageObject, listStorageObjects, storageKeyFromPublicPath } from '../../config/storage.js';
import { AppError } from '../../utils/AppError.js';
import { assertRemovalAllowed, buildRemovalPlan, ownerFields, rowKey, type RemovalEdge, type RemovalTable } from './users.removal-plan.js';
const quote = (name: string) => '`' + name.replaceAll('`','``') + '`';
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const BSON = mongoose.mongo.BSON;
async function save(path: string, bytes: Buffer | string) { const file = await open(path,'wx',0o600); try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); } }
function fileRefs(value: any, keys: Set<string>) {
  if (typeof value === 'string') { const key = storageKeyFromPublicPath(value); if (key) keys.add(key); }
  else if (Array.isArray(value)) value.forEach(item => fileRefs(item,keys));
  else if (value && Object.getPrototypeOf(value) === Object.prototype) Object.values(value).forEach(item => fileRefs(item,keys));
}
type RemovalDependencies = { pool: typeof pool; mongoDb: () => typeof mongoose.connection.db; storage: { read: typeof readStorageObject; remove: typeof deleteStorageObject; list: typeof listStorageObjects }; backupRoot: string; usersTable?: string };
export function buildPermanentDeletionService(deps: RemovalDependencies) {
return async function permanentlyDeleteUser(id: number, actorId: number, confirmEmail: unknown) {
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(actorId) || actorId <= 0) throw new AppError('ID de usuario inválido',400);
  const db = deps.mongoDb(); if (!db) throw new AppError('No se puede verificar el respaldo de datos. Reintenta más tarde.',503);
  const conn = await deps.pool.getConnection();
  const operationId = randomUUID(), backup = resolve(deps.backupRoot,operationId);
  const mongo: { collection: string; before: any; after: any | null; bytes: Uint8Array }[] = [];
  let commitAttempted = false, committed = false, mongoTouched = false;
  try {
    await conn.beginTransaction();
    const [admins] = await conn.query<any[]>("SELECT u.id FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.activo=1 AND LOWER(r.nombre)='admin' ORDER BY u.id FOR UPDATE");
    if (!admins.some(row => Number(row.id) === actorId)) throw new AppError('El administrador ya no tiene acceso',403);
    const [users] = await conn.query<any[]>('SELECT u.*,r.nombre AS role FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=? FOR UPDATE',[id]);
    const target = users[0]; assertRemovalAllowed(target,actorId,confirmEmail,admins.length);
    const [columns] = await conn.query<any[]>('SELECT TABLE_NAME AS name,COLUMN_NAME AS columnName FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
    const [primary] = await conn.query<any[]>("SELECT TABLE_NAME AS name,COLUMN_NAME AS columnName FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND CONSTRAINT_NAME='PRIMARY' ORDER BY ORDINAL_POSITION");
    const [edges] = await conn.query<any[]>(`SELECT k.TABLE_NAME AS child,k.COLUMN_NAME AS \`column\`,k.REFERENCED_TABLE_NAME AS parent,k.REFERENCED_COLUMN_NAME AS parentColumn,r.DELETE_RULE AS rule,k.CONSTRAINT_NAME AS \`constraint\` FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.REFERENCED_TABLE_SCHEMA=DATABASE()`);
    const [names] = await conn.query<any[]>("SELECT TABLE_NAME AS name,ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE'");
    if (names.length > 150) throw new AppError('El volumen de datos requiere una eliminación asistida',409);
    const tables: RemovalTable[] = []; let count = 0;
    for (const item of names) {
      if (String(item.name).startsWith('smarth_probe_')) continue;
      if (item.engine !== 'InnoDB') throw new AppError('Una tabla no admite transacciones; requiere revisión',409);
      const [rows] = await conn.query<any[]>(`SELECT * FROM ${quote(item.name)} LIMIT 20001 FOR UPDATE`);
      if (rows.length > 20000 || (count += rows.length) > 50000) throw new AppError('El volumen de datos requiere una eliminación asistida',409);
      tables.push({ name:item.name, rows, pk:primary.filter(row => row.name===item.name).map(row=>row.columnName), columns:columns.filter(row=>row.name===item.name).map(row=>row.columnName) });
    }
    const plan = buildRemovalPlan(tables,edges as RemovalEdge[],target,deps.usersTable);
    const removedFiles = new Set<string>(), keptFiles = new Set<string>();
    for (const table of tables) for (const row of table.rows) fileRefs(row,plan.selected.get(table.name)!.has(rowKey(table,row)) ? removedFiles : keptFiles);
    let bytes = 0, docs = 0;
    const actorFields = ['admin_usuario_id','admin_user_id','admin_id','generado_por','sponsor_admin_id','decision_admin_user_id'];
    function sanitize(value: any, field = ''): any {
      if ([...ownerFields,...actorFields].includes(field) && String(value) === String(id)) return null;
      if (typeof value === 'string') return value.replace(new RegExp(target.correo.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'[cuenta eliminada]');
      if (Array.isArray(value)) return value.filter(item => !(item && ownerFields.some(key => String(item[key]) === String(id)))).map(item=>sanitize(item,field));
      if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,sanitize(item,key)]));
      return value;
    }
    for (const { name } of await db.listCollections({}, {nameOnly:true}).toArray()) {
      if (name.startsWith('system.') || name.startsWith('smarth_probe_')) continue;
      let collectionDocs = 0;
      for await (const doc of db.collection(name).find({}).limit(20001)) {
        if (++collectionDocs > 20000) throw new AppError('La colección requiere una eliminación asistida',409);
        const raw = BSON.serialize(doc);
        if (++docs > 50000 || (bytes += raw.length) > 64*1024*1024) throw new AppError('El volumen de documentos requiere una eliminación asistida',409);
        const owners = ownerFields.filter(field => doc[field] != null).map(field=>String(doc[field]));
        const owned = owners.includes(String(id)) || String(doc.correo || '').toLowerCase() === target.correo.toLowerCase();
        if (owned && owners.some(owner=>owner!==String(id))) throw new AppError('Un documento pertenece a varias cuentas; requiere revisión',409);
        const after = owned ? null : sanitize(doc);
        if (owned || hash(BSON.serialize(after)) !== hash(raw)) { mongo.push({collection:name,before:doc,after,bytes:raw}); fileRefs(doc,removedFiles); }
        if (after) fileRefs(after,keptFiles);
      }
    }
    for (const object of (await Promise.all(['profiles','credenciales','contratos','incapacidades'].map(prefix=>deps.storage.list(prefix)))).flat()) if (new RegExp('^(?:profiles/perfil_|credenciales/credencial_|contratos/contrato_|incapacidades/comprobante_)'+id+'(?:_|\\.|$)').test(object)) removedFiles.add(object);
    const files: { key:string; file:string; sha256:string }[] = [];
    await mkdir(backup,{recursive:true,mode:0o700});
    for (const key of removedFiles) {
      if (key.startsWith('empresa/') || keptFiles.has(key)) continue;
      const object = await deps.storage.read(key); if (!object) continue;
      if ((bytes += object.body.length) > 128*1024*1024) throw new AppError('El respaldo de archivos requiere una eliminación asistida',409);
      const file = 'file-'+files.length+'.bin'; await save(join(backup,file),object.body); files.push({key,file,sha256:hash(object.body)});
    }
    const sql = tables.filter(table=>plan.selected.get(table.name)!.size).map(table=>({name:table.name,pk:table.pk,rows:[...plan.selected.get(table.name)!.values()]}));
    const archive = serialize({operationId,actorId,userId:id,createdAt:new Date(),sql,mongo:mongo.map(action=>({collection:action.collection,bytes:action.bytes,after:action.after?BSON.serialize(action.after):null})),files});
    await save(join(backup,'archive.v8'),archive);
    await save(join(backup,'manifest.json'),JSON.stringify({operationId,userId:id,actorId,archiveSha256:hash(archive),files,stage:'prepared'},null,2));
    for (const name of plan.order) {
      const table = tables.find(item=>item.name===name)!;
      for (const row of plan.selected.get(name)!.values()) {
        const [result] = await conn.query<any>(`DELETE FROM ${quote(name)} WHERE ${table.pk.map(column=>quote(column)+' <=> ?').join(' AND ')}`,table.pk.map(column=>row[column]));
        if (result.affectedRows !== 1) throw new AppError('Los datos cambiaron durante la eliminación',409);
      }
    }
    mongoTouched = true;
    for (const action of mongo) {
      const collection = db.collection(action.collection), current = await collection.findOne({_id:action.before._id});
      if (!current || hash(BSON.serialize(current))!==hash(action.bytes)) throw new AppError('Un documento cambió durante la eliminación',409);
      const filter = {$and:[{_id:action.before._id},action.before]};
      const result = action.after ? await collection.replaceOne(filter,action.after) : await collection.deleteOne(filter);
      if (('deletedCount' in result ? result.deletedCount : result.matchedCount)!==1) throw new AppError('Un documento cambió durante la eliminación',409);
    }
    await save(join(backup,'committing'),new Date().toISOString()); commitAttempted = true;
    await conn.commit(); committed = true;
    await rename(join(backup,'committing'),join(backup,'sql-committed'));
    let cleanupPending = false;
    for (const file of files) {
      try { const current = await deps.storage.read(file.key); if (current) { if (hash(current.body)!==file.sha256) throw new Error('FILE_CHANGED'); await deps.storage.remove(file.key); } }
      catch { cleanupPending = true; }
    }
    await save(join(backup,cleanupPending?'files-pending':'complete'),new Date().toISOString());
    return { operationId,cleanupPending };
  } catch (error) {
    if (!commitAttempted) {
      try {
        await conn.rollback();
        if (mongoTouched) for (const action of mongo) {
          const collection = db.collection(action.collection), current = await collection.findOne({_id:action.before._id});
          if (!current && !action.after) await collection.insertOne(action.before);
          else if (current && action.after && hash(BSON.serialize(current))===hash(BSON.serialize(action.after))) await collection.replaceOne({_id:current._id},action.before);
          const restored = await collection.findOne({_id:action.before._id});
          if (!restored || hash(BSON.serialize(restored))!==hash(action.bytes)) throw new Error('RESTORE_NOT_CONFIRMED');
        }
      } catch {
        console.error('[USER_REMOVAL] Restauración requiere revisión', {operationId});
        throw new AppError('Revisa el respaldo antes de reintentar. Operación: '+operationId,503);
      }
      throw error;
    }
    // A lost SQL commit acknowledgement must never cause a speculative cross-store restore.
    console.error('[USER_REMOVAL] Revisión requerida', {operationId,committed});
    throw new AppError('Revisa el estado de la cuenta antes de reintentar. Operación: '+operationId,503);
  } finally { conn.release(); }
}

}
export const permanentlyDeleteUser = buildPermanentDeletionService({ pool, mongoDb:()=>mongoose.connection.db,
  storage:{read:readStorageObject,remove:deleteStorageObject,list:listStorageObjects},
  backupRoot:resolve(process.cwd(),'private-backups','user-deletions') });
