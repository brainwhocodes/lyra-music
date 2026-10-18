"""Build the portable Lyra Radio identity archive using only Python's standard library.

Run from any directory. --refresh-fonts retrieves the exact Google Fonts CSS/API
sources and official license metadata; ordinary rebuilds use the saved files.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
from urllib.request import Request, urlopen
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs/design/lyra-radio"
FONT_DIRECTORY = DIRECTORY / "fonts"
FONT_CSS_URL = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Space+Grotesk:wght@400;500;600;700&display=swap"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"
ARCHIVE_NAME = "lyra-radio-brandkit.zip"
BOARD = "docs/design/lyra-radio/brand-board.png"
ART = "public/images/lyra-radio/rooftop-dj.png"
WORDMARK = "public/images/lyra-radio/wordmark.png"
HOME_RAW = r"C:\Users\mille\.codex\generated_images\01a14dff-a0e9-76b1-92b0-c50f1c963b23\exec-e01baafa-e0d5-4358-a4f6-8303ac1e054d.png"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def png_info(path: Path) -> dict:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise ValueError(f"Not a PNG: {path}")
    width, height = struct.unpack(">II", data[16:24])
    return {"width": width, "height": height, "bytes": len(data), "sha256": digest(data)}


def raw_path(record: dict) -> Path:
    match = re.search(r" as (C:\\[^\r\n]+\.png) by default\.", record["output_hint"])
    if not match:
        raise ValueError("Missing actual generator output path")
    return Path(match.group(1))


def input_reference(path: Path, included_path: str) -> dict:
    # Original absolute paths describe generation inputs; portable paths point
    # to byte-identical copies included in the archive.
    original = png_info(path)
    included = png_info(ROOT / included_path)
    if original["sha256"] != included["sha256"]:
        raise ValueError(f"Generation input differs from packaged copy: {path}")
    return {"sourcePath": str(path), "portablePath": included_path, **original}


def update_provenance() -> None:
    generation_path = DIRECTORY / "generation-records.json"
    generation = json.loads(generation_path.read_text(encoding="utf-8"))
    by_role = {record["role"]: record for record in generation}
    for record in generation:
        original = raw_path(record)
        output = png_info(ROOT / record["file"])
        if png_info(original)["sha256"] != output["sha256"]:
            raise ValueError(f"Original artwork was changed: {record['file']}")
        record["rawOutputPath"] = str(original)
        record["artifact"] = output
        references = []
        if record["role"] == "wordmark":
            references = [input_reference(raw_path(by_role["art"]), ART)]
        elif record["role"] == "mark":
            references = [input_reference(raw_path(by_role["wordmark"]), WORDMARK)]
        record["inputReferences"] = references
    write_json(generation_path, generation)

    mockups_path = DIRECTORY / "mockups.json"
    mockups = json.loads(mockups_path.read_text(encoding="utf-8"))
    for record in mockups:
        original = raw_path(record)
        output = png_info(ROOT / record["path"])
        if png_info(original)["sha256"] != output["sha256"]:
            raise ValueError(f"Selected reference was changed: {record['path']}")
        record["rawOutputPath"] = str(original)
        record["artifact"] = output
        record["intendedFrame"] = {
            "widthCssPx": 1440,
            "heightCssPx": 1800 if record["id"] == "home" else 960,
            "source": "Requested nominal 1440px browser frame; portrait 4:5 home and landscape 3:2 radio pages.",
            "rasterIsExactCssFrame": False,
            "note": "The generated raster dimensions are recorded separately. This is an art-directed reference, not a browser capture or pixel-perfect implementation claim.",
        }
        references = [(ROOT / BOARD, BOARD), (ROOT / ART, ART), (ROOT / WORDMARK, WORDMARK)]
        if record["id"] != "home":
            references = [(ROOT / BOARD, BOARD), (Path(HOME_RAW), "docs/design/lyra-radio/mockups/home.png"), (ROOT / ART, ART)]
        record["inputReferences"] = [input_reference(path, portable) for path, portable in references]
        record["inputReferencesVerifiedBy"] = "Exact imagegen path arrays confirmed by the generating agent before packaging."
    write_json(mockups_path, mockups)


def download(url: str) -> bytes:
    with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=30) as response:
        if response.status != 200:
            raise RuntimeError(f"Font source returned {response.status}: {url}")
        return response.read()


def refresh_fonts() -> None:
    FONT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    original_css = download(FONT_CSS_URL).decode("utf-8")
    (FONT_DIRECTORY / "google-fonts.css").write_text(original_css, encoding="utf-8")
    local_css = original_css
    assets = []
    for url in sorted(set(re.findall(r"url\((https://fonts\.gstatic\.com/[^)]+)\)", original_css))):
        name = url.rsplit("/", 1)[1]
        data = download(url)
        if data[:4] != b"wOF2":
            raise ValueError(f"Unexpected font content: {url}")
        (FONT_DIRECTORY / name).write_bytes(data)
        local_css = local_css.replace(url, name)
        assets.append({"file": name, "source": url, "bytes": len(data), "sha256": digest(data)})
    (FONT_DIRECTORY / "fonts.css").write_text(local_css, encoding="utf-8")
    families = []
    for family, slug, role in [
        ("Barlow Condensed", "barlowcondensed", "Selected display, genuine normal 700 and 800 faces"),
        ("Space Grotesk", "spacegrotesk", "Selected body, 400/500/600/700 from the official variable face"),
        ("Archivo Black", "archivoblack", "Comparison only; genuine normal 400; no font file bundled"),
    ]:
        records = []
        for filename in ["OFL.txt", "METADATA.pb"]:
            url = f"https://raw.githubusercontent.com/google/fonts/main/ofl/{slug}/{filename}"
            data = download(url)
            destination = f"{slug}-{filename}"
            (FONT_DIRECTORY / destination).write_bytes(data)
            records.append({"file": destination, "source": url, "sha256": digest(data)})
        families.append({"family": family, "role": role, "license": "SIL Open Font License 1.1", "officialSources": records})
    write_json(FONT_DIRECTORY / "sources.json", {
        "retrievedDate": "2026-10-18", "cssApi": FONT_CSS_URL,
        "cssSha256": digest(original_css.encode("utf-8")),
        "scope": "Unmodified official WOFF2 downloads plus local URL rewriting in fonts.css. All CSS API subsets are retained for offline rendering.",
        "families": families, "assets": assets,
    })


def package() -> None:
    source = (DIRECTORY / "brand-board.html").read_text(encoding="utf-8")
    offline = re.sub(r'^  <link[^\n]+https://fonts\.(?:googleapis|gstatic)\.com[^\n]+\n', "", source, flags=re.MULTILINE)
    offline = offline.replace('  <link rel="stylesheet" href="tokens.css">', '  <link rel="stylesheet" href="fonts/fonts.css">\n  <link rel="stylesheet" href="tokens.css">')
    if "https://fonts." in offline or 'href="fonts/fonts.css"' not in offline:
        raise ValueError("Failed to create a network-independent board")
    (DIRECTORY / "brand-board.offline.html").write_text(offline, encoding="utf-8")

    readme = """LYRA RADIO — EDITABLE BRAND KIT

Extract the complete ZIP, preserving folders. Open:
  docs/design/lyra-radio/brand-board.offline.html

This version works without a server or internet connection. Local official font
files and their SIL Open Font License notices are included in the fonts folder.
brand-board.html is the original Google Fonts API version. Both boards contain
editable live text, layout, palette and font specimens. Artwork/logo PNGs are
original raster assets, not editable vector paths. The board is a fixed 1440px
presentation; use browser zoom to view it on a smaller display.

brand-guide.md explains usage, exact weights, font licensing and the alternative
Archivo Black family (comparison only; its font is not bundled).
generation-records.json preserves actual prompts/raw generation paths and hashes.
mockups.json records selected page references, exact generation input references,
actual raster dimensions/hashes, intended nominal 1440px frames and adaptations.
Absolute source paths are provenance only; they are not runtime dependencies.
All three selected page mockups and the three original PNG assets are included.

brandkit-manifest.json and SHA256SUMS cover every payload file. The manifest and
checksum list do not hash themselves. The archive's separate .sha256 sidecar
identifies the ZIP as delivered. No application, tests, dependencies or caches
are included. Opening the HTML requires no installation. render-board.mjs is
optional repository tooling; rerendering with it requires Node and Playwright.
"""
    (DIRECTORY / "README-brandkit.txt").write_text(readme, encoding="utf-8")
    names = [
        "brand-board.html", "brand-board.offline.html", "brand-board.png",
        "brand-board.verification.json", "tokens.css", "brand-guide.md",
        "brief.md", "generation-records.json", "mockups.json", "render-board.mjs",
        "README-brandkit.txt",
    ]
    files = [DIRECTORY / name for name in names]
    files += sorted((DIRECTORY / "mockups").glob("*.png"))
    files += sorted(FONT_DIRECTORY.glob("*"))
    files += [ROOT / ART, ROOT / WORDMARK, ROOT / "public/images/lyra-radio/mark.png"]
    records = []
    for path in sorted(files):
        data = path.read_bytes()
        records.append({"path": path.relative_to(ROOT).as_posix(), "bytes": len(data), "sha256": digest(data)})
    manifest = DIRECTORY / "brandkit-manifest.json"
    write_json(manifest, {
        "format": "Lyra Radio portable brand kit v1", "archive": ARCHIVE_NAME,
        "entryPoint": "docs/design/lyra-radio/brand-board.offline.html",
        "boardArtifact": png_info(DIRECTORY / "brand-board.png"),
        "fontSource": "docs/design/lyra-radio/fonts/sources.json",
        "provenance": ["docs/design/lyra-radio/generation-records.json", "docs/design/lyra-radio/mockups.json"],
        "files": records,
    })
    checksum = DIRECTORY / "SHA256SUMS"
    checksum.write_text("".join(f"{record['sha256']}  {record['path']}\n" for record in records), encoding="utf-8")
    files += [manifest, checksum]
    archive = DIRECTORY / ARCHIVE_NAME
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
        for path in sorted(files):
            entry = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), date_time=(2026, 10, 18, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            output.writestr(entry, path.read_bytes())
    with zipfile.ZipFile(archive) as check:
        if check.testzip() is not None or len(check.namelist()) != len(files):
            raise ValueError("Archive integrity check failed")
        for record in records:
            if digest(check.read(record["path"])) != record["sha256"]:
                raise ValueError(f"Archive payload hash mismatch: {record['path']}")
    sha256 = digest(archive.read_bytes())
    (DIRECTORY / (ARCHIVE_NAME + ".sha256")).write_text(f"{sha256}  {ARCHIVE_NAME}\n", encoding="utf-8")
    print(json.dumps({"archive": str(archive), "files": len(files), "bytes": archive.stat().st_size, "sha256": sha256}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh-fonts", action="store_true")
    args = parser.parse_args()
    if args.refresh_fonts:
        refresh_fonts()
    if not (FONT_DIRECTORY / "sources.json").is_file():
        parser.error("First run requires --refresh-fonts")
    update_provenance()
    package()
