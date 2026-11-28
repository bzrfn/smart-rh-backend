import importlib.util
import io
import json
import subprocess
import tarfile
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent


def load(name):
    spec = importlib.util.spec_from_file_location('rh_' + name, HERE / (name + '.py'))
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


quality, scanner, evidence = [load(n) for n in ('quality', 'secrets', 'evidence')]


class Controls(unittest.TestCase):
    def valid_audit(self, **overrides):
        values = dict(low=0, moderate=0, high=0, critical=0)
        values.update(overrides)
        return dict(metadata=dict(vulnerabilities=values), vulnerabilities={})

    def test_clean_audit(self):
        self.assertEqual(quality.audit_result(self.valid_audit(), 0)['critical'], 0)

    def test_high_findings_preserved(self):
        self.assertEqual(quality.audit_result(self.valid_audit(high=3), 1)['high'], 3)

    def test_medium_preserved(self):
        self.assertEqual(quality.audit_result(self.valid_audit(moderate=2), 1)['moderate'], 2)

    def test_tool_failure_is_not_pass(self):
        with self.assertRaises(ValueError): quality.audit_result(self.valid_audit(), 2)

    def test_registry_failure_is_not_pass(self):
        with self.assertRaises(ValueError): quality.audit_result({'error': {'code': 'E500'}}, 1)

    def test_missing_metadata_is_not_pass(self):
        with self.assertRaises(ValueError): quality.audit_result({}, 0)

    def test_negative_count_rejected(self):
        with self.assertRaises(ValueError): quality.audit_result(self.valid_audit(high=-1), 1)

    def test_boolean_count_rejected(self):
        with self.assertRaises(ValueError): quality.audit_result(self.valid_audit(high=True), 1)

    def test_npm_failure_with_no_findings_rejected(self):
        with self.assertRaises(ValueError): quality.audit_result(self.valid_audit(), 1)

    def test_missing_inventory_rejected(self):
        data = self.valid_audit(); del data['vulnerabilities']
        with self.assertRaises(ValueError): quality.audit_result(data, 0)

    def test_secret_value_never_in_report(self):
        data = [{'RuleID': 'test', 'File': 'one.ts', 'StartLine': 4, 'Commit': 'a' * 40,
                 'Secret': 'sensitive-value', 'Match': 'sensitive-value'}]
        clean = scanner.sanitize(data)
        self.assertNotIn('sensitive-value', json.dumps(clean))

    def test_bad_secret_report_rejected(self):
        with self.assertRaises(ValueError): scanner.sanitize({})

    def test_bad_secret_record_rejected(self):
        with self.assertRaises(ValueError): scanner.sanitize([None])

    def test_tool_digest_mismatch_rejected(self):
        with tempfile.TemporaryDirectory() as t:
            with self.assertRaises(ValueError): scanner.unpack(b'changed', '0' * 64, Path(t) / 'bin')

    def test_only_binary_is_extracted(self):
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode='w:gz') as archive:
            for name in ('gitleaks', '../../outside'):
                info = tarfile.TarInfo(name); info.size = 4
                archive.addfile(info, io.BytesIO(b'test'))
        blob = stream.getvalue()
        with tempfile.TemporaryDirectory() as t:
            target = Path(t) / 'bin'
            scanner.unpack(blob, scanner.hashlib.sha256(blob).hexdigest(), target)
            self.assertEqual(target.read_bytes(), b'test')
            self.assertEqual(len(list(Path(t).iterdir())), 1)


class Evidence(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        (self.root / 'package-lock.json').write_text('{}')
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        subprocess.run(['git', '-C', str(self.root), '-c', 'user.name=Test', '-c',
                        'user.email=test@example.invalid', 'commit', '-qm', 'fixture'], check=True)
        self.out = self.root / 'reports'; self.out.mkdir()
        self.write('secretos.json', {'status': 'passed'})
        self.write('dependencias.json', {'status': 'passed', 'lock_sha256': evidence.digest(self.root / 'package-lock.json')})
        self.write('sbom.cdx.json', {'bomFormat': 'CycloneDX'})

    def write(self, name, data):
        (self.out / name).write_text(json.dumps(data))

    def test_manifest_traces_commit_and_checksums(self):
        evidence.produce(self.root, self.out)
        data = json.loads((self.out / 'manifest.json').read_text())
        self.assertEqual(len(data['revision']), 40)
        self.assertEqual(len(data['files']), 3)

    def test_changed_lockfile_rejected(self):
        (self.root / 'package-lock.json').write_text('{"changed":true}')
        with self.assertRaises(ValueError): evidence.produce(self.root, self.out)

    def test_failed_control_rejected(self):
        self.write('secretos.json', {'status': 'blocked'})
        with self.assertRaises(ValueError): evidence.produce(self.root, self.out)

    def test_missing_report_rejected(self):
        (self.out / 'secretos.json').unlink()
        with self.assertRaises(ValueError): evidence.produce(self.root, self.out)

    def test_report_symlink_rejected(self):
        (self.out / 'secretos.json').unlink()
        (self.out / 'secretos.json').symlink_to(self.out / 'dependencias.json')
        with self.assertRaises(ValueError): evidence.produce(self.root, self.out)



class ReviewedSecrets(unittest.TestCase):
    def setUp(self):
        self.item = {'RuleID': 'generic-api-key', 'File': 'ops/example.py', 'StartLine': 4, 'Commit': '1' * 40, 'Match': 'symbolic assignment'}
        self.entry = {k:self.item[k] for k in ('RuleID','File','StartLine','Commit')}
        self.entry.update(match_sha256=scanner.hashlib.sha256(self.item['Match'].encode()).hexdigest(), reason='Asignación simbólica revisada')
        self.catalog = {'schema': 1, 'entries': [self.entry]}
    def test_exact_reviewed_bytes_removed(self):
        self.assertEqual(scanner.exclude_reviewed([self.item],self.catalog),([],1))
    def test_other_commit_still_reported(self):
        self.item['Commit']='2'*40
        self.assertEqual(scanner.exclude_reviewed([self.item],self.catalog)[1],0)
    def test_other_bytes_still_reported(self):
        self.item['Match']='a different value'
        self.assertEqual(scanner.exclude_reviewed([self.item],self.catalog)[1],0)
    def test_other_finding_remains(self):
        other={**self.item,'StartLine':6}
        self.assertEqual(scanner.exclude_reviewed([self.item,other],self.catalog),([other],1))
    def test_review_without_reason_rejected(self):
        self.entry.pop('reason')
        with self.assertRaises(ValueError):scanner.exclude_reviewed([self.item],self.catalog)

if __name__ == '__main__': unittest.main()
