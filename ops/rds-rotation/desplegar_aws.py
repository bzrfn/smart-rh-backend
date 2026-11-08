#!/usr/bin/env python3
"""Corrección RDS: prueba del mensaje compuesto en Mongo, respaldo y despliegue EC2."""
import argparse
import base64
import hashlib
import io
import json
import shlex
from pathlib import Path
import sys
import tarfile
import time
import urllib.request
import uuid

ROOT=Path(__file__).resolve().parent
REGION='us-east-1'
ACCOUNT='682530816594'
INSTANCE='i-017f10e3aa6972721'

def digest(data): return hashlib.sha256(data).hexdigest()
def require(value,code):
    if not value: raise RuntimeError(code)

def check_package():
    for name,expected in json.loads((ROOT/'SHA256.json').read_text()).items():
        require(digest((ROOT/name).read_bytes())==expected,'PAQUETE_ALTERADO_'+name)
    manifest=json.loads((ROOT/'manifest.json').read_text())
    print('PAQUETE_VERIFICADO=OK',flush=True)
    return manifest

def invoke(ssm,commands,report,label):
    result=ssm.send_command(InstanceIds=[INSTANCE],DocumentName='AWS-RunShellScript',Comment='SMART RH RDS: '+label,
        Parameters={'commands':commands,'executionTimeout':['600']},TimeoutSeconds=120)
    cid=result['Command']['CommandId']; report['last_ssm']=cid
    print('SSM_'+label.upper().replace(' ','_')+'='+cid,flush=True)
    deadline=time.monotonic()+660
    while time.monotonic()<deadline:
        try: invocation=ssm.get_command_invocation(CommandId=cid,InstanceId=INSTANCE)
        except ssm.exceptions.InvocationDoesNotExist: time.sleep(2); continue
        if invocation['Status'] in ['Pending','InProgress','Delayed']: time.sleep(2); continue
        output=invocation.get('StandardOutputContent',''); print(output,flush=True)
        require(invocation['Status']=='Success','SSM_FALLO_'+label.upper().replace(' ','_'))
        return output
    raise RuntimeError('SSM_CONTINUA_EN_EJECUCION_CONSULTAR_'+cid)

def transfer_backend(ssm,report,run_id):
    names=['manifest.json','remote_deploy.py','rotation_probe.mjs','backend-modules.tar.gz']
    content=io.BytesIO()
    with tarfile.open(fileobj=content,mode='w:gz') as archive:
        for name in names: archive.add(ROOT/name,arcname=name,recursive=False)
    payload=content.getvalue(); directory='/var/tmp/smartrh-rotation-'+run_id
    chunks=[payload[i:i+6000] for i in range(0,len(payload),6000)]
    # Cada comando se mantiene pequeño; el código no contiene secretos.
    for index,chunk in enumerate(chunks):
        code="from pathlib import Path\nimport base64\np=Path("+repr(directory)+")\n"
        if index==0: code+="p.mkdir(mode=0o700,exist_ok=False)\n"
        code+="target=p/"+repr(f'part-{index:04d}')+"\nwith target.open('xb') as f: f.write(base64.b64decode("+repr(base64.b64encode(chunk).decode())+"))\nprint('TRANSFERENCIA_PARCIAL=OK')\n"
        invoke(ssm,["python3 - <<'PY'\n"+code+"PY"],report,'transferencia '+str(index+1))
    report['remote_directory']=directory
    code="from pathlib import Path\nimport tarfile,io,hashlib\np=Path("+repr(directory)+")\ndata=b''.join((p/f'part-{i:04d}').read_bytes() for i in range("+str(len(chunks))+"))\nassert hashlib.sha256(data).hexdigest()=="+repr(digest(payload))+"\nallowed="+repr(set(names))+"\nwith tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:\n assert set(archive.getnames())==allowed\n for item in archive.getmembers():\n  assert item.isfile() and item.name in allowed\n  (p/item.name).write_bytes(archive.extractfile(item).read())\nprint('PAQUETE_EC2_VERIFICADO=OK')\n"
    invoke(ssm,["python3 - <<'PY'\n"+code+"PY"],report,'verificacion transferencia')
    return directory

def main():
    parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--apply',action='store_true'); parser.add_argument('--check-package',action='store_true')
    args=parser.parse_args(); manifest=check_package()
    if args.check_package: return
    import boto3
    session=boto3.Session(region_name=REGION)
    require(session.client('sts').get_caller_identity()['Account']==ACCOUNT,'CUENTA_AWS_INCORRECTA')
    db=session.client('rds').describe_db_instances(DBInstanceIdentifier='smarth-rh-mariadb')['DBInstances'][0]
    require(db['DBInstanceStatus']=='available','RDS_NO_DISPONIBLE')
    secret=db.get('MasterUserSecret',{}).get('SecretArn')
    require(bool(secret),'RDS_SIN_SECRETO_ADMINISTRADO')
    ssm=session.client('ssm')
    info=ssm.describe_instance_information(Filters=[{'Key':'InstanceIds','Values':[INSTANCE]}])['InstanceInformationList']
    require(info and info[0]['PingStatus']=='Online','EC2_NO_DISPONIBLE_POR_SSM')
    run_id=uuid.uuid4().hex; report={'run_id':run_id,'backend_commit':manifest['backend_commit'],'completed':False}
    report_path=ROOT/('resultado-'+run_id+'.json')
    try:
        directory=transfer_backend(ssm,report,run_id)
        command='python3 '+directory+'/remote_deploy.py --run-id '+run_id+' --secret-arn '+shlex.quote(secret)+(' --apply' if args.apply else '')
        output=invoke(ssm,[command],report,'backend')
        require('INTEGRACION_ROTACION_REAL=OK' in output and 'MYSQL_STALE_PASSWORD_RECOVERED=OK' in output,'PRUEBA_ROTACION_NO_VERIFICADA')
        if not args.apply:
            print('VALIDACION_PREVIA=OK; ejecuta con --apply para desplegar.',flush=True); return
        require('BACKEND_ROTACION_DESPLEGADO='+manifest['backend_commit'] in output or 'BACKEND_YA_ACTUALIZADO=SI' in output,'BACKEND_NO_CONFIRMADO')
        report['backend_deployed']=True
        with urllib.request.urlopen('https://api.smart-rh.com.mx/ready',timeout=15) as response:
            require(response.status==200 and (body:=json.load(response)).get('ok') is True and body.get('checks')=={'mysql':'ok','mongo':'ok'},'HEALTH_PUBLICO_FALLO')
        print('READINESS_PUBLICO=OK',flush=True)
        report['completed']=True
        print('DESPLIEGUE_ROTACION_COMPLETADO=OK',flush=True)
        print('Pendiente: comprobar el inicio de sesión y los módulos desde el portal.',flush=True)
    finally:
        report_path.write_text(json.dumps(report,indent=2)+'\n'); print('REPORTE='+str(report_path),flush=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        if isinstance(error,RuntimeError): message=str(error)
        elif hasattr(error,'response'): message='AWS_'+error.response.get('Error',{}).get('Code','ERROR')
        else: message=type(error).__name__
        print('DESPLIEGUE_DETENIDO='+message,file=sys.stderr); sys.exit(1)
