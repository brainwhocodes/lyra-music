"""Private setup worker: run in the selected venv, never from an HTTP request."""
from __future__ import annotations

import argparse
import array
import contextlib
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import sys
import tempfile
import time
import wave
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PINS = json.loads((ROOT / "scripts/model-pins.json").read_text(encoding="utf-8"))
PATTERNS = ["*.json", "*.safetensors", "*.jinja", "*.model", "README.md"]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_file(path: Path, expected_hash: str, expected_bytes: int | None = None) -> None:
    if not path.is_file() or (expected_bytes is not None and path.stat().st_size != expected_bytes):
        raise RuntimeError(f"Missing or incomplete pinned artifact: {path.name}")
    if sha256(path) != expected_hash:
        raise RuntimeError(f"SHA-256 mismatch for {path.name}; refusing to execute/load it. Remove only this corrupt cache artifact and reinstall.")


def forbid_network() -> None:
    os.environ.update(HF_HUB_OFFLINE="1", TRANSFORMERS_OFFLINE="1", HF_HUB_DISABLE_TELEMETRY="1",
                      NEEDLE_TELEMETRY="0", DO_NOT_TRACK="1", HF_HUB_DISABLE_IMPLICIT_TOKEN="1")
    def audit(event, _args):
        if event in {"socket.connect", "socket.connect_ex", "socket.getaddrinfo"}:
            raise RuntimeError("Python socket access is forbidden during offline model verification.")
    sys.addaudithook(audit)


def ensure_download_space(bytes_needed: int) -> None:
    from huggingface_hub.constants import HF_HUB_CACHE
    path = Path(HF_HUB_CACHE)
    while not path.exists():
        path = path.parent
    # Extra room for a partial download/copy on hosts without symlink support.
    required = bytes_needed * 2 + 256 * 1024**2
    if shutil.disk_usage(path).free < required:
        raise RuntimeError(f"Need {required / 1024**3:.1f} GiB free on the Hugging Face cache volume before download.")


def download_file(repo: str, revision: str, filename: str, bytes_needed: int) -> Path:
    from huggingface_hub import hf_hub_download
    from huggingface_hub.errors import LocalEntryNotFoundError
    try:
        return Path(hf_hub_download(repo, filename, revision=revision, local_files_only=True, token=False))
    except LocalEntryNotFoundError:
        ensure_download_space(bytes_needed)
        return Path(hf_hub_download(repo, filename, revision=revision, token=False))


def extract_engine(wheel: Path, destination: Path) -> Path:
    """Read one known native library; never extract arbitrary wheel paths."""
    with zipfile.ZipFile(wheel) as archive:
        entries = [entry for entry in archive.infolist()
                   if entry.filename in {"needle/libneedle3.dll", "needle/libneedle3.so", "needle/libneedle3.dylib"}]
        if len(entries) != 1 or not 0 < entries[0].file_size <= 16 * 1024**2:
            raise RuntimeError("Pinned engine wheel has an unexpected native-library layout.")
        data = archive.read(entries[0])
    target = destination / Path(entries[0].filename).name
    destination.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes() == data:
        return target
    with tempfile.NamedTemporaryFile(dir=destination, delete=False) as output:
        temporary = Path(output.name)
        output.write(data)
    try:
        os.replace(temporary, target)
    finally:
        temporary.unlink(missing_ok=True)
    return target


def prepare(name: str) -> dict:
    from huggingface_hub import snapshot_download
    from huggingface_hub.constants import HF_HUB_CACHE
    pin = PINS[name]
    weights = download_file(pin["repo"], pin["revision"], pin["file"], pin["bytes"])
    verify_file(weights, pin["sha256"], pin["bytes"])
    result = {"repo": pin["repo"], "revision": pin["revision"], "modelPath": str(weights), "sha256": pin["sha256"], "bytes": pin["bytes"], "hubCache": str(Path(HF_HUB_CACHE).resolve())}
    if name == "whistle":
        from needle.agent import fetch
        tag = fetch._platform_tag()  # Pinned SDK's tested glibc/musl/architecture detection.
        filename = f"python/cactus_needle-{pin['engineVersion']}-py3-none-{tag}.whl"
        wheel = download_file(pin["engineRepo"], pin["engineRevision"], filename, 1024**2)
        verify_file(wheel, pin["engineSha256"][tag])
        engine = extract_engine(wheel, ROOT / ".tools/models/whistle" / pin["engineVersion"] / tag)
        result.update(enginePath=str(engine), engineSha256=sha256(engine), engineWheelPath=str(wheel), engineTag=tag,
                      engineRevision=pin["engineRevision"], engineVersion=pin["engineVersion"])
    else:
        # Populate tokenizer/config/pooling files, excluding training/checkpoint formats.
        snapshot = snapshot_download(pin["repo"], revision=pin["revision"], allow_patterns=PATTERNS, token=False)
        result["snapshotPath"] = snapshot
    return result


def pcm_fixture() -> array.array:
    with wave.open(str(ROOT / "tests/fixtures/music/audio/spoken-test.wav"), "rb") as source:
        if (source.getframerate(), source.getnchannels(), source.getsampwidth()) != (16000, 1, 2):
            raise RuntimeError("The committed speech fixture must be mono16kHz/int16.")
        pcm = array.array("h", source.readframes(source.getnframes()))
    if sys.byteorder != "little":
        pcm.byteswap()
    return array.array("f", (sample / 32768 for sample in pcm))


def verify_artifact(name: str, artifact: dict) -> None:
    """Bind the exact hashed weights to the directory the loader will open."""
    pin = PINS[name]
    if artifact.get("repo") != pin["repo"] or artifact.get("revision") != pin["revision"]:
        raise RuntimeError("Setup state does not match the checked-in model pin. Run install again.")
    weights = Path(artifact["modelPath"]).resolve(strict=True)
    if name != "whistle":
        if not artifact.get("hubCache"):
            raise RuntimeError("Setup state lacks its pinned snapshot cache path. Run install again.")
        expected = (Path(artifact["hubCache"]) / ("models--" + pin["repo"].replace("/", "--"))
                    / "snapshots" / pin["revision"])
        snapshot = Path(artifact["snapshotPath"])
        if snapshot.resolve(strict=True) != expected.resolve(strict=True):
            raise RuntimeError("Snapshot directory does not match the pinned repository and revision.")
        if (snapshot / pin["file"]).resolve(strict=True) != weights:
            raise RuntimeError("Snapshot would load different weights from the verified model artifact.")
    verify_file(weights, pin["sha256"], pin["bytes"])
    if name == "whistle":
        verify_file(Path(artifact["engineWheelPath"]), pin["engineSha256"][artifact["engineTag"]])
        # Compare with the verified wheel's bytes, rather than trusting state-file hashes.
        with zipfile.ZipFile(artifact["engineWheelPath"]) as archive:
            member = "needle/" + Path(artifact["enginePath"]).name
            expected = hashlib.sha256(archive.read(member)).hexdigest()
        verify_file(Path(artifact["enginePath"]), expected)


def verify(name: str, artifact: dict) -> dict:
    forbid_network()
    verify_artifact(name, artifact)
    started = time.perf_counter()
    if name == "whistle":
        os.environ["NEEDLE3_LIB_PATH"] = artifact["enginePath"]
        import needle
        model = needle.Whistle(weights=artifact["modelPath"], buffer_size=4 * 1024**2)
        silent = model.transcribe(array.array("f", [0.0]) * 16000, word_timestamps=True)
        if silent.get("text", "").strip() or silent.get("words"):
            raise RuntimeError("Whistle silence check produced words.")
        speech = model.transcribe(pcm_fixture(), word_timestamps=True)
        if not all(word in speech.get("text", "").lower() for word in ("music", "morning")) or not speech.get("words"):
            raise RuntimeError("Whistle failed the real spoken-fixture check.")
        for word in speech["words"]:
            if not (0 <= word["start"] <= word["end"] <= 3.2):
                raise RuntimeError("Whistle produced invalid fixture word times.")
        details = {"silenceWords": 0, "speechText": speech["text"], "wordCount": len(speech["words"])}
    elif name == "embedding":
        import torch
        from sentence_transformers import SentenceTransformer
        torch.set_num_threads(4)
        model = SentenceTransformer(artifact["snapshotPath"], device="cpu", local_files_only=True,
                                   config_kwargs={"vision_config": None, "audio_config": None},
                                   model_kwargs={"torch_dtype": torch.float32}, trust_remote_code=False)
        model.max_seq_length = 2048
        with torch.inference_mode():
            vectors = model.encode(["task: search result | query: Quiet music for sleep",
                                    "title: Gentle Rain | text: Soft peaceful ambient music for relaxation and sleep.",
                                    "title: Stadium Riot | text: Aggressive heavy metal with fast drums and screaming guitars."],
                                   prompt="", normalize_embeddings=True, truncate_dim=256, show_progress_bar=False)
        if vectors.shape != (3, 256) or not all(math.isfinite(float(x)) for x in vectors.flat):
            raise RuntimeError("Embedding shape/finiteness check failed.")
        for vector in vectors:
            if abs(float(vector @ vector) - 1) > 1e-4:
                raise RuntimeError("Embedding normalization check failed.")
        calm, energetic = float(vectors[0] @ vectors[1]), float(vectors[0] @ vectors[2])
        if calm <= energetic:
            raise RuntimeError("Embedding semantic-order smoke check failed.")
        details = {"dimensions": 256, "calmSimilarity": calm, "energeticSimilarity": energetic}
    else:
        from gemma_audio import load_model, transcribe
        model, processor = load_model(artifact["snapshotPath"])
        result = transcribe(model, processor, pcm_fixture())
        if not all(word in result["text"].lower() for word in ("music", "morning")):
            raise RuntimeError("Audio Gemma did not pass the spoken-fixture smoke check: " + result["text"][:300])
        details = result
    return {"offline": True, "pythonSocketAuditGuard": True, "osNetworkIsolation": False,
            "seconds": round(time.perf_counter() - started, 3), **details}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["prepare", "verify"])
    parser.add_argument("model", choices=list(PINS.keys() - {"schemaVersion"}))
    parser.add_argument("--artifact")
    args = parser.parse_args()
    with contextlib.redirect_stdout(sys.stderr):
        result = prepare(args.model) if args.action == "prepare" else verify(args.model, json.loads(args.artifact))
    print(json.dumps(result, allow_nan=False))


if __name__ == "__main__":
    main()
