import os
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def main() -> None:
    if Path(sys.executable).resolve() != PYTHON.resolve():
        if not PYTHON.exists():
            raise SystemExit("Run python scripts/dev.py --setup first.")
        raise SystemExit(subprocess.run([str(PYTHON), __file__], cwd=ROOT).returncode)
    subprocess.run([sys.executable, "scripts/generate_contracts.py", "--check"], cwd=ROOT, check=True)
    sys.path.insert(0, str(ROOT / "apps/api"))
    suite = unittest.defaultTestLoader.discover(str(ROOT / "apps/api/tests"))
    if not unittest.TextTestRunner(verbosity=2).run(suite).wasSuccessful():
        raise SystemExit(1)
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if npm is None:
        raise SystemExit("Install Node.js to run the frontend checks.")
    subprocess.run([npm, "--prefix", "apps/web", "run", "check"], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()
