"""One-shot offline comparison adapter, deliberately separate from production."""
import argparse
import json
import os

parser = argparse.ArgumentParser()
parser.add_argument("audio", nargs="?")
parser.add_argument("--prepare", action="store_true")
args = parser.parse_args()
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
if not args.prepare:
    os.environ["HF_HUB_OFFLINE"] = "1"
from faster_whisper import WhisperModel
from huggingface_hub import snapshot_download

# Pin the public model revision so a later Hub update does not move the baseline.
revision = "3d3d5dee26484f91867d81cb899cfcf72b96be6c"
path = snapshot_download("Systran/faster-whisper-base.en", revision=revision,
                         allow_patterns=["model.bin", "config.json", "tokenizer.json", "vocabulary.txt"],
                         local_files_only=not args.prepare)
model = WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=4,
                     local_files_only=True)
if args.prepare:
    print(json.dumps({"model": "Systran/faster-whisper-base.en", "revision": revision, "ready": True}))
else:
    if not args.audio:
        parser.error("audio is required unless --prepare is used")
    # Same English input, no prompt/ground truth. VAD is intentionally disabled:
    # the model must face the silence/music controls instead of skipping them.
    segments, info = model.transcribe(args.audio, language="en", beam_size=5,
                                      word_timestamps=True, vad_filter=False,
                                      condition_on_previous_text=False)
    words = [{"word": word.word.strip(), "start": word.start, "end": word.end,
              "probability": word.probability}
             for segment in segments for word in (segment.words or [])]
    print(json.dumps({"words": words, "text": " ".join(word["word"] for word in words)}, allow_nan=False))
