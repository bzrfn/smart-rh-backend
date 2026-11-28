"""Controles de dependencias con evidencia sin credenciales."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path


def audit_result(data, code):
    if code not in (0, 1) or not isinstance(data, dict) or data.get('error'):
        raise ValueError('La auditoría no concluyó; no se acepta como aprobada')
    counts = data.get('metadata', {}).get('vulnerabilities', {})
    if not all(type(counts.get(k)) is int and counts[k] >= 0 for k in ('low', 'moderate', 'high', 'critical')):
        raise ValueError('La respuesta de npm audit carece de conteos válidos')
    if not isinstance(data.get('vulnerabilities'), dict):
        raise ValueError('Falta el inventario de vulnerabilidades')
    if code == 1 and not any(counts[k] for k in ('low', 'moderate', 'high', 'critical')):
        raise ValueError('npm audit devolvió un fallo sin hallazgos interpretables')
    return {k: counts[k] for k in ('low', 'moderate', 'high', 'critical')}


def execute(root, output):
    root = root.resolve()
    output.mkdir(parents=True, exist_ok=True)
    lock = root / 'package-lock.json'
    if not lock.is_file():
        raise ValueError('Se requiere package-lock.json')
    report = {'schema': 1, 'status': 'error', 'scope': 'produccion',
              'created_at': datetime.now(timezone.utc).isoformat(),
              'lock_sha256': hashlib.sha256(lock.read_bytes()).hexdigest()}
    try:
        result = subprocess.run(['npm', 'audit', '--omit=dev', '--json'], cwd=root,
                                capture_output=True, text=True, timeout=180)
        counts = audit_result(json.loads(result.stdout), result.returncode)
        report['vulnerabilities'] = counts
        report['findings'] = [
            {'package': name, 'severity': item.get('severity'), 'direct': item.get('isDirect') is True,
             'range': item.get('range'), 'fix_available': item.get('fixAvailable', False)}
            for name, item in json.loads(result.stdout)['vulnerabilities'].items()
            if item.get('severity') in ('high', 'critical')]
        # No se conserva el JSON de npm: puede contener información del registro privado.
        report['status'] = 'blocked' if counts['high'] or counts['critical'] else 'passed'
        with (output / 'sbom.cdx.json').open('w') as stream:
            bom = subprocess.run(['npm', 'sbom', '--sbom-format=cyclonedx',
                                  '--package-lock-only', '--omit=dev'], cwd=root,
                                 stdout=stream, stderr=subprocess.PIPE, text=True, timeout=180)
        if bom.returncode:
            raise ValueError('No se pudo generar la lista de componentes')
        parsed = json.loads((output / 'sbom.cdx.json').read_text())
        if parsed.get('bomFormat') != 'CycloneDX' or not isinstance(parsed.get('components'), list):
            raise ValueError('SBOM incompleta o de formato desconocido')
        report['sbom_sha256'] = hashlib.sha256((output / 'sbom.cdx.json').read_bytes()).hexdigest()
    except (ValueError, OSError, subprocess.TimeoutExpired):
        report['status'] = 'error'
        raise
    finally:
        (output / 'dependencias.json').write_text(json.dumps(report, indent=2) + '\n')
    print('DEPENDENCIAS=' + report['status'].upper())
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path('.'))
    parser.add_argument('--out', type=Path, default=Path('informes-ci/profesional'))
    args = parser.parse_args()
    try:
        raise SystemExit(execute(args.root, args.out))
    except (ValueError, OSError, subprocess.TimeoutExpired):
        raise SystemExit('DEPENDENCIAS=ERROR; consulta el reporte y revisa el registro npm')
