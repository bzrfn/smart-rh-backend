#!/usr/bin/env python3
"""Invitaciones y formularios: pruebas SQL aisladas, respaldo EC2 y publicación S3 condicionada."""
import argparse
import base64
import hashlib
import io
import json
import mimetypes
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
BUCKET='smarth-rh-web-682530816594'
DISTRIBUTION='EDLKY9F4USEOH'

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
    result=ssm.send_command(InstanceIds=[INSTANCE],DocumentName='AWS-RunShellScript',Comment='SMART RH Invitaciones: '+label,
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

def get_object(s3,key):
    result=s3.get_object(Bucket=BUCKET,Key=key)
    result['bytes']=result['Body'].read()
    return result

def write_object(s3,key,data,before=None,**metadata):
    condition={'IfMatch':before['ETag']} if before else {'IfNoneMatch':'*'}
    return s3.put_object(Bucket=BUCKET,Key=key,Body=data,**condition,**metadata)

def portal_preflight(s3,cf,manifest):
    config=cf.get_distribution(Id=DISTRIBUTION)['Distribution']['DistributionConfig']
    require('portal.smart-rh.com.mx' in config.get('Aliases',{}).get('Items',[]),'CLOUDFRONT_ALIAS_NO_CORRESPONDE')
    require(any(o['DomainName'].split('.')[0]==BUCKET for o in config['Origins']['Items']),'CLOUDFRONT_ORIGEN_NO_CORRESPONDE')
    fields=s3.meta.service_model.operation_model('PutObject').input_shape.members
    require('IfMatch' in fields and 'IfNoneMatch' in fields,'BOTO3_NO_ADMITE_ESCRITURAS_CONDICIONALES')
    before={}
    for key,allowed in manifest['web_baseline'].items():
        current=get_object(s3,key)
        require(digest(current['bytes']) in allowed+[manifest['web_files'][key]],'PORTAL_PUBLICADO_DIFIERE_'+key)
        before[key]=current
    # Comprueba colisiones antes de cambiar el backend.
    for key,expected in manifest['web_files'].items():
        if not key.startswith('assets/'): continue
        try: current=get_object(s3,key)
        except Exception as error:
            code=getattr(error,'response',{}).get('Error',{}).get('Code')
            if code in ['NoSuchKey','404','NotFound']: continue
            raise
        require(digest(current['bytes'])==expected,'ASSET_EXISTENTE_DIFIERE_'+key)
    print('PRECHECK_PORTAL=OK',flush=True)
    return before

def publish_portal(s3,cf,manifest,before,run_id,report):
    prefix='backups/invitaciones/'+run_id+'/'
    report['portal_backup_prefix']=prefix
    for key,old in before.items():
        require(get_object(s3,key)['ETag']==old['ETag'],'CAMBIO_CONCURRENTE_'+key)
        s3.copy_object(Bucket=BUCKET,Key=prefix+key,CopySource={'Bucket':BUCKET,'Key':key},CopySourceIfMatch=old['ETag'])
    written={}
    try:
        for key in manifest['web_files']:
            if not key.startswith('assets/'): continue
            data=(ROOT/'web-dist'/key).read_bytes()
            try:
                write_object(s3,key,data,ContentType=mimetypes.guess_type(key)[0] or 'application/octet-stream',CacheControl='public,max-age=31536000,immutable')
            except Exception as error:
                code=getattr(error,'response',{}).get('Error',{}).get('Code')
                if code not in ['PreconditionFailed','412']: raise
                require(get_object(s3,key)['bytes']==data,'COLISION_ASSET_'+key)
        # index se publica al final, cuando todas sus dependencias están disponibles.
        keys=sorted(before,key=lambda k:k=='index.html')
        for key in keys:
            data=(ROOT/'web-dist'/key).read_bytes()
            require(get_object(s3,key)['ETag']==before[key]['ETag'],'CAMBIO_CONCURRENTE_'+key)
            if data!=before[key]['bytes']:
                result=write_object(s3,key,data,before[key],ContentType=mimetypes.guess_type(key)[0] or 'application/octet-stream',
                    CacheControl='no-cache',Metadata={**before[key].get('Metadata',{}),'invitations-portal-commit':manifest['portal_commit']})
                written[key]=result['ETag']
            require(get_object(s3,key)['bytes']==data,'VERIFICACION_S3_FALLO_'+key)
        result=cf.create_invalidation(DistributionId=DISTRIBUTION,InvalidationBatch={'Paths':{'Quantity':1,'Items':['/*']},'CallerReference':'invitations-'+run_id})
        report['invalidation']=result['Invalidation']['Id']
        print('PORTAL_S3_PUBLICADO='+manifest['portal_commit'],flush=True)
        print('INVALIDACION_CLOUDFRONT='+report['invalidation'],flush=True)
    except BaseException:
        restored=True
        for key,etag in reversed(list(written.items())):
            try:
                current=get_object(s3,key)
                require(current['ETag']==etag,'OBJETO_CAMBIO_TRAS_PUBLICACION')
                old=before[key]
                metadata={k:old[k] for k in ['ContentType','CacheControl','ContentEncoding','ContentLanguage','ContentDisposition','Metadata'] if k in old}
                write_object(s3,key,old['bytes'],current,**metadata)
            except Exception: restored=False
        if written:
            try: cf.create_invalidation(DistributionId=DISTRIBUTION,InvalidationBatch={'Paths':{'Quantity':1,'Items':['/*']},'CallerReference':'invitations-rollback-'+run_id})
            except Exception: restored=False
        report['portal_rollback']='OK' if restored else 'REQUIERE_REVISION'
        print('ROLLBACK_PORTAL='+report['portal_rollback'],flush=True)
        raise

def transfer_backend(ssm,report,run_id):
    names=['manifest.json','remote_deploy.py','invitation_probe.mjs','backend-modules.tar.gz']
    content=io.BytesIO()
    with tarfile.open(fileobj=content,mode='w:gz') as archive:
        for name in names: archive.add(ROOT/name,arcname=name,recursive=False)
    payload=content.getvalue(); directory='/var/tmp/smartrh-invitations-'+run_id
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
    ssm,s3,cf=session.client('ssm'),session.client('s3'),session.client('cloudfront')
    info=ssm.describe_instance_information(Filters=[{'Key':'InstanceIds','Values':[INSTANCE]}])['InstanceInformationList']
    require(info and info[0]['PingStatus']=='Online','EC2_NO_DISPONIBLE_POR_SSM')
    require(args.apply,'USA_APPLY_PARA_DESPLEGAR; --check-package verifica solo el archivo local')
    before=portal_preflight(s3,cf,manifest)
    run_id=uuid.uuid4().hex; report={'run_id':run_id,'backend_commit':manifest['backend_commit'],'portal_commit':manifest['portal_commit'],'completed':False}
    report_path=ROOT/('resultado-'+run_id+'.json')
    try:
        directory=transfer_backend(ssm,report,run_id)
        command='python3 '+directory+'/remote_deploy.py --run-id '+run_id+(' --apply' if args.apply else '')
        output=invoke(ssm,[command],report,'backend')
        require('INTEGRACION_INVITACIONES_REAL=OK' in output,'PRUEBA_INVITACIONES_NO_VERIFICADA')
        if not args.apply:
            print('VALIDACION_PREVIA=OK; ejecuta con --apply para desplegar.',flush=True); return
        require('BACKEND_INVITACIONES_DESPLEGADO='+manifest['backend_commit'] in output or 'BACKEND_YA_ACTUALIZADO=SI' in output,'BACKEND_NO_CONFIRMADO')
        report['backend_deployed']=True
        with urllib.request.urlopen('https://api.smart-rh.com.mx/ready',timeout=15) as response:
            require(response.status==200 and json.load(response).get('ok') is True,'READINESS_PUBLICO_FALLO')
        print('READINESS_PUBLICO=OK',flush=True)
        # Una falla de publicación conserva el backend nuevo, compatible con el portal anterior.
        publish_portal(s3,cf,manifest,before,run_id,report)
        deadline=time.monotonic()+240
        while time.monotonic()<deadline:
            if cf.get_invalidation(DistributionId=DISTRIBUTION,Id=report['invalidation'])['Invalidation']['Status']=='Completed': break
            time.sleep(3)
        else:
            report['cdn_pending']=True
            print('CDN_PROPAGACION=PENDIENTE; los objetos ya fueron publicados.',flush=True); return
        for attempt in range(5):
            try:
                with urllib.request.urlopen('https://portal.smart-rh.com.mx/?invitaciones_deploy='+run_id,timeout=15) as response:
                    public=response.read()
                if digest(public)==manifest['web_files']['index.html']: break
            except Exception: pass
            time.sleep(3)
        else: raise RuntimeError('CDN_NO_COINCIDE_CON_EL_INDEX_PUBLICADO')
        report['completed']=True
        print('PORTAL_PUBLICO_VERIFICADO=OK\nDESPLIEGUE_INVITACIONES_FORMULARIOS_COMPLETADO=OK',flush=True)
        print('Pendiente: prueba autenticada desde el portal con una cuenta de prueba.',flush=True)
    finally:
        report_path.write_text(json.dumps(report,indent=2)+'\n'); print('REPORTE='+str(report_path),flush=True)

if __name__=='__main__':
    try: main()
    except Exception as error:
        if isinstance(error,RuntimeError): message=str(error)
        elif hasattr(error,'response'): message='AWS_'+error.response.get('Error',{}).get('Code','ERROR')
        else: message=type(error).__name__
        print('DESPLIEGUE_DETENIDO='+message,file=sys.stderr); sys.exit(1)
