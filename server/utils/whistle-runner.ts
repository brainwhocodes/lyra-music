/** Embedded so Nitro bundles the runner into production output, independent of cwd. */
export const WHISTLE_PYTHON_RUNNER = String.raw`
import array
import contextlib
import json
import os
import sys

os.environ["NEEDLE_TELEMETRY"] = "0"
os.environ["DO_NOT_TRACK"] = "1"
# Provision the public weights/engine once during setup. Requests never download.
os.environ["HF_HUB_OFFLINE"] = "1"
sys.stdout.reconfigure(encoding="utf-8")

with contextlib.redirect_stdout(sys.stderr):
    import needle
    samples = array.array("h")
    with open(sys.argv[1], "rb") as audio:
        samples.frombytes(audio.read())
    if sys.byteorder != "little":
        samples.byteswap()
    pcm = array.array("f", (sample / 32768.0 for sample in samples))
    model = needle.Whistle(weights=sys.argv[2] or None, buffer_size=4 * 1024 * 1024)
    result = model.transcribe(pcm, word_timestamps=True)
print(json.dumps(result, ensure_ascii=False, allow_nan=False))
`;
