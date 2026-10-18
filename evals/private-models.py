"""Offline model comparison on an explicitly supplied local import report.

All audio excerpts, text outputs, names and paths stay under ignored .test-data.
This does not write lyrics or metadata into the application database.
"""
from __future__ import annotations
import argparse
import array
import contextlib
import importlib.util
import json
import math
import os
from pathlib import Path, PureWindowsPath
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("model_runtime", ROOT / "scripts/model-runtime.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def private_output_path(output):
    """Keep reports under the fixed checkout boundary without following redirects."""
    workspace = ROOT.resolve(strict=True)
    private_root = workspace / ".test-data"
    spelling = Path(output)
    # Validate before abspath: Windows normalizes trailing dots/spaces and can
    # turn reserved devices into special absolute paths during normalization.
    for part in spelling.parts:
        if part in (spelling.anchor, ".", ".."):
            continue
        if (any(character in '<>:"|?*' or ord(character) < 32 for character in part)
                or part != part.rstrip(" .") or PureWindowsPath(part).is_reserved()):
            raise ValueError("Private model output requires portable file names without device or stream syntax.")
    candidate = Path(os.path.abspath(output))
    if candidate == private_root or not candidate.is_relative_to(private_root):
        raise ValueError("Private model results must stay in the ignored .test-data directory.")
    cursor = workspace
    for part in candidate.relative_to(workspace).parts:
        cursor = cursor / part
        if (cursor.is_symlink() or cursor.is_junction()
                or (cursor.exists() and cursor.resolve() != cursor)):
            raise ValueError("Private model output must not contain redirected paths.")
    return candidate


def write_private_report(output, report):
    output = private_output_path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    # Recheck after directory creation. Exclusive random temporary-file creation
    # avoids following a preexisting fixed .tmp symlink or hard link.
    output = private_output_path(output)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", prefix=output.name + ".",
                                         suffix=".tmp", dir=output.parent, delete=False) as target:
            temporary = Path(target.name)
            json.dump(report, target, indent=2, ensure_ascii=False, allow_nan=False)
            target.write("\n")
        private_output_path(temporary)
        private_output_path(output)
        os.replace(temporary, output)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def choose_tracks(tracks):
    """Two deterministic positions per album, fixed before seeing any prediction."""
    albums = {}
    for track in tracks:
        albums.setdefault(track["albumId"], []).append(track)
    selected = []
    for album_id in sorted(albums):
        group = sorted(albums[album_id], key=lambda item: (item.get("trackNumber") or 0, item["filePath"]))
        for index in sorted({0, len(group) // 2}):
            track = group[index]
            duration = float(track["exactDuration"])
            # Avoid assuming the opening is representative of a song's vocals.
            offset = min(45.0, max(0.0, duration / 2 - 10))
            selected.append({**track, "offsetSeconds": offset, "clipSeconds": min(20.0, duration - offset)})
    return selected


def read_pcm(ffmpeg, path, offset, seconds):
    source = Path(path).resolve(strict=True)
    if not source.is_file() or not math.isfinite(seconds) or not 0 < seconds <= 30 or not math.isfinite(offset) or offset < 0:
        raise ValueError("Expected a local audio file and a finite clip of at most30 seconds.")
    result = subprocess.run([ffmpeg, "-nostdin", "-v", "error", "-protocol_whitelist", "file,pipe",
                             "-ss", str(offset), "-i", str(source), "-t", str(seconds),
                             "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "pipe:1"],
                            check=True, capture_output=True, timeout=30)
    if not 0 < len(result.stdout) <= 30 * 16000 * 2:
        raise ValueError("Unexpected PCM output size.")
    samples = array.array("h", result.stdout)
    if sys.byteorder != "little": samples.byteswap()
    return array.array("f", (sample / 32768 for sample in samples))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", choices=["whistle", "embedding", "gemma-audio"])
    parser.add_argument("--import-report", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    output = private_output_path(args.output)
    report = json.loads(args.import_report.read_text(encoding="utf-8"))
    if report.get("private") is not True:
        raise ValueError("This harness expects the explicitly marked private local import report.")
    state = json.loads((ROOT / ".tools/models/setup-state.json").read_text(encoding="utf-8"))
    artifact = state["models"][args.model]
    pin = runtime.PINS[args.model]
    runtime.forbid_network()
    runtime.verify_artifact(args.model, artifact)
    cases = choose_tracks(report["tracks"])
    results = {"private": True, "model": pin["repo"], "revision": pin["revision"], "modelSha256": pin["sha256"],
               "protocol": "first and midpoint track by track number in each album;20s excerpt starting45s or centered for shorter tracks",
               "hasReferenceLyrics": False, "accuracyMeasured": False,
               "offline": True, "pythonSocketAuditGuard": True, "osNetworkIsolation": False,
               "corpusTracks": len(report["tracks"]), "results": []}
    started = time.perf_counter()
    with contextlib.redirect_stdout(sys.stderr):
        if args.model == "whistle":
            os.environ["NEEDLE3_LIB_PATH"] = artifact["enginePath"]
            import needle
            model = needle.Whistle(weights=artifact["modelPath"], buffer_size=4 * 1024**2)
        elif args.model == "gemma-audio":
            from gemma_audio import load_model, transcribe
            model, processor = load_model(artifact["snapshotPath"])
        else:
            import torch
            from sentence_transformers import SentenceTransformer
            torch.set_num_threads(4)
            model = SentenceTransformer(artifact["snapshotPath"], device="cpu", local_files_only=True,
                                       config_kwargs={"vision_config": None, "audio_config": None},
                                       model_kwargs={"torch_dtype": torch.float32}, trust_remote_code=False)
            model.max_seq_length = 2048
        results["modelLoadSeconds"] = round(time.perf_counter() - started, 3)
        for index, track in enumerate(cases):
            print(f"Evaluating private case {index+1}/{len(cases)} ({args.model})", file=sys.stderr, flush=True)
            record = {"trackId": track["id"], "albumId": track["albumId"], "title": track["title"],
                      "offsetSeconds": track["offsetSeconds"], "clipSeconds": track["clipSeconds"]}
            begin = time.perf_counter()
            try:
                if args.model == "embedding":
                    text = f"title: {track['title']} | text: Artist: {track.get('artist','')}. Album: {track.get('album','')}."
                    with torch.inference_mode():
                        vector = model.encode([text], prompt="", normalize_embeddings=True, truncate_dim=256, show_progress_bar=False)[0]
                    record.update(dimensions=len(vector), norm=float(vector @ vector) ** .5,
                                  finite=bool(all(math.isfinite(float(x)) for x in vector)),
                                  generatedTranscript=False, audioInput=False)
                else:
                    pcm = read_pcm(state["ffmpeg"], track["filePath"], track["offsetSeconds"], track["clipSeconds"])
                    if args.model == "whistle":
                        decoded = model.transcribe(pcm, word_timestamps=True)
                        record.update(text=decoded.get("text", ""), language=decoded.get("language"), words=decoded.get("words", []), wordTimestamps=True)
                    else:
                        record.update(transcribe(model, processor, pcm))
                record["secondsIncludingAudioPreparation"] = round(time.perf_counter()-begin, 3)
            except Exception as error:
                record["error"] = str(error)[:1000]
            results["results"].append(record)
            write_private_report(output, results)
    print(json.dumps({"model": args.model, "cases": len(cases), "errors": sum("error" in item for item in results["results"]), "output": str(output)}))
    return int(any("error" in item for item in results["results"]))


if __name__ == "__main__":
    raise SystemExit(main())
