"""Comprueba el servidor compilado usando exclusivamente servicios de CI en loopback."""
import json
import os
import secrets
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path


def fixture_port(name):
    value = int(os.environ[name])
    if not 1 <= value <= 65535:
        raise ValueError(name)
    return value


def main():
    sql = fixture_port("CI_SQL_PORT")
    mongo = fixture_port("CI_MONGO_PORT")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    settings = {
        "PATH": os.environ["PATH"], "NODE_ENV": "test", "PORT": str(port),
        "DOTENV_CONFIG_PATH": os.devnull, "AWS_EC2_METADATA_DISABLED": "true",
        "STORAGE_DRIVER": "local", "DB_HOST": "127.0.0.1", "DB_PORT": str(sql),
        "DB_USER": "rh_ci", "DB_PASSWORD": "solo-para-ci", "DB_NAME": "smart_rh_ci",
        "MONGO_URI": f"mongodb://127.0.0.1:{mongo}", "MONGO_DB": "smart_rh_ci",
        "JWT_SECRET": secrets.token_hex(32),
    }
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    observed = {}
    proc = subprocess.Popen(["node", "dist/server.js"], env=settings)
    try:
        deadline = time.monotonic() + 65
        while time.monotonic() < deadline and proc.poll() is None:
            try:
                for name in ("health", "ready"):
                    with opener.open(f"http://127.0.0.1:{port}/{name}", timeout=6) as res:
                        observed[name] = json.load(res)
                if (all(observed[k].get("ok") is True for k in ("health", "ready"))
                        and all(observed["ready"].get(k) == "ok" for k in ("mysql", "mongo"))):
                    print("READINESS_CON_DOS_BASES=OK")
                    return
            except (urllib.error.URLError, TimeoutError, ConnectionError):
                pass
            time.sleep(1)
        raise SystemExit("El backend compilado no confirmó las dos bases de prueba.")
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        Path("readiness-ci.json").write_text(json.dumps(observed, indent=2) + "\n")


if __name__ == "__main__":
    main()
