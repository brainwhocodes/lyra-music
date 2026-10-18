"""Download three CC-BY-4.0 LibriSpeech clips and build reproducible ASR controls.

Network is used only by this preparation command. The comparison itself is offline.
"""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import urllib.request
import wave
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "evals" / "fixtures" / "speech"
DATA.mkdir(parents=True, exist_ok=True)
FFMPEG = os.environ.get("WHISTLE_FFMPEG_PATH", "ffmpeg")
API = "https://datasets-server.huggingface.co/rows?dataset=hf-internal-testing%2Flibrispeech_asr_dummy&config=clean&split=validation&offset=0&length=73"
MANIFEST = ROOT / "evals" / "fixtures" / "transcription.json"
existing = {item["id"]: item for item in json.loads(MANIFEST.read_text(encoding="utf-8"))["cases"]} if MANIFEST.exists() else {}


def convert(args, output):
    subprocess.run([FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *args,
                    "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(output)],
                   check=True, timeout=60)


def entry(path, identifier, kind, reference, **extra):
    with wave.open(str(path)) as audio:
        duration = audio.getnframes() / audio.getframerate()
    return dict(id=identifier, kind=kind, reference=reference,
                file=path.relative_to(ROOT).as_posix(), durationSeconds=duration,
                sha256=hashlib.sha256(path.read_bytes()).hexdigest(), **extra)


with urllib.request.urlopen(API, timeout=30) as response:
    rows = json.load(response)["rows"]
manifest = []
for index, identifier in [(0, "1272-128104-0000"), (20, "1272-135031-0005"), (50, "1272-141231-0010")]:
    row = rows[index]["row"]
    if row["id"] != identifier:
        raise ValueError("The upstream dataset changed row identity; inspect it before changing this fixture.")
    source = DATA / f"{row['id']}.flac"
    if not source.exists():
        url = row["audio"][0]["src"]
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != "datasets-server.huggingface.co":
            raise ValueError("Unexpected fixture download host.")
        with urllib.request.urlopen(url, timeout=30) as response:
            source.write_bytes(response.read())
    if identifier in existing and (existing[identifier]["reference"] != row["text"] or
            existing[identifier]["sourceSha256"] != hashlib.sha256(source.read_bytes()).hexdigest()):
        raise ValueError("The source audio/reference changed; refusing to replace the reviewed fixture.")
    path = DATA / f"{row['id']}.wav"
    convert(["-i", str(source)], path)
    manifest.append(entry(path, row["id"], "human-speech", row["text"],
                          source="https://huggingface.co/datasets/hf-internal-testing/librispeech_asr_dummy",
                          corpus="https://www.openslr.org/12", speakerId=row["speaker_id"],
                          attribution="LibriSpeech, Vassil Panayotov and Daniel Povey; LibriVox narrator 1272",
                          license="CC-BY-4.0", licenseUrl="https://creativecommons.org/licenses/by/4.0/",
                          sourceSha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                          modification="Decoded FLAC to mono 16 kHz PCM WAV; no trimming."))

silence = DATA / "silence-10s.wav"
with wave.open(str(silence), "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(16000)
    audio.writeframes(bytes(16000 * 2 * 10))
manifest.append(entry(silence, "silence", "silence", "", source="Generated digital zero samples."))

music = ROOT / "tests" / "fixtures" / "music"
for track in json.loads((music / "manifest.json").read_text(encoding="utf-8"))["tracks"]:
    path = DATA / f"{track['id']}.wav"
    convert(["-i", str(music / track["file"])], path)
    manifest.append(entry(path, track["id"], "instrumental", "",
                          source=track["sourcePage"], attribution="Scott Buckley",
                          license="CC-BY-4.0", licenseUrl="https://creativecommons.org/licenses/by/4.0/",
                          modification="Existing 12-second excerpt decoded to mono 16 kHz PCM WAV."))

speech = ROOT / manifest[0]["file"]
background = DATA / "the-distant-sun.wav"
mixed = DATA / "speech-with-music.wav"
convert(["-i", str(speech), "-i", str(background), "-filter_complex",
         "[1:a]volume=0.25[m];[0:a][m]amix=inputs=2:duration=first:normalize=0"], mixed)
manifest.append(entry(mixed, "speech-with-music", "speech-with-music", manifest[0]["reference"],
                      source="Derived from 1272-128104-0000 and The Distant Sun above.",
                      attribution="LibriSpeech / LibriVox narrator 1272 and Scott Buckley",
                      license="CC-BY-4.0", licenseUrl="https://creativecommons.org/licenses/by/4.0/",
                      modification="Music gain 0.25; mixed without normalization; duration follows speech."))
tts = music / "audio" / "spoken-test.wav"
manifest.append(entry(tts, "synthetic-speech", "synthetic-speech", "The music plays softly in the morning.",
                      source="Original locally generated speech; see tests/fixtures/music/README.md."))
if existing:
    for item in manifest:
        if item["sha256"] != existing[item["id"]]["sha256"]:
            raise ValueError(f"Prepared bytes differ for {item['id']}. Check the FFmpeg version and fixture changes before refreshing the manifest.")
else:
    MANIFEST.write_text(json.dumps({"version": 1, "cases": manifest}, indent=2) + "\n", encoding="utf-8")
print(f"Prepared {len(manifest)} checksummed cases. One human narrator; no singing reference set.")
