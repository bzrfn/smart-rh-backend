jest.mock('../../src/config/db.js', () => ({ pool: { getConnection: jest.fn(), query: jest.fn() } }));
import { pool } from '../../src/config/db.js';
import { buildAdminInviteService } from '../../src/modules/auth/adminInvite.service.js';
import { createAdminInvitation, acceptAdminInvitation } from '../../src/modules/auth/adminInvite.repository.js';
const id='a'.repeat(64),token='b'.repeat(64),hmac='c'.repeat(64);
const actor={id:7,correo:'actor@example.test',activo:1,email_verificado:1,session_version:3,rol_nombre:'admin'};
const target={id:29,correo:'recipient@example.test',nombre:'Cuenta',apellido:'Existente',activo:1,email_verificado:1,session_version:4,rol_nombre:'admin',role:'admin',dias_vacaciones_disponibles:12};
function serviceFixture(extra:any={}) {
 const deps:any={findSponsor:jest.fn(async()=>actor),findExistingAccount:jest.fn(async()=>target),generateInvitationId:()=>id,generateToken:()=>token,createTokenHmac:()=>hmac,createIpHash:()=>null,
 createInvitation:jest.fn(async()=>({status:'created'})),sendInvitationEmail:jest.fn(async()=>undefined),revokeInvitation:jest.fn(async()=>true),...extra};
 return {deps,service:buildAdminInviteService(deps)};
}
describe('Existing account invitation service',()=>{
 it('takes the recipient and actual admin role from the database and binds its identity/version',async()=>{
  const {deps,service}=serviceFixture();await service.resendExistingAccount(7,29);
  expect(deps.createInvitation).toHaveBeenCalledWith(expect.objectContaining({existingUserId:29,existingUserSessionVersion:4,inviteEmail:target.correo,accountType:'admin'}));
  expect(deps.sendInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({correo:target.correo,acceptUrl:expect.stringContaining('existingAccount=1')}));
 });
 it('rejects unauthorized senders before looking up any recipient',async()=>{
  const h=serviceFixture({findSponsor:jest.fn(async()=>({...actor,rol_nombre:'empleado'}))});
  await expect(h.service.resendExistingAccount(7,29)).rejects.toMatchObject({statusCode:403});expect(h.deps.findExistingAccount).not.toHaveBeenCalled();
 });
 it.each([0,-1,'not-an-id'])('rejects invalid identifiers: %s',async value=>{const h=serviceFixture();await expect(h.service.resendExistingAccount(7,value)).rejects.toMatchObject({statusCode:400});});
 it('does not reactivate disabled accounts',async()=>{const h=serviceFixture({findExistingAccount:jest.fn(async()=>({...target,activo:0}))});await expect(h.service.resendExistingAccount(7,29)).rejects.toMatchObject({statusCode:409});expect(h.deps.sendInvitationEmail).not.toHaveBeenCalled();});
 it('reports SMTP failure rather than a successful invitation',async()=>{const h=serviceFixture({sendInvitationEmail:jest.fn(async()=>{throw new Error('SMTP failed');})});await expect(h.service.resendExistingAccount(7,29)).rejects.toMatchObject({statusCode:502});expect(h.deps.revokeInvitation).toHaveBeenCalledWith(id,7,'delivery_failed');});
});
function repositoryFixture(options:any={}) {
 const invitation:any={invitation_id:id,token_hmac:hmac,sponsor_admin_id:7,sponsor_session_version:3,invite_email:target.correo,
  existing_user_id:29,existing_user_session_version:4,expires_at:new Date(Date.now()+600000),accepted_at:null,revoked_at:null,...options.invitation};
 const account={...target,...options.account};
 const conn:any={beginTransaction:jest.fn(),commit:jest.fn(),rollback:jest.fn(),release:jest.fn()};
 conn.query=jest.fn(async(sql:string,params:any[])=>{
  const q=sql.replace(/\s+/g,' ').trim();
  if(q.includes('GET_LOCK'))return [[{got_lock:1,acquired:1,lock_status:1,locked:1}]];
  if(q.includes('RELEASE_LOCK'))return [[{released:1}]];
  if(q.startsWith('SELECT invitation_id, token_hmac'))return [[{...invitation}]];
  if(q.includes('JOIN roles'))return params?.[0]===29?[[account]]:[[actor]];
  if(q.startsWith('SELECT id, rol_id'))return [[account]];
  if(q.startsWith('SELECT id FROM usuarios'))return [[{id:29}]];
  if(q.startsWith('SELECT invitation_id'))return [options.recent?[{invitation_id:id}]:[]];
  if(q.startsWith('UPDATE usuarios'))return [{affectedRows:1}];
  if(q.includes('SET accepted_at=NOW()')){if(options.consumeFailure)return [{affectedRows:0}];invitation.accepted_at=new Date();return [{affectedRows:1}];}
  return [{affectedRows:1}];
 });
 (pool.getConnection as jest.Mock).mockResolvedValue(conn);(pool.query as jest.Mock).mockResolvedValue([[{invite_email:target.correo}]]);
 return {conn,invitation};
}
describe('Existing account invitation SQL boundaries',()=>{
 beforeEach(()=>jest.clearAllMocks());
 const input={invitationId:id,tokenHmac:hmac,sponsorAdminId:7,sponsorSessionVersion:3,inviteEmail:target.correo,nombre:'Cuenta',apellido:'Existente',expiresInMinutes:30,accountType:'admin' as const,existingUserId:29,existingUserSessionVersion:4};
 it('creates an invitation for the matching existing account without inserting another user',async()=>{
  const {conn}=repositoryFixture();expect((await createAdminInvitation(input)).status).toBe('created');
  const insert=conn.query.mock.calls.find((call:any)=>call[0].includes('INSERT INTO admin_invitations'));
  expect(insert[1].slice(-2)).toEqual([29,4]);expect(conn.query.mock.calls.some((call:any)=>call[0].includes('INSERT INTO usuarios'))).toBe(false);
 });
 it('refuses to send if the user role or session changed after the service lookup',async()=>{
  const {conn}=repositoryFixture({account:{session_version:5}});expect((await createAdminInvitation(input)).status).toBe('invitation_unavailable');expect(conn.query.mock.calls.some((call:any)=>call[0].includes('INSERT INTO admin_invitations'))).toBe(false);
 });
 it('enforces the resend cooldown for existing accounts',async()=>{repositoryFixture({recent:true});expect((await createAdminInvitation(input)).status).toBe('cooldown');});
 it('accepts into the original user id and preserves role and employee records',async()=>{
  const {conn}=repositoryFixture();const result=await acceptAdminInvitation(id,hmac,'new-password-hash','admin');
  expect(result).toEqual({status:'ok',user:{id:29,correo:target.correo,role:'admin',sessionVersion:5}});
  const update=conn.query.mock.calls.find((call:any)=>call[0].startsWith('UPDATE usuarios'));
  expect(update[1]).toEqual(['new-password-hash',29,4]);expect(update[0]).not.toMatch(/rol_id=|nombre=|apellido=/);
  expect(conn.query.mock.calls.some((call:any)=>call[0].includes('INSERT INTO usuarios'))).toBe(false);
  expect((await acceptAdminInvitation(id,hmac,'other-hash','admin')).status).toBe('invalid');
 });
 it.each([{session_version:8},{role:'empleado'},{activo:0},{correo:'different@example.test'}])('does not reset credentials after a security-state change: %o',async account=>{
  const {conn}=repositoryFixture({account});expect((await acceptAdminInvitation(id,hmac,'new-hash','admin')).status).toBe('invalid');expect(conn.query.mock.calls.some((call:any)=>call[0].startsWith('UPDATE usuarios'))).toBe(false);
 });
 it('rolls back the password update if token consumption loses the race',async()=>{const {conn}=repositoryFixture({consumeFailure:true});await expect(acceptAdminInvitation(id,hmac,'new-hash','admin')).rejects.toThrow();expect(conn.rollback).toHaveBeenCalledTimes(1);expect(conn.commit).not.toHaveBeenCalled();});
});
