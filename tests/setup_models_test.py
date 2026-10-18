"""No-model setup regression tests: python -m unittest discover -s tests -p setup_models_test.py."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


setup = load("setup_models", ROOT / "scripts/setup-models.py")
runtime = load("model_runtime", ROOT / "scripts/model-runtime.py")
private_models = load("private_models", ROOT / "evals/private-models.py")


class ModelSetupTests(unittest.TestCase):
    def test_platform_interpreter_paths_preserve_spaces(self):
        root = Path("example directory")
        self.assertEqual(setup.python_path(root, "nt"), root / "Scripts/python.exe")
        self.assertEqual(setup.python_path(root, "posix"), root / "bin/python")

    def test_cpu_packages_are_explicit_on_windows_linux_and_native_on_macos(self):
        pins = {"torch": "2.14.1", "torchvision": "0.29.1"}
        for system in ("Windows", "Linux"):
            command = setup.cpu_install_arguments(Path("python"), pins, system)
            self.assertIn("https://download.pytorch.org/whl/cpu", command)
            self.assertIn("torch==2.14.1", command)
        self.assertIsNone(setup.cpu_install_arguments(Path("python"), pins, "Darwin"))

    def test_requirements_reject_unpinned_or_executable_directives(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "requirements.txt"
            path.write_text("package==1.2.3 # tested\n", encoding="utf-8")
            self.assertEqual(setup.requirement_pins(path), {"package": "1.2.3"})
            for invalid in ("package>=1", "-e https://example.invalid", "--extra-index-url https://example.invalid"):
                path.write_text(invalid, encoding="utf-8")
                with self.assertRaises(setup.SetupError):
                    setup.requirement_pins(path)

    def test_environment_explicitly_disables_tokens_and_sets_offline_flags(self):
        with patch.dict(os.environ, {"HF_TOKEN": "private", "HUGGING_FACE_HUB_TOKEN": "private", "HF_HUB_CACHE": "old-cache"}):
            env = setup.environment(True, "new cache")
        self.assertNotIn("HF_TOKEN", env)
        self.assertNotIn("HUGGING_FACE_HUB_TOKEN", env)
        self.assertEqual(env["HF_HUB_OFFLINE"], "1")
        self.assertEqual(env["PIP_NO_INDEX"], "1")
        self.assertEqual(env["NEEDLE_TELEMETRY"], "0")
        self.assertEqual(Path(env["HF_HUB_CACHE"]), Path(env["HF_HOME"]) / "hub")
        with patch.dict(os.environ, {"HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"}):
            self.assertNotIn("HF_HUB_OFFLINE", setup.environment(False))

    def test_lock_rejects_concurrent_setup_and_cleans_up_on_error(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory)
            with self.assertRaisesRegex(RuntimeError, "deliberate"):
                with setup.setup_lock(target):
                    with self.assertRaises(setup.SetupError):
                        with setup.setup_lock(target):
                            self.fail("Concurrent lock entered")
                    raise RuntimeError("deliberate")
            self.assertFalse((target / "setup.lock").exists())

    def test_insufficient_disk_fails_before_a_download(self):
        with patch.object(setup.shutil, "disk_usage", return_value=type("Disk", (), {"free": 10})()):
            with self.assertRaisesRegex(setup.SetupError, "Not enough free disk"):
                setup.check_space(ROOT, 11)

    def test_atomic_state_and_hash_reject_tampering(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "state.json"
            setup.atomic_json(path, {"state": "complete"})
            self.assertEqual(json.loads(path.read_text()), {"state": "complete"})
            digest = runtime.sha256(path)
            runtime.verify_file(path, digest, path.stat().st_size)
            path.write_text("tampered", encoding="utf-8")
            with self.assertRaises(RuntimeError):
                runtime.verify_file(path, digest)
            self.assertEqual([p.name for p in Path(directory).iterdir()], ["state.json"])

    def test_engine_extract_reads_only_known_library_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            wheel = root / "test.whl"
            with zipfile.ZipFile(wheel, "w") as archive:
                archive.writestr("../../escape.txt", "must never be extracted")
                archive.writestr("needle/libneedle3.dll", b"known engine bytes")
            target = runtime.extract_engine(wheel, root / "engine")
            stamp = target.stat().st_mtime_ns
            self.assertEqual(runtime.extract_engine(wheel, root / "engine").stat().st_mtime_ns, stamp)
            self.assertEqual(target.read_bytes(), b"known engine bytes")
            self.assertFalse((root.parent / "escape.txt").exists())
            with zipfile.ZipFile(wheel, "w") as archive:
                archive.writestr("arbitrary.dll", b"wrong layout")
            with self.assertRaises(RuntimeError):
                runtime.extract_engine(wheel, root / "engine")

    def test_offline_worker_rejects_socket_connection_without_contacting_network(self):
        code = ("import runpy,socket; r=runpy.run_path('scripts/model-runtime.py'); "
                "r['forbid_network'](); socket.socket().connect(('127.0.0.1',9))")
        result = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Python socket access is forbidden", result.stderr)

    def test_snapshot_must_load_the_same_file_that_was_verified(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            snapshot = cache / "models--publisher--model" / "snapshots" / "pinned-revision"
            snapshot.mkdir(parents=True)
            weights = snapshot / "model.safetensors"
            weights.write_bytes(b"verified weights")
            pin = {"repo": "publisher/model", "revision": "pinned-revision", "file": weights.name,
                   "sha256": runtime.sha256(weights), "bytes": weights.stat().st_size}
            artifact = {"repo": pin["repo"], "revision": pin["revision"], "modelPath": str(weights),
                        "hubCache": str(cache), "snapshotPath": str(snapshot)}
            with patch.dict(runtime.PINS, {"embedding": pin}):
                runtime.verify_artifact("embedding", artifact)
                other = cache / "verified-but-not-loaded.safetensors"
                other.write_bytes(weights.read_bytes())
                with self.assertRaisesRegex(RuntimeError, "different weights"):
                    runtime.verify_artifact("embedding", {**artifact, "modelPath": str(other)})
                wrong_snapshot = snapshot.parent / "other-revision"
                wrong_snapshot.mkdir()
                with self.assertRaisesRegex(RuntimeError, "pinned repository and revision"):
                    runtime.verify_artifact("embedding", {**artifact, "snapshotPath": str(wrong_snapshot)})
                with self.assertRaisesRegex(RuntimeError, "cache path"):
                    runtime.verify_artifact("embedding", {**artifact, "hubCache": None})
                weights.write_bytes(b"modified weights")
                with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                    runtime.verify_artifact("embedding", artifact)

    def test_runtime_environment_quotes_paths_without_writing_private_env(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(setup, "TOOLS", Path(directory)):
                setup.write_environment({"ffmpeg": "C:/tools/ffmpeg.exe", "models": {"whistle": {
                    "python": "C:/listener's folder/python.exe", "modelPath": "C:/weights/model.cact", "enginePath": "C:/engine.dll"}}})
            ps = (Path(directory) / "runtime-env.ps1").read_text()
            self.assertIn("$env:NUXT_WHISTLE_PYTHON = 'C:/listener''s folder/python.exe'", ps)
            self.assertIn("$env:NUXT_WHISTLE_MODEL_PATH", ps)
            self.assertIn("$env:WHISTLE_FFMPEG_PATH = 'C:/tools/ffmpeg.exe'", ps)
            self.assertEqual({p.name for p in Path(directory).iterdir()}, {"runtime-env.ps1", "runtime-env.sh"})


class PrivateModelOutputTests(unittest.TestCase):
    def test_private_report_rejects_stream_device_and_ambiguous_file_names(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory).resolve()
            with patch.object(private_models, "ROOT", workspace):
                for name in ("result.json:stream", "NUL.json", "CON", "COM1", "LPT9.txt", "result.json.", "result.json ", "bad?name.json"):
                    with self.subTest(name=name), self.assertRaisesRegex(ValueError, "portable file names"):
                        private_models.write_private_report(workspace / ".test-data" / name, {"private": True})
            self.assertFalse((workspace / ".test-data").exists())

    def test_private_report_repeats_atomically_and_rejects_outside_output(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory).resolve()
            destination = workspace / ".test-data" / "nested" / "result.json"
            with patch.object(private_models, "ROOT", workspace):
                private_models.write_private_report(destination, {"text": "日本語"})
                private_models.write_private_report(destination, {"text": "Français"})
                self.assertEqual(json.loads(destination.read_text(encoding="utf-8")), {"text": "Français"})
                self.assertEqual([item.name for item in destination.parent.iterdir()], ["result.json"])
                for outside in (workspace / "public" / "result.json", workspace / ".test-data" / ".." / "public" / "result.json"):
                    with self.assertRaisesRegex(ValueError, "ignored .test-data"):
                        private_models.write_private_report(outside, {"private": True})
                self.assertFalse((workspace / "public").exists())

    def test_private_report_rejects_root_and_nested_directory_redirects(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory).resolve()
            outside = base / "outside"
            outside.mkdir()
            for location in (".test-data", ".test-data/nested"):
                with self.subTest(location=location):
                    workspace = base / ("root-link" if location == ".test-data" else "nested-link")
                    link = workspace / location
                    link.parent.mkdir(parents=True)
                    if os.name == "nt":
                        subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(outside)],
                                       check=True, capture_output=True)
                    else:
                        link.symlink_to(outside, target_is_directory=True)
                    try:
                        with patch.object(private_models, "ROOT", workspace):
                            with self.assertRaisesRegex(ValueError, "redirected"):
                                private_models.write_private_report(link / "result.json", {"private": True})
                        self.assertEqual(list(outside.iterdir()), [])
                    finally:
                        link.rmdir() if os.name == "nt" else link.unlink()

    def test_private_report_does_not_follow_preexisting_temporary_hard_link(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory).resolve()
            destination = workspace / ".test-data" / "result.json"
            destination.parent.mkdir()
            outside = workspace / "must-not-overwrite.txt"
            outside.write_text("original", encoding="utf-8")
            temporary = destination.with_suffix(".json.tmp")
            os.link(outside, temporary)
            with patch.object(private_models, "ROOT", workspace):
                private_models.write_private_report(destination, {"private": True})
            self.assertEqual(outside.read_text(encoding="utf-8"), "original")
            self.assertEqual(temporary.read_text(encoding="utf-8"), "original")
            self.assertEqual(json.loads(destination.read_text(encoding="utf-8")), {"private": True})

    def test_private_report_replaces_output_hard_link_without_mutating_its_target(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory).resolve()
            destination = workspace / ".test-data" / "result.json"
            destination.parent.mkdir()
            outside = workspace / "must-not-overwrite.txt"
            outside.write_text("original", encoding="utf-8")
            os.link(outside, destination)
            with patch.object(private_models, "ROOT", workspace):
                private_models.write_private_report(destination, {"private": True})
            self.assertEqual(outside.read_text(encoding="utf-8"), "original")
            self.assertEqual(json.loads(destination.read_text(encoding="utf-8")), {"private": True})


if __name__ == "__main__":
    unittest.main()
