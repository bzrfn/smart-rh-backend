"""Sonda acotada de disponibilidad sin reinicios ni operaciones de escritura."""
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def check(data):
    return (isinstance(data, dict) and data.get('ok') is True
            and data.get('mysql') == 'ok' and data.get('mongo') == 'ok')


def main():
    target = 'https://api.smart-rh.com.mx/ready'
    report = {'target': target, 'created_at': datetime.now(timezone.utc).isoformat(), 'attempts': []}
    opener = urllib.request.build_opener(NoRedirect())
    for attempt in range(3):
        start = time.monotonic()
        passed = False
        try:
            with opener.open(target, timeout=10) as response:
                data = json.loads(response.read(16385))
                passed = response.status == 200 and check(data)
        except Exception:
            pass
        report['attempts'].append({'passed': passed, 'elapsed_ms': round((time.monotonic() - start) * 1000)})
        if passed:
            break
        if attempt < 2:
            time.sleep(2)
    report['status'] = 'passed' if passed else 'failed'
    folder = Path('informes-ci/profesional'); folder.mkdir(parents=True, exist_ok=True)
    (folder / 'disponibilidad.json').write_text(json.dumps(report, indent=2) + '\n')
    print('DISPONIBILIDAD=' + report['status'].upper())
    return 0 if passed else 1


if __name__ == '__main__': raise SystemExit(main())
