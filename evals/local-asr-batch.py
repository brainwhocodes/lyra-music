"""Offline fixed-control ASR batch with separate cold and warm measurements."""
import argparse
import array
import contextlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("model_runtime", ROOT / "scripts/model-runtime.py")
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


def read_fixture(example):
    source = (ROOT / example["file"]).resolve(strict=True)
    runtime.verify_file(source, example["sha256"])
    with wave.open(str(source), "rb") as audio:
        if (audio.getframerate(), audio.getnchannels(), audio.getsampwidth()) != (16000, 1, 2):
            raise ValueError("ASR comparison expects mono 16kHz/int16 WAV.")
        if not 0 < audio.getnframes() <= 30 * 16000:
            raise ValueError("ASR comparison accepts at most 30 seconds per fixture.")
        samples = array.array("h", audio.readframes(audio.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    return array.array("f", (value / 32768 for value in samples))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("model", choices=["whistle", "gemma-audio"])
    args = parser.parse_args()
    state = json.loads((ROOT / ".tools/models/setup-state.json").read_text(encoding="utf-8"))
    artifact = state["models"][args.model]
    manifest = json.loads((ROOT / "evals/fixtures/transcription.json").read_text(encoding="utf-8"))
    if not 1 <= len(manifest["cases"]) <= 16:
        raise ValueError("The fixed comparison batch must contain 1–16 controls.")
    runtime.forbid_network()
    started = time.perf_counter()
    runtime.verify_artifact(args.model, artifact)
    verified = time.perf_counter()
    with contextlib.redirect_stdout(sys.stderr):
        if args.model == "whistle":
            os.environ["NEEDLE3_LIB_PATH"] = artifact["enginePath"]
            import needle
            model = needle.Whistle(weights=artifact["modelPath"], buffer_size=4 * 1024**2)
        else:
            from gemma_audio import load_model, transcribe
            model, processor = load_model(artifact["snapshotPath"])
        loaded = time.perf_counter()
        results = []
        for example in manifest["cases"]:
            begin = time.perf_counter()
            pcm = read_fixture(example)
            inference_started = time.perf_counter()
            if args.model == "whistle":
                decoded = model.transcribe(pcm, word_timestamps=True)
                result = {"text": decoded.get("text", ""), "words": decoded.get("words", []),
                          "wordTimestamps": True, "hitTokenLimit": False, "hitTimeLimit": False}
            else:
                result = transcribe(model, processor, pcm)
            results.append({"id": example["id"], **result,
                            "inferenceSeconds": round(time.perf_counter() - inference_started, 4),
                            "caseSeconds": round(time.perf_counter() - begin, 4)})
            print(f"Completed {args.model} control {len(results)}/{len(manifest['cases'])}", file=sys.stderr, flush=True)
    print(json.dumps({"model": artifact["repo"], "revision": artifact["revision"], "weightsSha256": artifact["sha256"],
                      "artifactVerificationSeconds": round(verified - started, 4),
                      "modelLoadSeconds": round(loaded - verified, 4), "results": results}, allow_nan=False))


if __name__ == "__main__":
    main()
