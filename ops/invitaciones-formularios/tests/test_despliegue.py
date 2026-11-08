import importlib.util, unittest, tempfile, json, hashlib, io, tarfile, types, sys
from pathlib import Path
from unittest.mock import patch, Mock

BASE=Path(__file__).resolve().parents[1]
def load(name,file):
 s=importlib.util.spec_from_file_location(name,BASE/file);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
cloud=load('deploycloud','desplegar_aws.py');remote=load('deployremote','remote_deploy.py')
sha=lambda b:hashlib.sha256(b).hexdigest()
class Err(Exception):
 def __init__(self,code):self.response={'Error':{'Code':code}}
class S3:
 def __init__(self,data):
  self.data={k:{'bytes':v,'ETag':sha(v),'ContentType':'text/html','CacheControl':'no-cache','Metadata':{}} for k,v in data.items()};self.writes=[];self.fail_key=None
  self.meta=types.SimpleNamespace(service_model=types.SimpleNamespace(operation_model=lambda n:types.SimpleNamespace(input_shape=types.SimpleNamespace(members={'IfMatch':1,'IfNoneMatch':1}))))
 def get_object(self,Bucket,Key):
  if Key not in self.data:raise Err('NoSuchKey')
  v=self.data[Key];return {k:x for k,x in v.items() if k!='bytes'}|{'Body':io.BytesIO(v['bytes'])}
 def put_object(self,Bucket,Key,Body,**kw):
  if Key==self.fail_key:self.fail_key=None;raise Err('InternalError')
  old=self.data.get(Key)
  if kw.get('IfNoneMatch')=='*' and old:raise Err('PreconditionFailed')
  if 'IfMatch' in kw and (not old or old['ETag']!=kw['IfMatch']):raise Err('PreconditionFailed')
  self.data[Key]={'bytes':Body,'ETag':sha(Body),**{k:v for k,v in kw.items() if not k.startswith('If')}};self.writes.append(Key);return {'ETag':sha(Body)}
 def copy_object(self,Bucket,Key,CopySource,CopySourceIfMatch):
  old=self.data[CopySource['Key']]
  if old['ETag']!=CopySourceIfMatch:raise Err('PreconditionFailed')
  self.data[Key]=old.copy()
class CF:
 def __init__(self):self.fail=False
 def get_distribution(self,Id):return {'Distribution':{'DistributionConfig':{'Aliases':{'Items':['portal.smart-rh.com.mx']},'Origins':{'Items':[{'DomainName':cloud.BUCKET+'.s3.amazonaws.com'}]}}}}
 def create_invalidation(self,**kwargs):
  if self.fail:self.fail=False;raise Err('AccessDenied')
  return {'Invalidation':{'Id':'test'}}
class CloudTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();self.root=Path(self.t.name);self.oldroot=cloud.ROOT;cloud.ROOT=self.root
  (self.root/'web-dist/assets').mkdir(parents=True)
  self.new={'index.html':b'NEWINDEX','privacidad.html':b'NEWPRIVACY','assets/app.js':b'NEWJS'}
  self.old={'index.html':b'OLDINDEX','privacidad.html':b'OLDPRIVACY','assets/old.js':b'OLDJS'}
  for k,v in self.new.items(): (self.root/'web-dist'/k).write_bytes(v)
  self.manifest={'portal_commit':'fixed','web_files':{k:sha(v) for k,v in self.new.items()},'web_baseline':{k:[sha(v)] for k,v in self.old.items() if not k.startswith('assets/')}}
  self.s3=S3(self.old);self.cf=CF()
 def tearDown(self):cloud.ROOT=self.oldroot;self.t.cleanup()
 def test_publishes_index_last_preserves_old_assets_and_backup(self):
  before=cloud.portal_preflight(self.s3,self.cf,self.manifest);report={}
  cloud.publish_portal(self.s3,self.cf,self.manifest,before,'abc',report)
  self.assertEqual(self.s3.writes[-1],'index.html');self.assertEqual(self.s3.data['index.html']['bytes'],b'NEWINDEX')
  self.assertEqual(self.s3.data['assets/old.js']['bytes'],b'OLDJS');self.assertEqual(self.s3.data['backups/invitaciones/abc/index.html']['bytes'],b'OLDINDEX')
 def test_unknown_publication_rejected_before_write(self):
  self.s3.data['index.html']['bytes']=b'UNREVIEWED'
  with self.assertRaises(RuntimeError):cloud.portal_preflight(self.s3,self.cf,self.manifest)
  self.assertFalse(self.s3.writes)
 def test_asset_collision_rejected(self):
  self.s3.data['assets/app.js']={'bytes':b'BAD','ETag':'bad'}
  with self.assertRaises(RuntimeError):cloud.portal_preflight(self.s3,self.cf,self.manifest)
 def test_concurrent_change_preserved(self):
  before=cloud.portal_preflight(self.s3,self.cf,self.manifest)
  self.s3.data['index.html']={'bytes':b'OTHER','ETag':'other'}
  with self.assertRaises(RuntimeError):cloud.publish_portal(self.s3,self.cf,self.manifest,before,'abc',{})
  self.assertEqual(self.s3.data['index.html']['bytes'],b'OTHER')
 def test_failed_index_upload_restores_own_html(self):
  before=cloud.portal_preflight(self.s3,self.cf,self.manifest);self.s3.fail_key='index.html';report={}
  with self.assertRaises(Err):cloud.publish_portal(self.s3,self.cf,self.manifest,before,'abc',report)
  self.assertEqual(self.s3.data['privacidad.html']['bytes'],b'OLDPRIVACY');self.assertEqual(self.s3.data['index.html']['bytes'],b'OLDINDEX');self.assertEqual(report['portal_rollback'],'OK')
 def test_failed_invalidation_restores_previous_index(self):
  before=cloud.portal_preflight(self.s3,self.cf,self.manifest);self.cf.fail=True;report={}
  with self.assertRaises(Err):cloud.publish_portal(self.s3,self.cf,self.manifest,before,'abc',report)
  self.assertEqual(self.s3.data['index.html']['bytes'],b'OLDINDEX');self.assertEqual(report['portal_rollback'],'OK')
class RemoteTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();t=Path(self.t.name);self.troot=t
  self.orig={n:getattr(remote,n) for n in ['ROOT','BACKEND','CONF','START','LOCK_FILE','BACKUP_ROOT','DROPIN']}
  remote.ROOT=t/'package';remote.ROOT.mkdir();remote.BACKEND=t/'backend';(remote.BACKEND/'dist/modules/chatbot').mkdir(parents=True)
  remote.CONF=t/'conf';remote.CONF.write_text('SMTP_SETTINGS_UNCHANGED');remote.START=t/'start';remote.START.write_text(str(remote.CONF))
  remote.DROPIN=t/'dropin';remote.DROPIN.write_text('RDS_ROTATION_UNCHANGED');
  remote.LOCK_FILE=t/'lock';remote.BACKUP_ROOT=t/'backups'
  (remote.BACKEND/'node_modules').mkdir();(remote.BACKEND/'package.json').write_text('{"type":"module"}');(remote.BACKEND/'package-lock.json').write_text('{}')
  (remote.BACKEND/'dist/server.js').write_text('unchanged')
  self.rel='dist/modules/chatbot/chatbot.controller.js';self.newrel='dist/modules/chatbot/max.session.js'
  (remote.BACKEND/self.rel).write_bytes(b'OLD')
  with tarfile.open(remote.ROOT/'backend-modules.tar.gz','w:gz') as z:
   for n,v in [(self.rel,b'NEW'),(self.newrel,b'NEWSESSION')]:
    i=tarfile.TarInfo(n);i.size=len(v);z.addfile(i,io.BytesIO(v))
  (remote.ROOT/'invitation_probe.mjs').write_text('fake-probe')
  self.manifest={'backend_commit':'fixed','backend_files':{self.rel:{'before':sha(b'OLD'),'after':sha(b'NEW')},self.newrel:{'before':None,'after':sha(b'NEWSESSION')}},'payload_files':{n:sha((remote.ROOT/n).read_bytes()) for n in ['backend-modules.tar.gz','invitation_probe.mjs']},'dependencies':{n:sha((remote.BACKEND/n).read_bytes()) for n in ['package.json','package-lock.json']}}
  (remote.ROOT/'manifest.json').write_text(json.dumps(self.manifest))
  self.commands=[]
  def cmd(args,**kwargs):self.commands.append(args);return types.SimpleNamespace(stdout='24\n')
  self.mocks=[patch.object(remote,'cmd',side_effect=cmd),patch.object(remote,'runtime',return_value={'MONGO_URI':'test-only','DB_SECRET_ARN':'test-only'}),patch.object(remote,'health',return_value=True),patch.object(remote,'wait_health'),patch.object(remote,'run_probe'),patch.object(remote,'wait_ready')]
  self.c,self.runtime,self.health,self.wait,self.probe,self.ready=[p.start() for p in self.mocks]
 def tearDown(self):
  for p in reversed(self.mocks):p.stop()
  for n,v in self.orig.items():setattr(remote,n,v)
  self.t.cleanup()
 def execute(self,apply=False):
  with patch.object(sys,'argv',['remote_deploy.py','--run-id','a'*32]+(['--apply'] if apply else [])):remote.main()
 def test_check_does_not_change_active_files_or_stop_service(self):
  with self.assertRaises(RuntimeError):self.execute()
  self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse(any(c[:2]==['systemctl','stop'] for c in self.commands))
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
  self.assertEqual((remote.BACKEND/'DEPLOYED_INVITATIONS_COMMIT').read_text().strip(),'fixed');self.assertEqual(remote.CONF.read_text(),'SMTP_SETTINGS_UNCHANGED');self.assertEqual(remote.DROPIN.read_text(),'RDS_ROTATION_UNCHANGED');self.assertEqual((remote.BACKEND/'dist/server.js').read_text(),'unchanged')
  self.assertTrue((remote.BACKUP_ROOT/('invitations-'+'a'*32)/self.rel).exists())
 def test_post_activation_failure_rolls_back_new_and_old_files(self):
  self.ready.side_effect=RuntimeError('readiness failed')
  with self.assertRaises(RuntimeError):self.execute(True)
  self.assertEqual((remote.BACKEND/self.rel).read_bytes(),b'OLD');self.assertFalse((remote.BACKEND/self.newrel).exists());self.assertFalse((remote.BACKEND/'DEPLOYED_INVITATIONS_COMMIT').exists())
 def test_already_applied_does_not_restart(self):
  (remote.BACKEND/self.rel).write_bytes(b'NEW');(remote.BACKEND/self.newrel).write_bytes(b'NEWSESSION');(remote.BACKEND/'DEPLOYED_INVITATIONS_COMMIT').write_text('fixed\n')
  self.execute(True);self.assertFalse(any(c[:2]==['systemctl','stop'] for c in self.commands))

class TransferTests(unittest.TestCase):
 def test_transfers_verify_payload_and_extract_only_expected_files(self):
  import subprocess, shutil, uuid, os
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   for name in ['manifest.json','remote_deploy.py','invitation_probe.mjs','backend-modules.tar.gz']:
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
    for name in ['manifest.json','remote_deploy.py','invitation_probe.mjs','backend-modules.tar.gz']:
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

if __name__=='__main__':unittest.main()
