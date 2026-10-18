"""Explicit online provisioning, followed by inference with offline flags and a Python socket guard.

Run `python scripts/setup-models.py --help`. Only Python's standard library is
needed in this bootstrap interpreter. No shell, sudo, .env edits or audio upload.
"""
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
import venv

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / ".tools" / "models"
STATE = TOOLS / "setup-state.json"
PINS = json.loads((ROOT / "scripts" / "model-pins.json").read_text(encoding="utf-8"))
PROFILES = {
    "whistle": (".venv-whistle", "requirements-whistle.txt", 256 * 1024**2),
    "embedding": (".venv-embedding", "requirements-embedding.txt", 6 * 1024**3),
    # Same tested libraries; no second PyTorch installation is necessary.
    "gemma-audio": (".venv-embedding", "requirements-embedding.txt", 23 * 1024**3),
}


class SetupError(RuntimeError):
    pass


def python_path(directory: Path, system: str | None = None) -> Path:
    return directory / ("Scripts/python.exe" if (system or os.name) == "nt" else "bin/python")


def requirement_pins(path: Path) -> dict[str, str]:
    result = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        match = re.fullmatch(r"([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)", line)
        if not match:
            raise SetupError(f"Only exact package pins are allowed: {path.name}: {line}")
        result[match[1]] = match[2]
    return result


def environment(offline: bool, hf_home: str | None = None) -> dict[str, str]:
    env = dict(os.environ)
    # Provision only public models; neither emit nor implicitly send saved tokens.
    for name in ("HF_TOKEN", "HUGGING_FACE_HUB_TOKEN"):
        env.pop(name, None)
    env.update(NEEDLE_TELEMETRY="0", DO_NOT_TRACK="1", HF_HUB_DISABLE_TELEMETRY="1",
               HF_HUB_DISABLE_IMPLICIT_TOKEN="1", TOKENIZERS_PARALLELISM="false",
               PYTHONUTF8="1", PIP_DISABLE_PIP_VERSION_CHECK="1", HF_HUB_DOWNLOAD_TIMEOUT="60")
    if hf_home:
        env["HF_HOME"] = str(Path(hf_home).expanduser().resolve())
        # HF_HUB_CACHE otherwise takes priority over an explicit --hf-home.
        env["HF_HUB_CACHE"] = str(Path(env["HF_HOME"]) / "hub")
    if offline:
        env.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", PIP_NO_INDEX="1")
    else:
        for name in ("HF_HUB_OFFLINE", "TRANSFORMERS_OFFLINE", "PIP_NO_INDEX"):
            env.pop(name, None)
    return env


def run(args: list[str], *, env: dict[str, str], timeout: int = 1800, capture: bool = False) -> str:
    try:
        result = subprocess.run(args, cwd=ROOT, env=env, timeout=timeout, check=True,
                                text=True, encoding="utf-8", errors="replace",
                                stdout=subprocess.PIPE if capture else None,
                                stderr=subprocess.PIPE if capture else None)
        return result.stdout or ""
    except subprocess.TimeoutExpired as exc:
        raise SetupError(f"Timed out after {timeout}s: {Path(args[0]).name}. Rerun to reuse completed cached files.") from exc
    except subprocess.CalledProcessError as exc:
        # Avoid logging the inherited environment or tokens; bounded diagnostics only.
        details = ((exc.stderr or "") + (exc.stdout or ""))[-5000:]
        raise SetupError(f"{Path(args[0]).name} exited {exc.returncode}. {details}") from exc
    except OSError as exc:
        raise SetupError(f"Cannot start {args[0]}: {exc}") from exc


def atomic_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=path.parent, delete=False) as handle:
        temporary = Path(handle.name)
        json.dump(data, handle, indent=2, ensure_ascii=False, allow_nan=False)
        handle.write("\n")
    try:
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


@contextlib.contextmanager
def setup_lock(directory: Path):
    directory.mkdir(parents=True, exist_ok=True)
    lock = directory / "setup.lock"
    try:
        descriptor = os.open(lock, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise SetupError(f"Another setup may be running. If no setup process remains, remove only {lock} and retry.") from exc
    try:
        with os.fdopen(descriptor, "w") as handle:
            handle.write(str(os.getpid()))
        yield
    finally:
        lock.unlink(missing_ok=True)


def check_space(path: Path, needed: int) -> None:
    ancestor = path
    while not ancestor.exists():
        ancestor = ancestor.parent
    free = shutil.disk_usage(ancestor).free
    if free < needed:
        raise SetupError(f"Not enough free disk space at {ancestor}: {free / 1024**3:.1f} GiB free; need {needed / 1024**3:.1f} GiB headroom.")


def validate_python() -> None:
    if sys.version_info[:2] != (3, 12) or sys.maxsize <= 2**32:
        raise SetupError("Use 64-bit Python 3.12 for these tested dependency pins (Windows: py -3.12; Unix: python3.12).")
    if platform.system() not in {"Windows", "Linux", "Darwin"}:
        raise SetupError("Supported setup hosts are Windows, Linux and macOS.")


def check_packages(executable: Path, requirements: Path, env: dict[str, str]) -> bool:
    if not executable.is_file():
        return False
    pins = requirement_pins(requirements)
    code = "import importlib.metadata as m,json; p=json.loads(__import__('sys').argv[1]); print(json.dumps({k:m.version(k) for k in p}))"
    try:
        actual = json.loads(run([str(executable), "-c", code, json.dumps(pins)], env=env, timeout=30, capture=True))
        return all(actual[name].split("+", 1)[0] == version for name, version in pins.items())
    except SetupError:
        return False


def cpu_install_arguments(executable: Path, pins: dict[str, str], system: str | None = None) -> list[str] | None:
    if "torch" not in pins or (system or platform.system()) == "Darwin":
        return None
    # Explicit official CPU wheels avoid pulling several GB of CUDA dependencies
    # on a fresh Linux host. macOS wheels come from the ordinary PyPI index.
    return [str(executable), "-m", "pip", "install", "--only-binary=:all:", "--no-input",
            "--timeout", "60", "--retries", "2", "--index-url", "https://download.pytorch.org/whl/cpu",
            f"torch=={pins['torch']}", f"torchvision=={pins['torchvision']}"]


def write_environment(state: dict) -> None:
    values = {"NEEDLE_TELEMETRY": "0", "DO_NOT_TRACK": "1", "HF_HUB_OFFLINE": "1", "HF_HUB_DISABLE_TELEMETRY": "1"}
    if state.get("hfHome"):
        values["HF_HOME"] = state["hfHome"]
        values["HF_HUB_CACHE"] = str(Path(state["hfHome"]) / "hub")
    for name, model in state.get("models", {}).items():
        if name == "whistle":
            values.update(NUXT_WHISTLE_PYTHON=model["python"], WHISTLE_PYTHON=model["python"],
                          NUXT_WHISTLE_MODEL_PATH=model["modelPath"], WHISTLE_MODEL_PATH=model["modelPath"],
                          NEEDLE3_LIB_PATH=model["enginePath"], NUXT_WHISTLE_FFMPEG_PATH=state["ffmpeg"],
                          WHISTLE_FFMPEG_PATH=state["ffmpeg"])
        elif name == "embedding":
            values.update(NUXT_EMBEDDING_PYTHON=model["python"], EMBEDDING_PYTHON=model["python"],
                          NUXT_EMBEDDING_MODEL=model["repo"], NUXT_EMBEDDING_REVISION=model["revision"])
            # Resolve the exact cache used for this registered snapshot, including
            # caller-provided HF_HUB_CACHE. Changing --hf-home does not relocate it.
            if model.get("hubCache"):
                values["HF_HUB_CACHE"] = model["hubCache"]
    # These are opt-in process environment snippets, never modifications to .env.
    powershell = "# Generated local paths; dot-source in the server's PowerShell session.\n"
    shell = "# Generated local paths; source in the server's POSIX shell.\n"
    import shlex
    for name, value in sorted(values.items()):
        powershell += "$env:" + name + " = '" + value.replace("'", "''") + "'\n"
        shell += "export " + name + "=" + shlex.quote(value) + "\n"
    (TOOLS / "runtime-env.ps1").write_text(powershell, encoding="utf-8")
    (TOOLS / "runtime-env.sh").write_text(shell, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["install", "verify", "status"])
    parser.add_argument("--models", nargs="+", choices=list(PROFILES), default=["whistle", "embedding"], help="gemma-audio is an optional ~10.3GB ASR comparison, not the production embedding model")
    parser.add_argument("--hf-home", help="Optional Hugging Face cache root, used consistently by download and runtime")
    parser.add_argument("--ffmpeg", default=os.environ.get("NUXT_WHISTLE_FFMPEG_PATH", "ffmpeg"))
    args = parser.parse_args(argv)
    if args.command == "status":
        print(STATE.read_text(encoding="utf-8") if STATE.exists() else "Not provisioned. Run install to create model environments and download public pinned weights.")
        return 0
    validate_python()
    models = list(dict.fromkeys(args.models))
    with setup_lock(TOOLS):
        state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"schemaVersion": 1, "models": {}}
        chosen_home = args.hf_home or state.get("hfHome") or os.environ.get("HF_HOME")
        env = environment(args.command == "verify", chosen_home)
        ffmpeg = shutil.which(args.ffmpeg)
        if not ffmpeg:
            raise SetupError("ffmpeg is required. Install it with your OS package manager, or pass --ffmpeg /absolute/path/to/ffmpeg. Setup does not install system packages.")
        run([ffmpeg, "-nostdin", "-version"], env=env, timeout=15, capture=True)
        state.update(ffmpeg=str(Path(ffmpeg).resolve()), hfHome=env.get("HF_HOME"), pythonVersion=platform.python_version(), platform=platform.platform())
        checked_envs = set()
        for name in models:
            folder, requirements_file, headroom = PROFILES[name]
            directory = ROOT / folder
            executable = python_path(directory)
            requirements = ROOT / requirements_file
            if folder not in checked_envs:
                installed = check_packages(executable, requirements, env)
                if not installed and args.command == "verify":
                    raise SetupError(f"{name} dependencies are missing or differ from pinned requirements; run install first.")
                if not installed:
                    check_space(directory, headroom)
                    if not executable.exists():
                        if directory.exists() and any(directory.iterdir()):
                            raise SetupError(f"Refusing to overwrite an incomplete environment at {directory}; move it aside and rerun.")
                        print(f"Creating {directory.name}", flush=True)
                        venv.EnvBuilder(with_pip=True).create(directory)
                    print(f"Installing pinned packages for {name}", flush=True)
                    cpu_args = cpu_install_arguments(executable, requirement_pins(requirements))
                    if cpu_args:
                        run(cpu_args, env=env)
                    run([str(executable), "-m", "pip", "install", "--only-binary=:all:", "--no-input", "--timeout", "60", "--retries", "2", "-r", str(requirements)], env=env)
                else:
                    print(f"Reusing matching packages in {directory.name}", flush=True)
                run([str(executable), "-m", "pip", "check"], env=env, timeout=60, capture=True)
                checked_envs.add(folder)
            model = dict(state["models"].get(name, {}))
            if args.command == "install":
                print(f"Caching pinned {PINS[name]['repo']} ({PINS[name]['bytes'] / 1e9:.2f} GB weights)", flush=True)
                model = json.loads(run([str(executable), str(ROOT / "scripts/model-runtime.py"), "prepare", name], env=env, timeout=3600, capture=True))
            elif not model:
                raise SetupError(f"{name} has no setup state. Run install to register its pinned cached files.")
            model.update(python=str(executable), requirementsSha256=hashlib.sha256(requirements.read_bytes()).hexdigest())
            # Verification is a separate interpreter with offline flags and a socket audit guard.
            print(f"Verifying {name} offline with actual inference", flush=True)
            verified = json.loads(run([str(executable), str(ROOT / "scripts/model-runtime.py"), "verify", name, "--artifact", json.dumps(model)], env=environment(True, chosen_home), timeout=900, capture=True))
            model["verification"] = verified
            state["models"][name] = model
            atomic_json(STATE, state)
            write_environment(state)
        print(f"Verified {', '.join(models)}. Local report: {STATE}")
        print(f"Load runtime environment: PowerShell `. '{TOOLS / 'runtime-env.ps1'}'`; POSIX `. '{TOOLS / 'runtime-env.sh'}'`.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (SetupError, OSError, ValueError) as error:
        print(f"Model setup failed: {error}", file=sys.stderr)
        raise SystemExit(1)
