import argparse
import os
import shutil
import signal
import subprocess
import sys
import time
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def run(command: list[str]) -> None:
    subprocess.run(command, cwd=ROOT, check=True)


def setup(npm: str) -> None:
    if not PYTHON.exists():
        print("Creating the Python environment.", flush=True)
        venv.create(ROOT / ".venv", with_pip=True)
    requirements = ROOT / "apps/api/requirements.lock"
    if not requirements.exists():
        requirements = ROOT / "apps/api/requirements.in"
    run([str(PYTHON), "-m", "pip", "install", "-r", str(requirements)])
    run([npm, "--prefix", "apps/web", "ci", "--ignore-scripts", "--no-audit", "--no-fund"])
    if not (ROOT / ".env").exists():
        shutil.copyfile(ROOT / ".env.example", ROOT / ".env")
    run([str(PYTHON), "scripts/generate_contracts.py", "--check"])


def stop_process(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/PID", str(process.pid), "/T", "/F"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    else:
        os.killpg(process.pid, signal.SIGTERM)
    process.wait(timeout=10)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the local API and web preview.")
    parser.add_argument("--setup", action="store_true", help="Install dependencies before starting.")
    parser.add_argument("--install-only", action="store_true", help="Install dependencies without starting servers.")
    args = parser.parse_args()
    if sys.version_info[:2] != (3, 11):
        raise SystemExit("Use Python 3.11: py -3.11 scripts/dev.py --setup")
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if npm is None:
        raise SystemExit("Install Node.js 20.19 or newer, then run this command again.")
    node = shutil.which("node")
    if node is None:
        raise SystemExit("Install Node.js 20.19 or newer, then run this command again.")
    version = subprocess.check_output([node, "--version"], text=True).strip().lstrip("v")
    major, minor = (int(part) for part in version.split(".")[:2])
    if major < 20 or (major == 20 and minor < 19) or (major == 22 and minor < 12):
        raise SystemExit("Use Node.js 20.19+, 22.12+, or a newer supported release.")
    if args.setup or args.install_only:
        setup(npm)
    if args.install_only:
        return
    if not PYTHON.exists() or not (ROOT / "apps/web/node_modules/vite").exists():
        raise SystemExit("Install dependencies first: python scripts/dev.py --setup")


def start_servers() -> None:
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env", override=False)
    api_port = os.getenv("API_PORT", "8000")
    web_port = os.getenv("WEB_PORT", "5173")
    if any(not port.isdigit() or not 1 <= int(port) <= 65535 for port in (api_port, web_port)):
        raise SystemExit("API_PORT and WEB_PORT must be port numbers between 1 and 65535.")
    if api_port == web_port:
        raise SystemExit("API_PORT and WEB_PORT must use different ports.")
    commands = [
        [str(PYTHON), "-m", "uvicorn", "app.main:app", "--app-dir", "apps/api", "--host", "127.0.0.1", "--port", api_port],
        [shutil.which("npm.cmd" if os.name == "nt" else "npm"), "--prefix", "apps/web", "run", "dev", "--", "--port", web_port],
    ]
    options = {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == "nt" else {"start_new_session": True}
    processes: list[subprocess.Popen] = []
    print(f"Web: http://127.0.0.1:{web_port}\nAPI: http://127.0.0.1:{api_port}/docs\nCtrl+C stops both servers.", flush=True)
    try:
        for command in commands:
            processes.append(subprocess.Popen(command, cwd=ROOT, **options))
        while all(process.poll() is None for process in processes):
            time.sleep(0.4)
    except KeyboardInterrupt:
        pass
    finally:
        failed = [process.returncode for process in processes if process.poll() not in (None, 0)]
        for process in processes:
            stop_process(process)
    if failed:
        raise SystemExit("A server stopped. Read its error above and restart the preview.")


if __name__ == "__main__":
    main()
    if "--install-only" not in sys.argv:
        if Path(sys.executable).resolve() != PYTHON.resolve():
            result = subprocess.run([str(PYTHON), __file__, *[arg for arg in sys.argv[1:] if arg != "--setup"]], cwd=ROOT)
            raise SystemExit(result.returncode)
        start_servers()
