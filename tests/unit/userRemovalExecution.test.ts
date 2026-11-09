import { mkdtemp,rm,readdir,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deserialize } from 'node:v8';
import mongoose from 'mongoose';
import { buildPermanentDeletionService } from '../../src/modules/users/users.permanent-deletion.js';
jest.mock('../../src/config/db.js',()=>({pool:{}}));
const email='delete@example.invalid';
let root:string;
beforeEach(async()=>{root=await mkdtemp(join(tmpdir(),'user-removal-test-'));});
afterEach(async()=>{await rm(root,{recursive:true,force:true});});
function fixture(failure='') {
 const rows:Record<string,any[]>={usuarios:[{id:7,correo:'admin@example.invalid',rol_id:1,activo:1},{id:42,correo:email,rol_id:2,activo:0,foto_perfil_url:'/uploads/profiles/perfil_42.png'}],roles:[{id:1,nombre:'admin'},{id:2,nombre:'empleado'}],asistencias:[{id:1,usuario_id:42},{id:2,usuario_id:7}]};
 const initial=structuredClone(rows);let commitCalls=0,rollbackCalls=0;
 const conn:any={beginTransaction:async()=>{},release:()=>{},rollback:async()=>{rollbackCalls++;Object.assign(rows,structuredClone(initial));},commit:async()=>{commitCalls++;if(failure==='commit')throw new Error('ACK_LOST');},query:async(sql:string,values:any[]=[])=>{
  if(sql.includes('ORDER BY u.id FOR UPDATE'))return[[{id:7}]];
  if(sql.includes('SELECT u.*,r.nombre'))return[[{...rows.usuarios.find(row=>row.id===42),role:'empleado'}]];
  if(sql.includes('information_schema.COLUMNS'))return[Object.entries(rows).flatMap(([name,data])=>Object.keys(data[0]).map(columnName=>({name,columnName})))];
  if(sql.includes("CONSTRAINT_NAME='PRIMARY'"))return[Object.keys(rows).map(name=>({name,columnName:'id'}))];
  if(sql.includes('REFERENTIAL_CONSTRAINTS'))return[[{child:'asistencias',column:'usuario_id',parent:'usuarios',parentColumn:'id',constraint:'fk_user',rule:'CASCADE'}]];
  if(sql.includes('information_schema.TABLES'))return[Object.keys(rows).map(name=>({name,engine:'InnoDB'}))];
  if(sql.startsWith('SELECT *'))return[rows[sql.match(/`([^`]+)`/)![1]]];
  if(sql.startsWith('DELETE')){const name=sql.match(/`([^`]+)`/)![1];const before=rows[name].length;rows[name]=rows[name].filter(row=>row.id!==values[0]);return[{affectedRows:before-rows[name].length}];}
  throw new Error('UNEXPECTED_QUERY');
 }};
 const original={_id:new mongoose.Types.ObjectId(),usuario_id:42,texto:'prueba'}, docs:any[]=[original];let deletions=0;
 const collection:any={find:()=>({limit:()=>({async *[Symbol.asyncIterator](){for(const doc of [...docs])yield doc;}})}),findOne:async(filter:any)=>docs.find(doc=>String(doc._id)===String(filter._id))||null,deleteOne:async()=>{deletions++;if(failure==='mongo')throw new Error('MONGO_WRITE_FAILED');docs.splice(0,1);return{deletedCount:1};},insertOne:async(doc:any)=>{docs.push(doc);},replaceOne:async()=>({matchedCount:1})};
 const files=new Map([['profiles/perfil_42.png',Buffer.from('profile')],['profiles/perfil_7.png',Buffer.from('protected')]]);
 const service=buildPermanentDeletionService({pool:{getConnection:async()=>conn} as any,mongoDb:()=>({listCollections:()=>({toArray:async()=>[{name:'max_conversations'}]}),collection:()=>collection}) as any,backupRoot:failure==='backup'?'/dev/null/no-backup':root,storage:{list:async()=>[...files.keys()],read:async(key:string)=>files.has(key)?{body:files.get(key)!,contentType:'image/png'}:null,remove:async(key:string)=>{if(failure==='storage')throw new Error('S3_DOWN');files.delete(key);}}});
 return {service,rows,docs,files,stats:()=>({commitCalls,rollbackCalls,deletions})};
}
it('archives SQL, BSON and files before removing the inactive account and keeps unrelated data',async()=>{const f=fixture();const result=await f.service(42,7,email);expect(result.cleanupPending).toBe(false);expect(f.rows.usuarios.map(row=>row.id)).toEqual([7]);expect(f.rows.asistencias).toEqual([{id:2,usuario_id:7}]);expect(f.docs).toHaveLength(0);expect(f.files.has('profiles/perfil_7.png')).toBe(true);expect(f.files.has('profiles/perfil_42.png')).toBe(false);const archive=deserialize(await readFile(join(root,result.operationId,'archive.v8')));expect(archive.sql.find((table:any)=>table.name==='usuarios').rows[0].correo).toBe(email);expect(archive.mongo).toHaveLength(1);expect(await readdir(join(root,result.operationId))).toContain('complete');});
it('does not delete anything if the backup cannot be persisted',async()=>{const f=fixture('backup');await expect(f.service(42,7,email)).rejects.toThrow();expect(f.rows.usuarios).toHaveLength(2);expect(f.docs).toHaveLength(1);expect(f.stats().commitCalls).toBe(0);expect(f.stats().deletions).toBe(0);});
it('rolls SQL back when Mongo refuses the operation and leaves storage untouched',async()=>{const f=fixture('mongo');await expect(f.service(42,7,email)).rejects.toThrow('MONGO_WRITE_FAILED');expect(f.rows.usuarios).toHaveLength(2);expect(f.docs).toHaveLength(1);expect(f.files.has('profiles/perfil_42.png')).toBe(true);expect(f.stats().rollbackCalls).toBe(1);});
it('reports file cleanup as pending after a committed deletion instead of inventing full success',async()=>{const f=fixture('storage');const result=await f.service(42,7,email);expect(result.cleanupPending).toBe(true);expect(f.rows.usuarios.map(row=>row.id)).toEqual([7]);expect(await readdir(join(root,result.operationId))).toContain('files-pending');});
it('does not speculate about a lost SQL commit acknowledgement or restore Mongo over an uncertain commit',async()=>{const f=fixture('commit');const log=jest.spyOn(console,'error').mockImplementation(()=>{});await expect(f.service(42,7,email)).rejects.toThrow('Revisa el estado');expect(f.stats().rollbackCalls).toBe(0);expect(f.files.has('profiles/perfil_42.png')).toBe(true);expect(f.docs).toHaveLength(0);log.mockRestore();});
