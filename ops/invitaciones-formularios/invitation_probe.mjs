// Real SQL integration uses disposable table copies. SMTP is replaced before the service is invoked.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import mysql from 'mysql2/promise';
import nodemailer from 'nodemailer';
const root = process.argv[2];
const load = path => import(pathToFileURL(`${root}/${path}`).href);
const suffix = randomBytes(8).toString('hex');
const tables = { usuarios: `smarth_probe_users_${suffix}`, admin_invitations: `smarth_probe_invites_${suffix}` };
let isolate = false, pool, passed = false, stage = 'connect';
const originalCreate = mysql.createPool;
function rewrite(sql) {
  if (!isolate || typeof sql !== 'string') return sql;
  return sql.replace(/\b(usuarios|admin_invitations)\b/g, name => tables[name]);
}
function wrap(connection, pooled = false) {
  return new Proxy(connection, { get(target, key) {
    if (key === 'query' || key === 'execute') return (sql, ...args) => target[key](rewrite(sql), ...args);
    if (pooled && key === 'getConnection') return async () => wrap(await target.getConnection());
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
}
mysql.createPool = options => wrap(originalCreate.call(mysql, options), true);
nodemailer.createTransport = () => ({ sendMail: async () => { throw new Error('SMTP_DISABLED_DURING_PROBE'); } });
try {
  ({ pool } = await load('dist/config/db.js'));
  await pool.query('SELECT 1');
  if (process.argv.includes('--migrate')) {
    await pool.query("ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS account_type ENUM('admin','empleado') DEFAULT NULL");
    await pool.query('ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS delivery_failed_at DATETIME DEFAULT NULL');
    await pool.query('ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS existing_user_id INT DEFAULT NULL');
    await pool.query('ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS existing_user_session_version INT DEFAULT NULL');
    await pool.query('ALTER TABLE admin_invitations ADD COLUMN IF NOT EXISTS profile_completion_required TINYINT(1) NOT NULL DEFAULT 0');
    console.log('MIGRACION_ADITIVA=OK');
  }
  stage = 'stage_tables';
  await pool.query(`CREATE TABLE ${tables.usuarios} LIKE usuarios`);
  await pool.query(`CREATE TABLE ${tables.admin_invitations} LIKE admin_invitations`);
  const [roles] = await pool.query("SELECT id FROM roles WHERE LOWER(nombre)='admin' LIMIT 1");
  assert(roles[0]);
  await pool.query(`INSERT INTO ${tables.usuarios} (nombre, apellido, correo, contrasena, rol_id, activo, email_verificado, session_version, dias_vacaciones_disponibles)
    VALUES ('Prueba','Aislada',?, 'NOT_A_LOGIN_HASH', ?,1,1,0,12)`, [`sponsor-${suffix}@example.invalid`, roles[0].id]);
  isolate = true;
  const [sponsors] = await pool.query('SELECT id FROM usuarios LIMIT 1');
  const sponsorId = sponsors[0].id;
  const { buildAdminInviteService } = await load('dist/modules/auth/adminInvite.service.js');
  const sent = [];
  const service = buildAdminInviteService({ sendInvitationEmail: async data => { sent.push(data); }, hashPassword: async () => 'NOT_A_LOGIN_HASH' });
  const profile = { nombre: 'Prueba', apellido: 'Invitada', telefono: '+52 722 123 4567', direccion: 'Domicilio de prueba aislada 123' };
  const payload = { fecha_ingreso: '2026-11-09', correo: `invite-${suffix}@example.invalid`, tipo_cuenta: 'empleado', dias_vacaciones_disponibles: 12 };
  const acceptance = index => { const url = new URL(sent[index].acceptUrl); const params = new URLSearchParams(url.hash.includes('?') ? url.hash.split('?')[1] : url.search); return { invitationId: params.get('invitationId'), token: params.get('token'), tipoCuenta: params.get('tipoCuenta'), contrasena: 'Only-Disposable-Probe-123!', perfil: profile }; };
  stage = 'create_resend';
  const first = await service.requestInvitation(sponsorId, payload);
  assert.equal(sent.length, 1);
  await assert.rejects(service.resendInvitation(sponsorId, first.invitationId, {}));
  assert.equal(sent.length, 1);
  await pool.query('UPDATE admin_invitations SET created_at=DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE invitation_id=?', [first.invitationId]);
  const replacement = await service.resendInvitation(sponsorId, first.invitationId, { tipo_cuenta: 'empleado', correo: 'ignored@example.invalid' });
  assert.notEqual(first.invitationId, replacement.invitationId); assert.equal(sent[1].correo, payload.correo); assert.notEqual(sent[0].acceptUrl, sent[1].acceptUrl);
  const list = await service.pendingInvitations(sponsorId);
  assert.equal(list.length, 1); assert.equal(list[0].invitation_id, replacement.invitationId);
  assert(!('token_hmac' in list[0]) && !('token' in list[0]));
  const [beforeUsers] = await pool.query('SELECT COUNT(*) AS count FROM usuarios'); assert.equal(beforeUsers[0].count, 1);
  console.log('INVITACION_REENVIO_Y_PRIVACIDAD=OK');
  stage = 'acceptance';
  await assert.rejects(service.acceptInvitation(acceptance(0)));
  const preview = await service.inspectInvitation(acceptance(1));
  assert.equal(preview.invitation.correo, payload.correo); assert.equal(preview.invitation.requiresProfileCompletion, true);
  assert.equal(preview.invitation.diasVacaciones, 12);
  await assert.rejects(service.inspectInvitation({ ...acceptance(1), token: 'a'.repeat(64) }));
  const withoutProfile = { ...acceptance(1) }; delete withoutProfile.perfil;
  await assert.rejects(service.acceptInvitation(withoutProfile));
  const accepted = await service.acceptInvitation({ ...acceptance(1), rol_id: roles[0].id, correo: 'ignored@example.invalid', fecha_ingreso: '2000-01-01', dias_vacaciones_disponibles: 999 }); assert.equal(accepted.user.role, 'empleado');
  await assert.rejects(service.acceptInvitation(acceptance(1)));
  await assert.rejects(service.resendInvitation(sponsorId, replacement.invitationId, {}));
  assert.equal((await service.pendingInvitations(sponsorId)).length, 0);
  console.log('INVITACION_ENLACE_ANTERIOR_INVALIDADO=OK\nINVITACION_ACEPTADA_NO_REENVIABLE=OK');
  const [storedProfile] = await pool.query(`SELECT nombre, apellido, telefono, direccion, correo, DATE_FORMAT(fecha_ingreso, '%Y-%m-%d') AS fecha, dias_vacaciones_disponibles FROM usuarios WHERE id=?`, [accepted.user.id]);
  assert.equal(storedProfile[0].nombre, profile.nombre); assert.equal(storedProfile[0].telefono, profile.telefono); assert.equal(storedProfile[0].direccion, profile.direccion);
  assert.equal(storedProfile[0].correo, payload.correo); assert.equal(storedProfile[0].fecha, payload.fecha_ingreso); assert.equal(Number(storedProfile[0].dias_vacaciones_disponibles), 12);
  console.log('INVITACION_PERFIL_COMPLETO_Y_CAMPOS_ASIGNADOS=OK');
  stage = 'existing_account';
  await pool.query('UPDATE admin_invitations SET created_at=DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE invite_email=?', [payload.correo]);
  const [beforeExisting] = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
  const existingMail = sent.length;
  const existingInvite = await service.resendExistingAccount(sponsorId, accepted.user.id);
  assert.equal(sent.length, existingMail+1);
  const [unchanged] = await pool.query('SELECT session_version FROM usuarios WHERE id=?', [accepted.user.id]);
  assert.equal(Number(unchanged[0].session_version), Number(accepted.user.sessionVersion));
  const acceptedAgain = await service.acceptInvitation(acceptance(existingMail));
  assert.equal(acceptedAgain.user.id, accepted.user.id); assert.equal(acceptedAgain.user.role, 'empleado');
  const [afterExisting] = await pool.query('SELECT COUNT(*) AS count FROM usuarios');
  assert.equal(beforeExisting[0].count, afterExisting[0].count);
  await assert.rejects(service.acceptInvitation(acceptance(existingMail)));
  await pool.query('UPDATE admin_invitations SET created_at=DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE invite_email=?', [payload.correo]);
  const staleIndex = sent.length;
  await service.resendExistingAccount(sponsorId, accepted.user.id);
  await pool.query('UPDATE usuarios SET session_version=session_version+1 WHERE id=?', [accepted.user.id]);
  await assert.rejects(service.acceptInvitation(acceptance(staleIndex)));
  console.log('INVITACION_CUENTA_EXISTENTE_SIN_DUPLICADOS=OK\nINVITACION_ACEPTACION_Y_CAMBIO_DE_SESION=OK');
  stage = 'self_service_admin';
  const adminIndex=sent.length;
  await service.requestInvitation(sponsorId, { correo:`admin-${suffix}@example.invalid`, tipo_cuenta:'admin', fecha_ingreso:'2026-11-09', dias_vacaciones_disponibles:999 });
  const adminAccepted=await service.acceptInvitation(acceptance(adminIndex)); assert.equal(adminAccepted.user.role,'admin');
  const [adminRows]=await pool.query('SELECT dias_vacaciones_disponibles FROM usuarios WHERE id=?',[adminAccepted.user.id]); assert.equal(Number(adminRows[0].dias_vacaciones_disponibles),12);
  console.log('INVITACION_ADMIN_AUTOGESTION=OK');
  stage = 'legacy_and_concurrency';
  const legacy = await service.requestInvitation(sponsorId, { ...payload, correo: `legacy-${suffix}@example.invalid` });
  await pool.query('UPDATE admin_invitations SET account_type=NULL, created_at=DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE invitation_id=?', [legacy.invitationId]);
  await assert.rejects(service.resendInvitation(sponsorId, legacy.invitationId, {}));
  const results = await Promise.allSettled([service.resendInvitation(sponsorId, legacy.invitationId, { tipo_cuenta: 'empleado' }), service.resendInvitation(sponsorId, legacy.invitationId, { tipo_cuenta: 'empleado' })]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  console.log('INVITACION_ROL_EXPLICITO_Y_CONCURRENCIA=OK');
  stage = 'delivery_failure';
  const failing = buildAdminInviteService({ sendInvitationEmail: async () => { throw new Error('MOCK_SMTP_FAILURE'); } });
  await assert.rejects(failing.requestInvitation(sponsorId, { ...payload, correo: `failure-${suffix}@example.invalid` }));
  const failed = (await service.pendingInvitations(sponsorId)).find(item => item.invite_email === `failure-${suffix}@example.invalid`);
  assert(failed?.delivery_failed_at);
  await pool.query('UPDATE admin_invitations SET created_at=DATE_SUB(NOW(), INTERVAL 2 MINUTE) WHERE invitation_id=?', [failed.invitation_id]);
  await service.resendInvitation(sponsorId, failed.invitation_id, { tipo_cuenta: 'empleado' });
  console.log('INVITACION_FALLO_RECUPERABLE=OK\nSMTP_PRUEBA=SIN_ENVIOS_REALES');
  passed = true;
} catch (error) {
  console.log(`INVITATION_PROBE=ERROR; stage=${stage}; type=${String(error?.name || 'Error').replace(/[^a-zA-Z]/g,'')}`);
} finally {
  isolate = false;
  if (pool) {
    for (const table of [tables.admin_invitations, tables.usuarios]) { try { await pool.query(`DROP TABLE IF EXISTS ${table}`); } catch { passed = false; } }
    try { await pool.end(); } catch { passed = false; }
  }
  if (passed) console.log('LIMPIEZA_PRUEBAS=OK\nINTEGRACION_INVITACIONES_REAL=OK');
}
process.exitCode = passed ? 0 : 1;
