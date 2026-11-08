import importlib.util, unittest, tempfile, json, hashlib, io, tarfile, types, sys
from pathlib import Path
from unittest.mock import patch, Mock

BASE=Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,BASE/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
cloud=load('deploycloud','desplegar_aws.py');remote=load('deployremote','remote_deploy.py')
sha=lambda b:hashlib.sha256(b).hexdigest()
class RemoteTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();t=Path(self.t.name);self.troot=t
  self.orig={n:getattr(remote,n) for n in ['ROOT','BACKEND','CONF','START','LOCK_FILE','BACKUP_ROOT','DROPIN']}
  remote.ROOT=t/'package';remote.ROOT.mkdir();remote.BACKEND=t/'backend';(remote.BACKEND/'dist/modules/chatbot').mkdir(parents=True)
  remote.CONF=t/'conf';remote.CONF.write_text('SMTP_SETTINGS_UNCHANGED');remote.START=t/'start';remote.START.write_text(str(remote.CONF))
  remote.LOCK_FILE=t/'lock';remote.BACKUP_ROOT=t/'backups';remote.DROPIN=t/'service.d/20-rds.conf'
  (remote.BACKEND/'node_modules').mkdir();(remote.BACKEND/'package.json').write_text('{"type":"module"}');(remote.BACKEND/'package-lock.json').write_text('{}')
  (remote.BACKEND/'dist/server.js').write_text('unchanged')
  self.rel='dist/modules/chatbot/chatbot.controller.js';self.newrel='dist/modules/chatbot/max.session.js'
  (remote.BACKEND/self.rel).write_bytes(b'OLD')
  with tarfile.open(remote.ROOT/'backend-modules.tar.gz','w:gz') as z:
   for n,v in [(self.rel,b'NEW'),(self.newrel,b'NEWSESSION')]:
    i=tarfile.TarInfo(n);i.size=len(v);z.addfile(i,io.BytesIO(v))
  (remote.ROOT/'rotation_probe.mjs').write_text('fake-probe')
  self.manifest={'backend_commit':'fixed','backend_files':{self.rel:{'before':sha(b'OLD'),'after':sha(b'NEW')},self.newrel:{'before':None,'after':sha(b'NEWSESSION')}},'payload_files':{n:sha((remote.ROOT/n).read_bytes()) for n in ['backend-modules.tar.gz','rotation_probe.mjs']},'dependencies':{n:sha((remote.BACKEND/n).read_bytes()) for n in ['package.json','package-lock.json']}}
  (remote.ROOT/'manifest.json').write_text(json.dumps(self.manifest))
  self.commands=[]
  def cmd(args,**kwargs):self.commands.append(args);return types.SimpleNamespace(stdout='24\n')
  self.mocks=[patch.object(remote,'cmd',side_effect=cmd),patch.object(remote,'runtime',return_value={'MONGO_URI':'test-only','DB_NODE_EXECUTABLE':'node','DB_SECRET_ARN':'arn:aws:secretsmanager:us-east-1:682530816594:secret:rds!db-test','DB_SECRET_AWS_CLI':'/usr/local/bin/aws','DB_SECRET_REGION':'us-east-1'}),patch.object(remote,'health',return_value=True),patch.object(remote,'wait_health'),patch.object(remote,'run_probe'),patch.object(remote,'wait_ready'),patch.object(remote.shutil,'which',return_value='/usr/local/bin/aws')]
  self.c,self.runtime,self.health,self.wait,self.probe,self.ready,self.which=[p.start() for p in self.mocks]
 def tearDown(self):
  for p in reversed(self.mocks):p.stop()
  for n,v in self.orig.items():setattr(remote,n,v)
  self.t.cleanup()
 def execute(self,apply=False):
  with patch.object(sys,'argv',['remote_deploy.py','--run-id','a'*32,'--secret-arn','arn:aws:secretsmanager:us-east-1:682530816594:secret:rds!db-test']+(['--apply'] if apply else [])):remote.main()
 def test_check_does_not_change_active_files_or_stop_service(self):
  self.execute();self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse(any(c[:2]==['systemctl','stop'] for c in self.commands))
 def test_probe_failure_never_stops_service(self):
  self.probe.side_effect=RuntimeError('probe failed')
  with self.assertRaises(RuntimeError):self.execute(True)
  self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse(any(c[:2]==['systemctl','stop'] for c in self.commands))
 def test_unknown_production_file_rejected(self):
  (remote.BACKEND/self.rel).write_bytes(b'UNREVIEWED')
  with self.assertRaises(RuntimeError):self.execute(True)
  self.assertFalse(self.probe.called)
 def test_apply_changes_only_modules_and_component_marker(self):
  self.execute(True);self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'NEW');self.assertEqual((remote.BACKEND/self.newrel).read_bytes(),b'NEWSESSION')
  self.assertEqual((remote.BACKEND/'DEPLOYED_RDS_ROTATION_COMMIT').read_text().strip(),'fixed');self.assertEqual(remote.CONF.read_text(),'SMTP_SETTINGS_UNCHANGED');self.assertEqual((remote.BACKEND/'dist/server.js').read_text(),'unchanged')
  self.assertTrue((remote.BACKUP_ROOT/('rotation-'+'a'*32)/self.rel).exists())
 def test_post_activation_failure_rolls_back_new_and_old_files(self):
  self.ready.side_effect=RuntimeError('readiness failed')
  with self.assertRaises(RuntimeError):self.execute(True)
  self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse((remote.BACKEND/self.newrel).exists());self.assertFalse((remote.BACKEND/'DEPLOYED_RDS_ROTATION_COMMIT').exists())
 def test_already_applied_does_not_restart(self):
  (remote.BACKEND/self.rel).write_bytes(b'NEW');(remote.BACKEND/self.newrel).write_bytes(b'NEWSESSION');(remote.BACKEND/'DEPLOYED_RDS_ROTATION_COMMIT').write_text('fixed\n')
  env=self.runtime.return_value
  remote.DROPIN.parent.mkdir(parents=True);remote.DROPIN.write_text('# SMART_RH_RDS_ROTATION_V1\n[Service]\n'+''.join('Environment='+json.dumps(k+'='+env[k])+'\n' for k in ['DB_SECRET_ARN','DB_SECRET_REGION','DB_SECRET_AWS_CLI']))
  self.execute(True);self.assertFalse(any(c[:2]==['systemctl','stop'] for c in self.commands))

 def test_foreign_systemd_dropin_is_never_overwritten(self):
  remote.DROPIN.parent.mkdir(parents=True);remote.DROPIN.write_text('foreign operator configuration')
  with self.assertRaisesRegex(RuntimeError,'DROPIN_EXISTENTE_NO_RECONOCIDO'):self.execute(True)
  self.assertFalse(self.probe.called);self.assertEqual(remote.DROPIN.read_text(),'foreign operator configuration')
 def test_failed_activation_restores_managed_dropin_exactly(self):
  remote.DROPIN.parent.mkdir(parents=True);original=b'# SMART_RH_RDS_ROTATION_V1\n[Service]\nEnvironment="DB_SECRET_REGION=old"\n';remote.DROPIN.write_bytes(original)
  self.ready.side_effect=RuntimeError('readiness failed')
  with self.assertRaises(RuntimeError):self.execute(True)
  self.assertEqual(remote.DROPIN.read_bytes(),original);self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD')
 def test_existing_max_commit_and_configuration_are_preserved(self):
  (remote.BACKEND/'DEPLOYED_MAX_COMMIT').write_text('e8f20fe')
  self.execute(True)
  self.assertEqual((remote.BACKEND/'DEPLOYED_MAX_COMMIT').read_text(),'e8f20fe')
  self.assertTrue(remote.DROPIN.read_text().startswith('# SMART_RH_RDS_ROTATION_V1'))
  self.assertNotIn('SMTP',remote.DROPIN.read_text());self.assertEqual(remote.CONF.read_text(),'SMTP_SETTINGS_UNCHANGED')
 def test_startup_that_discards_secret_environment_is_rolled_back(self):
  self.runtime.side_effect=[dict(self.runtime.return_value),{'MONGO_URI':'test-only'}]
  with self.assertRaisesRegex(RuntimeError,'CONFIGURACION_ACTIVA_DIFIERE'):self.execute(True)
  self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse(remote.DROPIN.exists())
 def test_partial_stop_failure_still_attempts_recovery(self):
  import subprocess
  original=self.c.side_effect;failed=False
  def sometimes(args,**kw):
   nonlocal failed
   if args[:2]==['systemctl','stop'] and not failed:
    failed=True;raise subprocess.CalledProcessError(1,args)
   return original(args,**kw)
  self.c.side_effect=sometimes
  with self.assertRaises(subprocess.CalledProcessError):self.execute(True)
  self.assertIn(['systemctl','start',remote.SERVICE],self.commands)
  self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse(remote.DROPIN.exists())

class TransferTests(unittest.TestCase):
 def test_transfers_verify_payload_and_extract_only_expected_files(self):
  import subprocess, shutil, uuid, os
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   for name in ['manifest.json','remote_deploy.py','rotation_probe.mjs','backend-modules.tar.gz']:
    (root/name).write_bytes(os.urandom(9000))
   received=[]
   def invoke(ssm,commands,report,label):
    result=subprocess.run(['bash','-c',commands[0]],capture_output=True,text=True)
    if result.returncode:raise RuntimeError(result.stderr)
    received.append(label);return result.stdout
   remote_directory=None
   try:
    with patch.object(cloud,'ROOT',root),patch.object(cloud,'invoke',side_effect=invoke):
     remote_directory=Path(cloud.transfer_backend(None,{},uuid.uuid4().hex))
    for name in ['manifest.json','remote_deploy.py','rotation_probe.mjs','backend-modules.tar.gz']:
     self.assertEqual((remote_directory/name).read_bytes(),(root/name).read_bytes())
    self.assertIn('verificacion transferencia',received)
    self.assertGreater(len(received),2)
   finally:
    if remote_directory:shutil.rmtree(remote_directory)
 def test_hash_mismatch_rejects_the_package(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);(root/'test').write_bytes(b'changed');(root/'SHA256.json').write_text(json.dumps({'test':sha(b'expected')}))
   with patch.object(cloud,'ROOT',root):
    with self.assertRaises(RuntimeError):cloud.check_package()

class CloudWorkflowTests(unittest.TestCase):
 def execute(self, output, apply=True, account='682530816594'):
  self.t=tempfile.TemporaryDirectory();root=Path(self.t.name)
  session=Mock();sts=Mock();ssm=Mock();rds=Mock()
  rds.describe_db_instances.return_value={'DBInstances':[{'DBInstanceStatus':'available','MasterUserSecret':{'SecretArn':'arn:aws:secretsmanager:us-east-1:682530816594:secret:rds!db-test'}}]}
  sts.get_caller_identity.return_value={'Account':account}
  ssm.describe_instance_information.return_value={'InstanceInformationList':[{'PingStatus':'Online'}]}
  session.client.side_effect=lambda name: {'sts':sts,'ssm':ssm,'rds':rds}[name]
  health=io.BytesIO(b'{"ok":true,"checks":{"mysql":"ok","mongo":"ok"}}');health.status=200
  self.invoke=Mock(return_value=output)
  with patch.object(cloud,'ROOT',root),patch.object(cloud,'check_package',return_value={'backend_commit':'fixed'}),patch.dict(sys.modules,{'boto3':types.SimpleNamespace(Session=lambda **kw:session)}),patch.object(cloud,'transfer_backend',return_value='/var/tmp/test'),patch.object(cloud,'invoke',self.invoke),patch.object(cloud.urllib.request,'urlopen',return_value=health),patch.object(sys,'argv',['desplegar_aws.py']+(['--apply'] if apply else [])):
   try: cloud.main()
   finally:
    reports=list(root.glob('resultado-*.json'))
    self.report=json.loads(reports[0].read_text()) if reports else None
 def tearDown(self):
  if hasattr(self,'t'): self.t.cleanup()
 def test_requires_stale_password_probe_before_success(self):
  with self.assertRaisesRegex(RuntimeError,'PRUEBA_ROTACION_NO_VERIFICADA'):
   self.execute('INTEGRACION_ROTACION_REAL=OK\nBACKEND_ROTACION_DESPLEGADO=fixed')
  self.assertFalse(self.report['completed'])
 def test_backend_failure_never_reports_success(self):
  with self.assertRaisesRegex(RuntimeError,'BACKEND_NO_CONFIRMADO'):
   self.execute('INTEGRACION_ROTACION_REAL=OK\nMYSQL_STALE_PASSWORD_RECOVERED=OK')
  self.assertFalse(self.report['completed'])
 def test_success_requires_commit_and_rotation_probe(self):
  self.execute('INTEGRACION_ROTACION_REAL=OK\nMYSQL_STALE_PASSWORD_RECOVERED=OK\nBACKEND_ROTACION_DESPLEGADO=fixed')
  self.assertTrue(self.report['completed'])
 def test_check_mode_never_passes_apply(self):
  self.execute('INTEGRACION_ROTACION_REAL=OK\nMYSQL_STALE_PASSWORD_RECOVERED=OK',apply=False)
  self.assertNotIn('--apply',self.invoke.call_args.args[1][0]);self.assertFalse(self.report['completed'])
 def test_wrong_account_rejected_before_transfer(self):
  with self.assertRaisesRegex(RuntimeError,'CUENTA_AWS_INCORRECTA'):
   self.execute('',account='wrong')
 def test_already_deployed_can_complete_after_probe(self):
  self.execute('INTEGRACION_ROTACION_REAL=OK\nMYSQL_STALE_PASSWORD_RECOVERED=OK\nBACKEND_YA_ACTUALIZADO=SI')
  self.assertTrue(self.report['completed'])

if __name__=='__main__':unittest.main()
