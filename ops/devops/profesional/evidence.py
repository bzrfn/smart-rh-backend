"""Vincula el código y los controles aprobados con un manifiesto verificable."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def produce(root, folder):
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
    if not re.fullmatch('[a-f0-9]{40}', revision):
        raise ValueError('Se requiere un commit completo de Git')
    records = {}
    for name in ('secretos.json', 'dependencias.json', 'sbom.cdx.json'):
        path = folder / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('Falta evidencia obligatoria: ' + name)
        records[name] = digest(path)
        if name.endswith('.json') and name != 'sbom.cdx.json':
            if json.loads(path.read_text()).get('status') != 'passed':
                raise ValueError('El control no está aprobado: ' + name)
    lock = root / 'package-lock.json'
    if json.loads((folder / 'dependencias.json').read_text()).get('lock_sha256') != digest(lock):
        raise ValueError('El lockfile cambió después de la auditoría')
    data = {'schema': 1, 'revision': revision, 'package_lock_sha256': digest(lock), 'files': records,
            'scope': 'Controles de secretos y dependencias; no autoriza el despliegue',
            'authenticity': 'SHA256 verifica bytes; no constituye firma digital'}
    (folder / 'manifest.json').write_text(json.dumps(data, indent=2) + '\n')
    print('EVIDENCIAS=OK; REVISION=' + revision)


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path('.'))
    p.add_argument('--out', type=Path, default=Path('informes-ci/profesional'))
    a = p.parse_args()
    produce(a.root, a.out)
