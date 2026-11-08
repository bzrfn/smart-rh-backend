#!/usr/bin/env python3
"""Se ejecuta por SSM: valida y cambia solo los módulos declarados en el manifiesto."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request
import uuid

BACKEND = Path('/opt/smarth/backend')
CONF = Path('/etc/smarth/backend.conf')
START = Path('/opt/smarth/bin/start-backend.sh')
SERVICE = 'smarth-backend.service'
LOCK_FILE = Path('/var/lock/smartrh-invitations-deploy.lock')
BACKUP_ROOT = Path('/opt/smarth/backups')
DROPIN = Path('/etc/systemd/system/smarth-backend.service.d/20-rds-secret-refresh.conf')
ROOT = Path(__file__).resolve().parent

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def cmd(args, **kwargs): return subprocess.run(args, check=True, capture_output=True, text=True, **kwargs)
def require(condition, code):
    if not condition: raise RuntimeError(code)
def runtime():
    pid = cmd(['systemctl','show',SERVICE,'-p','MainPID','--value']).stdout.strip()
    require(pid.isdigit() and int(pid)>0, 'BACKEND_NO_ACTIVO')
    env = os.environ.copy()
    for entry in Path('/proc/'+pid+'/environ').read_bytes().split(b'\0'):
        k, sep, value = entry.partition(b'=')
        if sep: env[k.decode()] = value.decode()
    cwd = Path('/proc/'+pid+'/cwd').resolve()
    require(cwd == BACKEND.resolve(), 'DIRECTORIO_BACKEND_NO_RECONOCIDO')
    require(b'dist/server.js' in Path('/proc/'+pid+'/cmdline').read_bytes(), 'PROCESO_NO_RECONOCIDO')
    env['DB_NODE_EXECUTABLE']=str(Path('/proc/'+pid+'/exe').resolve())
    identity=Path('/proc/'+pid).stat(); env['DB_PROBE_UID']=str(identity.st_uid); env['DB_PROBE_GID']=str(identity.st_gid)
    return env

def health():
    try:
        with urllib.request.urlopen('http://127.0.0.1:4000/health', timeout=3) as response:
            return response.status == 200 and json.load(response).get('ok') is True
    except Exception: return False

def wait_health():
    for _ in range(30):
        if health() and cmd(['systemctl','is-active',SERVICE]).stdout.strip()=='active': return
        time.sleep(2)
    raise RuntimeError('HEALTH_NO_RESPONDE')

def run_probe(candidate, env):
    result = subprocess.run([env['DB_NODE_EXECUTABLE'],str(ROOT/'invitation_probe.mjs'),str(candidate),'--migrate'], cwd=candidate,
        env=env, text=True, capture_output=True, timeout=120,
        user=int(env.get('DB_PROBE_UID',os.getuid())), group=int(env.get('DB_PROBE_GID',os.getgid())), extra_groups=[])
    for line in result.stdout.splitlines():
        if line.startswith(('MIGRACION_', 'INVITACION_', 'INVITATION_', 'LIMPIEZA_', 'INTEGRACION_', 'SMTP_')): print(line, flush=True)
    require(result.returncode==0 and 'INTEGRACION_INVITACIONES_REAL=OK' in result.stdout, 'PRUEBA_INVITACIONES_FALLO')

def ready():
    try:
        with urllib.request.urlopen('http://127.0.0.1:4000/ready', timeout=7) as response:
            body=json.load(response)
            return response.status==200 and body.get('ok') is True and body.get('checks')=={'mysql':'ok','mongo':'ok'}
    except Exception: return False

def wait_ready():
    for _ in range(20):
        if ready(): return
        time.sleep(2)
    raise RuntimeError('READINESS_NO_RESPONDE')

def atomic_copy(source, target, mode=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_name(target.name+'.rotation-'+uuid.uuid4().hex)
    shutil.copy2(source,temp)
    if mode: os.chmod(temp,mode)
    elif target.exists():
        info=target.stat(); os.chown(temp,info.st_uid,info.st_gid); os.chmod(temp,info.st_mode & 0o777)
    os.replace(temp,target)

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--apply',action='store_true'); parser.add_argument('--run-id',required=True)
    args=parser.parse_args(); require(len(args.run_id)==32 and all(c in '0123456789abcdef' for c in args.run_id),'RUN_ID_INVALIDO')
    manifest=json.loads((ROOT/'manifest.json').read_text())
    for name,digest in manifest['payload_files'].items(): require(sha(ROOT/name)==digest,'PAQUETE_EC2_ALTERADO')
    with LOCK_FILE.open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX | fcntl.LOCK_NB)
        deploy_locked(args,manifest)

def deploy_locked(args,manifest):
    require(not BACKEND.is_symlink(), 'BACKEND_SYMLINK_REQUIERE_REVISION')
    require(CONF.is_file() and START.is_file(), 'CONFIGURACION_NO_RECONOCIDA')
    conf_hash, start_hash=sha(CONF),sha(START)
    require(str(CONF) in START.read_text(),'ARRANQUE_NO_RECONOCIDO')
    env=runtime(); require(bool(env.get('MONGO_URI')),'MONGO_NO_CONFIGURADO')
    require(bool(env.get('DB_SECRET_ARN')) and DROPIN.is_file(), 'CORRECCION_ROTACION_NO_PRESENTE')
    dropin_hash=sha(DROPIN)
    require(args.apply, 'USA_APPLY_PARA_MIGRACION_Y_PRUEBA_AISLADA')
    require(health(),'HEALTH_PREVIO_FALLO')
    node=int(cmd([env.get('DB_NODE_EXECUTABLE','node'),'-p','process.versions.node.split(".")[0]']).stdout.strip()); require(node>=20,'NODE_REQUIERE_VERSION_20_O_SUPERIOR')
    for name,digest in manifest['dependencies'].items(): require((BACKEND/name).is_file() and sha(BACKEND/name)==digest,'DEPENDENCIAS_PRODUCCION_DIFIEREN_'+name)
    original_hashes={}
    require(not (BACKEND/'dist').is_symlink(),'DIST_SYMLINK_REQUIERE_REVISION')
    require(not (BACKEND/'DEPLOYED_INVITATIONS_COMMIT').is_symlink(),'MARCADOR_SYMLINK_NO_PERMITIDO')
    for relative,info in manifest['backend_files'].items():
        path=BACKEND/relative
        require(not path.is_symlink(),'MODULO_SYMLINK_REQUIERE_REVISION')
        existing=sha(path) if path.exists() else None
        original_hashes[relative]=existing
        require(existing in (info['before'],info['after']), 'MODULO_PRODUCCION_DIFIERE_'+relative)
    print('PRECHECK_BACKEND=OK',flush=True)
    if not (ROOT/'node_modules').exists(): (ROOT/'node_modules').symlink_to(BACKEND/'node_modules',target_is_directory=True)
    candidate=ROOT/'candidate'; require(not candidate.exists(),'CANDIDATO_YA_EXISTE')
    shutil.copytree(BACKEND/'dist',candidate/'dist')
    shutil.copy2(BACKEND/'package.json',candidate/'package.json')
    (candidate/'node_modules').symlink_to(BACKEND/'node_modules',target_is_directory=True)
    with tarfile.open(ROOT/'backend-modules.tar.gz','r:gz') as archive:
        allowed=set(manifest['backend_files'])
        for member in archive.getmembers():
            require(member.isfile() and member.name in allowed,'ARCHIVO_NO_PERMITIDO_EN_PAQUETE')
            destination=candidate/member.name; destination.parent.mkdir(parents=True,exist_ok=True)
            destination.write_bytes(archive.extractfile(member).read())
    for name,info in manifest['backend_files'].items(): require(sha(candidate/name)==info['after'],'CANDIDATO_HASH_DIFIERE')
    # The probe runs as the service user; this staging tree contains code and metadata only.
    ROOT.chmod(0o755)
    for path in candidate.rglob('*'):
        if not path.is_symlink(): os.chmod(path,0o755 if path.is_dir() else 0o644)
    candidate.chmod(0o755)
    try:
        run_probe(candidate,env)
        print('PREVALIDACION_INVITACIONES=OK',flush=True)
        if not args.apply:
            print('MODO=SOLO_VALIDACION; CODIGO_ACTIVO_SIN_CAMBIOS',flush=True); return
        # Revalida antes de detener el servicio.
        require(sha(CONF)==conf_hash and sha(START)==start_hash,'CONFIGURACION_CAMBIO_DURANTE_VALIDACION')
        for name,info in manifest['backend_files'].items():
            target=BACKEND/name
            require((sha(target) if target.exists() else None) == original_hashes[name],'MODULO_CAMBIO_DURANTE_VALIDACION')
        marker=BACKEND/'DEPLOYED_INVITATIONS_COMMIT'
        already=all((BACKEND/name).is_file() and sha(BACKEND/name)==info['after'] for name,info in manifest['backend_files'].items())
        if already and marker.is_file() and marker.read_text().strip()==manifest['backend_commit']:
            require(sha(DROPIN)==dropin_hash,'ROTACION_MODIFICADA')
            wait_ready(); print('BACKEND_YA_ACTUALIZADO=SI',flush=True); return
        backup=BACKUP_ROOT/('invitations-'+args.run_id); backup.mkdir(parents=True,exist_ok=False); os.chmod(backup,0o700)
        before={}
        for name in [*manifest['backend_files'],'DEPLOYED_INVITATIONS_COMMIT']:
            source=BACKEND/name; before[name]=source.exists()
            if source.exists():
                destination=backup/name; destination.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(source,destination)
        (backup/'restauracion.json').write_text(json.dumps(before)); print('BACKUP_BACKEND='+str(backup),flush=True)
        stopped=False
        try:
            require(sha(DROPIN)==dropin_hash,'ROTACION_MODIFICADA')
            stopped=True; cmd(['systemctl','stop',SERVICE])
            for name in manifest['backend_files']: atomic_copy(candidate/name,BACKEND/name)
            for name,info in manifest['backend_files'].items(): require(sha(BACKEND/name)==info['after'],'HASH_INSTALACION_DIFIERE_'+name)
            temp=ROOT/'commit.txt'; temp.write_text(manifest['backend_commit']+'\n'); atomic_copy(temp,marker,0o644)
            cmd(['systemctl','daemon-reload']); cmd(['systemctl','start',SERVICE]); wait_health(); wait_ready()
            require(sha(CONF)==conf_hash and sha(START)==start_hash,'CONFIGURACION_MODIFICADA')
            require(sha(DROPIN)==dropin_hash,'ROTACION_MODIFICADA')
            print('BACKEND_INVITACIONES_DESPLEGADO='+manifest['backend_commit'],flush=True)
            print('READINESS_LOCAL=OK',flush=True)
            print('ROTACION_AUTOMATICA=CONSERVADA',flush=True)
            (ROOT/'backend-result.json').write_text(json.dumps({'ok':True,'commit':manifest['backend_commit'],'backup':str(backup)}))
        except BaseException:
            if stopped:
                try:
                    cmd(['systemctl','stop',SERVICE])
                    for name,existed in before.items():
                        if existed: atomic_copy(backup/name,BACKEND/name)
                        else: (BACKEND/name).unlink(missing_ok=True)
                    cmd(['systemctl','daemon-reload']); cmd(['systemctl','start',SERVICE]); wait_health(); print('ROLLBACK_BACKEND=OK',flush=True)
                except Exception:
                    print('ROLLBACK_BACKEND=REQUIERE_REVISION; respaldo='+str(backup),flush=True)
                    raise RuntimeError('RECUPERACION_BACKEND_REQUIERE_REVISION')
            raise
    finally:
        shutil.rmtree(candidate,ignore_errors=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        message=str(error) if isinstance(error,RuntimeError) else type(error).__name__
        print('DESPLIEGUE_DETENIDO='+message,flush=True); sys.exit(1)
