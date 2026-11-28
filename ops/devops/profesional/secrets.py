"""Escanea secretos sin publicar valores ni la salida cruda del detector."""
import argparse
import hashlib
import io
import json
import platform
import subprocess
import tarfile
import tempfile
import urllib.request
from pathlib import Path

VERSION = '8.30.1'
DIGESTS = {
    ('Linux', 'x86_64'): ('linux_x64', '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'),
    ('Linux', 'aarch64'): ('linux_arm64', 'e4a487ee7ccd7d3a7f7ec08657610aa3606637dab924210b3aee62570fb4b080'),
    ('Darwin', 'arm64'): ('darwin_arm64', 'b40ab0ae55c505963e365f271a8d3846efbc170aa17f2607f13df610a9aeb6a5'),
    ('Darwin', 'x86_64'): ('darwin_x64', 'dfe101a4db2255fc85120ac7f3d25e4342c3c20cf749f2c20a18081af1952709'),
}


def unpack(blob, expected, target):
    if hashlib.sha256(blob).hexdigest() != expected:
        raise ValueError('El ejecutable descargado no coincide con la huella fijada')
    with tarfile.open(fileobj=io.BytesIO(blob), mode='r:gz') as archive:
        binary = archive.getmember('gitleaks')
        if not binary.isfile() or not 0 < binary.size < 150_000_000:
            raise ValueError('Ejecutable inesperado')
        with archive.extractfile(binary) as reader:
            target.write_bytes(reader.read())
    target.chmod(0o700)


def sanitize(data):
    if not isinstance(data, list) or any(not isinstance(x, dict) for x in data):
        raise ValueError('Reporte de secretos inválido')
    # La salida deliberadamente excluye Secret, Match, Message y Fingerprint.
    return [{k: finding.get(k) for k in ('RuleID', 'File', 'StartLine', 'Commit')} for finding in data]


def exclude_reviewed(data, catalog):
    if not isinstance(catalog, dict) or catalog.get('schema') != 1 or not isinstance(catalog.get('entries'), list):
        raise ValueError('Registro de revisión inválido')
    keys = ('RuleID', 'File', 'StartLine', 'Commit')
    approved = set()
    for entry in catalog['entries']:
        if not entry.get('reason') or len(entry.get('match_sha256', '')) != 64 or not entry.get('Commit'):
            raise ValueError('Falta la justificación o la identidad de una revisión')
        approved.add(tuple(entry.get(k) for k in keys) + (entry['match_sha256'],))
    remaining = [x for x in data if tuple(x.get(k) for k in keys) + (hashlib.sha256(x.get('Match', '').encode()).hexdigest(),) not in approved]
    return remaining, len(data) - len(remaining)


def execute(root, output, mode):
    root = root.resolve()
    output.mkdir(parents=True, exist_ok=True)
    result = {'schema': 1, 'status': 'error', 'scanner': 'gitleaks', 'version': VERSION, 'scope': mode}
    try:
        label, checksum = DIGESTS[(platform.system(), platform.machine())]
        with tempfile.TemporaryDirectory(prefix='smartrh-scan-') as temp:
            temp = Path(temp)
            binary = temp / 'gitleaks'
            url = f'https://github.com/gitleaks/gitleaks/releases/download/v{VERSION}/gitleaks_{VERSION}_{label}.tar.gz'
            with urllib.request.urlopen(url, timeout=60) as response:
                blob = response.read(50_000_001)
            if len(blob) > 50_000_000:
                raise ValueError('Descarga demasiado grande')
            unpack(blob, checksum, binary)
            (temp / 'config.toml').write_text('[extend]\nuseDefault = true\n')
            (temp / 'ignore').write_text('')
            raw = temp / 'raw.json'
            command = [str(binary), mode, str(root), '--no-banner', '--no-color', '--redact=100',
                       '--exit-code=10', '--timeout=300', '--ignore-gitleaks-allow',
                       '--gitleaks-ignore-path', str(temp / 'ignore'), '--config', str(temp / 'config.toml'),
                       '--report-format=json', '--report-path', str(raw)]
            proc = subprocess.run(command, capture_output=True, timeout=330)
            if proc.returncode not in (0, 10) or not raw.is_file():
                raise ValueError('La herramienta no completó el análisis')
            raw_data = json.loads(raw.read_text())
            sanitize(raw_data)
            if (proc.returncode == 0) != (len(raw_data) == 0):
                raise ValueError('Resultado de secretos inconsistente')
            catalog_path = Path(__file__).with_name('falsos_positivos_secretos.json')
            remaining, reviewed = exclude_reviewed(raw_data, json.loads(catalog_path.read_text())) if catalog_path.is_file() else (raw_data, 0)
            findings = sanitize(remaining)
            result.update(status='blocked' if findings else 'passed', count=len(findings), findings=findings,
                          reviewed_false_positives=reviewed, raw_count=len(raw_data))
    finally:
        (output / 'secretos.json').write_text(json.dumps(result, indent=2) + '\n')
    print('SECRETOS=' + result['status'].upper())
    return 0 if result['status'] == 'passed' else 1


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--root', type=Path, default=Path('.'))
    p.add_argument('--out', type=Path, default=Path('informes-ci/profesional'))
    p.add_argument('--mode', choices=['git', 'dir'], default='git')
    a = p.parse_args()
    try:
        raise SystemExit(execute(a.root, a.out, a.mode))
    except Exception:
        raise SystemExit('SECRETOS=ERROR; no se publican detalles que puedan revelar valores')
