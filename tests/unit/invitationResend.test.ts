jest.mock('../../src/config/db.js', () => ({ pool: { getConnection: jest.fn(), query: jest.fn() } }));
import { pool } from '../../src/config/db.js';
import { buildAdminInviteService } from '../../src/modules/auth/adminInvite.service.js';
import { createAdminInvitation, listPendingInvitations, findPendingInvitation, revokeAdminInvitation } from '../../src/modules/auth/adminInvite.repository.js';

const oldId='a'.repeat(64),newId='b'.repeat(64);
const actor={id:7,correo:'admin@example.test',activo:1,email_verificado:1,session_version:3,rol_nombre:'admin'};
const original={invitation_id:oldId,invite_email:'persona@example.test',nombre:'Persona',apellido:'Prueba',account_type:'empleado' as const,
 telefono:null,direccion:null,fecha_ingreso:null,dias_vacaciones_disponibles:12,created_at:new Date(Date.now()-3600000),expires_at:new Date(Date.now()-60000),delivery_failed_at:null};
function fixture(overrides: Record<string,any> = {}) {
 const deps:any={findSponsor:jest.fn(async()=>actor),findPendingInvitation:jest.fn(async()=>original),listPendingInvitations:jest.fn(async()=>[original]),
  generateInvitationId:jest.fn(()=>newId),generateToken:jest.fn(()=>'c'.repeat(64)),createTokenHmac:jest.fn(()=>'d'.repeat(64)),createIpHash:jest.fn(()=>null),
  createInvitation:jest.fn(async()=>({status:'created'})),revokeInvitation:jest.fn(async()=>true),sendInvitationEmail:jest.fn(async()=>undefined),...overrides};
 return {deps,service:buildAdminInviteService(deps)};
}
describe('Invitation resend business flow',()=>{
 it('resends an expired invitation to its stored recipient with a new cryptographic link',async()=>{
  const h=fixture();const result=await h.service.resendInvitation(7,oldId,{correo:'attacker@example.test',nombre:'Changed',tipo_cuenta:'empleado'});
  expect(result.invitationId).toBe(newId);
  expect(h.deps.createInvitation).toHaveBeenCalledWith(expect.objectContaining({replacesInvitationId:oldId,invitationId:newId,inviteEmail:original.invite_email,accountType:'empleado',nombre:'Persona'}));
  expect(h.deps.sendInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({correo:original.invite_email,accountType:'empleado',acceptUrl:expect.stringContaining(newId)}));
 });
 it('does not let a resend change a known role',async()=>{
  const h=fixture();await expect(h.service.resendInvitation(7,oldId,{tipo_cuenta:'admin'})).rejects.toMatchObject({statusCode:409});expect(h.deps.sendInvitationEmail).not.toHaveBeenCalled();
 });
 it('an older invitation requires an explicit role rather than defaulting to admin',async()=>{
  const h=fixture({findPendingInvitation:jest.fn(async()=>({...original,account_type:null}))});
  await expect(h.service.resendInvitation(7,oldId,{})).rejects.toMatchObject({statusCode:400});
  await h.service.resendInvitation(7,oldId,{tipo_cuenta:'empleado'});
  expect(h.deps.sendInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({accountType:'empleado'}));
 });
 it('an accepted or superseded invitation is not sent again',async()=>{
  const h=fixture({findPendingInvitation:jest.fn(async()=>null)});
  await expect(h.service.resendInvitation(7,oldId,{})).rejects.toMatchObject({statusCode:409});expect(h.deps.createInvitation).not.toHaveBeenCalled();
 });
 it.each(['user_exists','invitation_unavailable','cooldown'])('handles acceptance or another resend during the request: %s',async status=>{
  const h=fixture({createInvitation:jest.fn(async()=>({status}))});
  await expect(h.service.resendInvitation(7,oldId,{})).rejects.toMatchObject({statusCode:status==='cooldown'?429:409});expect(h.deps.sendInvitationEmail).not.toHaveBeenCalled();
 });
 it.each([null,{...actor,activo:0},{...actor,rol_nombre:'empleado'}])('requires a currently eligible administrator',async sponsor=>{
  const h=fixture({findSponsor:jest.fn(async()=>sponsor)});
  await expect(h.service.resendInvitation(7,oldId,{})).rejects.toMatchObject({statusCode:403});expect(h.deps.findPendingInvitation).not.toHaveBeenCalled();
 });
 it('records an unconfirmed delivery while keeping the candidate eligible for a later retry',async()=>{
  const h=fixture({sendInvitationEmail:jest.fn(async()=>{throw new Error('SMTP unavailable');})});
  await expect(h.service.resendInvitation(7,oldId,{})).rejects.toMatchObject({statusCode:502});
  expect(h.deps.revokeInvitation).toHaveBeenCalledWith(newId,7,'delivery_failed');
 });
 it('rejects malformed identifiers before lookup',async()=>{
  const h=fixture();await expect(h.service.resendInvitation(7,'../invalid',{})).rejects.toMatchObject({statusCode:400});expect(h.deps.findPendingInvitation).not.toHaveBeenCalled();
 });
 it('lists candidates only for an authorized administrator',async()=>{
  const h=fixture();expect(await h.service.pendingInvitations(7)).toEqual([original]);
  const denied=fixture({findSponsor:jest.fn(async()=>null)});await expect(denied.service.pendingInvitations(7)).rejects.toMatchObject({statusCode:403});
 });
});

describe('Atomic replacement and pending projection',()=>{
 let conn:any;
 beforeEach(()=>{
  jest.clearAllMocks();
  conn={beginTransaction:jest.fn(),commit:jest.fn(),rollback:jest.fn(),release:jest.fn(),query:jest.fn()};
  conn.query.mockImplementation(async(sql:string)=>{
   const q=sql.replace(/\s+/g,' ').trim();
   if(q.includes('GET_LOCK'))return [[{got_lock:1,acquired:1,lock_status:1,locked:1}]];
   if(q.includes('RELEASE_LOCK'))return [[{released:1}]];
   if(q.includes('JOIN roles'))return [[actor]];
   if(q.startsWith('SELECT id FROM usuarios'))return [[]];
   if(q.includes('SELECT invitation_id, account_type'))return [[{...original,accepted_at:null,revoked_at:null}]];
   if(q.startsWith('SELECT invitation_id'))return [[]];
   return [{affectedRows:1}];
  });
  (pool.getConnection as jest.Mock).mockResolvedValue(conn);
 });
 const input={invitationId:newId,tokenHmac:'d'.repeat(64),sponsorAdminId:7,sponsorSessionVersion:3,inviteEmail:original.invite_email,
 nombre:'Persona',apellido:'Prueba',expiresInMinutes:30,accountType:'empleado' as const,replacesInvitationId:oldId};
 it('revokes the old link and inserts its replacement in a single transaction before commit',async()=>{
  const result=await createAdminInvitation(input);expect(result.status).toBe('created');
  const statements=conn.query.mock.calls.map((x:any)=>String(x[0]).replace(/\s+/g,' '));
  expect(statements.some((x:string)=>x.includes('FOR UPDATE'))).toBe(true);
  const update=statements.findIndex((x:string)=>x.includes('SET revoked_at = NOW(), delivery_failed_at = NULL'));
  const insert=statements.findIndex((x:string)=>x.includes('INSERT INTO admin_invitations'));
  expect(update).toBeGreaterThan(-1);expect(insert).toBeGreaterThan(update);
  expect(conn.commit).toHaveBeenCalledTimes(1);expect(conn.release).toHaveBeenCalledTimes(1);
 });
 it('rolls back revocation if inserting the new invitation fails',async()=>{
  const base=conn.query.getMockImplementation();conn.query.mockImplementation(async(sql:string,...args:any[])=>{
   if(sql.includes('INSERT INTO admin_invitations'))throw new Error('insert failed');return base(sql,...args);
  });
  await expect(createAdminInvitation(input)).rejects.toThrow('insert failed');expect(conn.rollback).toHaveBeenCalledTimes(1);expect(conn.commit).not.toHaveBeenCalled();
 });
 it('an accepted row is never reissued even if the earlier service lookup saw it pending',async()=>{
  const base=conn.query.getMockImplementation();conn.query.mockImplementation(async(sql:string,...args:any[])=>{
   if(sql.includes('SELECT invitation_id, account_type'))return [[{...original,accepted_at:new Date()}]];return base(sql,...args);
  });
  expect((await createAdminInvitation(input)).status).toBe('invitation_unavailable');
  expect(conn.query.mock.calls.some((x:any)=>x[0].includes('INSERT INTO admin_invitations'))).toBe(false);
 });
 it('cooldown prevents a second generation and email while the current one is recent',async()=>{
  const base=conn.query.getMockImplementation();conn.query.mockImplementation(async(sql:string,...args:any[])=>{
   if(sql.includes('SELECT invitation_id, account_type'))return [[{...original,created_at:new Date()}]];return base(sql,...args);
  });
  expect((await createAdminInvitation(input)).status).toBe('cooldown');expect(conn.query.mock.calls.some((x:any)=>x[0].includes('UPDATE admin_invitations SET'))).toBe(false);
 });
 it('pending listings never project token material or include activated accounts',async()=>{
  (pool.query as jest.Mock).mockResolvedValue([[]]);await listPendingInvitations();
  const sql=(pool.query as jest.Mock).mock.calls[0][0];expect(sql).not.toMatch(/token_hmac/);expect(sql).toContain('accepted_at IS NULL');expect(sql).toContain('NOT EXISTS (SELECT 1 FROM usuarios');
 });
 it('the candidate lookup is parameterized and excludes accepted and manually revoked invitations',async()=>{
  (pool.query as jest.Mock).mockResolvedValue([[original]]);expect(await findPendingInvitation(oldId)).toEqual(original);
  expect((pool.query as jest.Mock).mock.calls[0][1]).toEqual([oldId]);expect((pool.query as jest.Mock).mock.calls[0][0]).toContain('delivery_failed_at IS NOT NULL');
 });
 it('delivery failure marks only the exact invitation and sponsor',async()=>{
  (pool.query as jest.Mock).mockResolvedValue([{affectedRows:1}]);await revokeAdminInvitation(newId,7,'delivery_failed');
  expect((pool.query as jest.Mock).mock.calls[0][1]).toEqual([true,newId,7]);
 });
});
