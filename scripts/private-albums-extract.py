#!/usr/bin/env python3
"""Opt-in local corpus extraction. No private bytes or names belong in Git."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import tempfile
import unittest
import zipfile

ARCHIVES = [
    "Disasterpeace - Rise of the Obsidian Interstellar.zip",
    "Desired - Lovestory.zip",
    "LemKuuja - Transistor.zip",
    "Future Girlfriend - Pink Dance EP ピンクのダンス.zip",
]
MAX_FILES = 2000
MAX_FILE = 128 * 1024 * 1024
MAX_TOTAL = 1024 * 1024 * 1024
MAX_RATIO = 200
AUDIO = {".ogg", ".mp3", ".flac", ".wav", ".m4a", ".opus", ".aac"}
DEVICE = re.compile(r"^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)", re.I)


def digest(path):
    value = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            value.update(block)
    return value.hexdigest()


def checked_members(archive):
    """Validate the complete central directory before writing any entry."""
    entries = archive.infolist()
    if len(entries) > MAX_FILES:
        raise ValueError("ZIP entry-count limit exceeded")
    seen = {}
    total = 0
    result = []
    for entry in entries:
        # ZipInfo normalizes Windows separators and truncates NULs; validate
        # the original central-directory spelling before accepting that form.
        name = entry.orig_filename
        if not name or "\x00" in name or "\\" in name or name.startswith("/"):
            raise ValueError("Unsafe ZIP path")
        parts = name.rstrip("/").split("/")
        if any(p in ("", ".", "..") or any(c in p for c in ':<>"|?*') or p[-1:] in (".", " ")
               or DEVICE.match(p) or any(ord(c) < 32 for c in p) for p in parts):
            raise ValueError("Unsafe ZIP component")
        if len(name) > 230:
            raise ValueError("ZIP path too long for portable extraction")
        mode = entry.external_attr >> 16
        kind = stat.S_IFMT(mode)
        if kind not in (0, stat.S_IFREG, stat.S_IFDIR) or entry.flag_bits & 1:
            raise ValueError("Links, special files, and encrypted entries are forbidden")
        if kind == stat.S_IFDIR and not entry.is_dir():
            raise ValueError("Inconsistent ZIP directory metadata")
        key = "/".join(parts).casefold()
        if key in seen:
            raise ValueError("Duplicate or case-colliding ZIP entry")
        seen[key] = entry.is_dir()
        if entry.file_size > MAX_FILE or entry.file_size < 0:
            raise ValueError("ZIP per-file size limit exceeded")
        if entry.file_size > max(1, entry.compress_size) * MAX_RATIO:
            raise ValueError("ZIP compression-ratio limit exceeded")
        total += entry.file_size
        if total > MAX_TOTAL:
            raise ValueError("ZIP expanded size limit exceeded")
        result.append((entry, PurePosixPath(*parts)))
    for key in seen:
        parts = key.split("/")
        for index in range(1, len(parts)):
            if seen.get("/".join(parts[:index])) is False:
                raise ValueError("ZIP file/directory path conflict")
    return result


def private_root(workspace):
    workspace = workspace.resolve(strict=True)
    candidate = workspace / ".test-data" / "private-albums"
    # Reject any preexisting redirected component, including Windows junctions.
    cursor = workspace
    for part in (".test-data", "private-albums"):
        cursor = cursor / part
        if cursor.exists() and (cursor.is_symlink() or cursor.resolve() != cursor.absolute()):
            raise ValueError("Private workspace must not contain redirects")
    candidate.mkdir(parents=True, exist_ok=True)
    if not candidate.resolve().is_relative_to(workspace):
        raise ValueError("Private workspace escaped repository")
    return candidate


def unredirected_path(root, relative):
    """Resolve no links, including junctions inside an existing private corpus."""
    root = root.resolve(strict=True)
    spelling = str(relative).replace("\\", "/")
    parts = spelling.split("/")
    if not spelling or any(part in ("", ".", "..") or ":" in part for part in parts):
        raise ValueError("Manifest path escaped extraction")
    cursor = root
    for part in parts:
        cursor = cursor / part
        if cursor.is_symlink() or (cursor.exists() and cursor.resolve() != cursor.absolute()):
            raise ValueError("Private corpus must not contain redirects")
    if not cursor.resolve().is_relative_to(root):
        raise ValueError("Manifest path escaped extraction")
    return cursor


def extract(workspace, archive_paths):
    root = private_root(workspace)
    destination = root / "extracted"
    if destination.exists():
        raise FileExistsError("Private extraction exists; use --verify. Never overwrite it.")
    total = 0
    # Validate all archives before allocating an extraction directory.
    for path in archive_paths:
        if path.stat().st_size > MAX_TOTAL:
            raise ValueError("Compressed archive size limit exceeded")
        with zipfile.ZipFile(path) as archive:
            total += sum(info.file_size for info, _ in checked_members(archive))
    if total > MAX_TOTAL:
        raise ValueError("Combined expanded corpus exceeds size limit")
    staging = Path(tempfile.mkdtemp(prefix="extract-", dir=root))
    report = {"schemaVersion": 1, "private": True, "archives": [], "files": []}
    try:
        for index, path in enumerate(archive_paths, 1):
            album_folder = f"album-{index:02d}"
            report["archives"].append({"index": index, "path": str(path), "sha256": digest(path)})
            with zipfile.ZipFile(path) as archive:
                for info, relative in checked_members(archive):
                    target = staging / album_folder / relative
                    if not target.resolve().is_relative_to(staging.resolve()):
                        raise ValueError("ZIP target escaped staging")
                    if info.is_dir():
                        target.mkdir(parents=True, exist_ok=True)
                        continue
                    target.parent.mkdir(parents=True, exist_ok=True)
                    count = 0
                    with archive.open(info) as source, open(target, "xb") as output:
                        while block := source.read(1024 * 1024):
                            count += len(block)
                            if count > info.file_size or count > MAX_FILE:
                                raise ValueError("ZIP actual expanded size exceeded declared size")
                            output.write(block)
                    if count != info.file_size:
                        raise ValueError("ZIP entry size mismatch")
                    report["files"].append({"album": index, "relativePath": str(Path(album_folder) / relative),
                        "bytes": count, "sha256": digest(target), "audio": target.suffix.lower() in AUDIO})
        (staging / "manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        # Destination never existed, so rename cannot overwrite user files.
        if destination.exists():
            raise FileExistsError("Extraction destination appeared during work")
        staging.rename(destination)
        return report
    except BaseException:
        if staging.resolve().is_relative_to(root.resolve()) and staging.name.startswith("extract-"):
            shutil.rmtree(staging)
        raise


def verify(workspace):
    directory = unredirected_path(private_root(workspace), "extracted")
    # Check the manifest before opening it as well as every recorded file.
    manifest = unredirected_path(directory, "manifest.json")
    report = json.loads(manifest.read_text(encoding="utf-8"))
    for item in report["files"]:
        candidate = unredirected_path(directory, item["relativePath"])
        if candidate.stat().st_size != item["bytes"] or digest(candidate) != item["sha256"]:
            raise ValueError("Extracted private file changed")
    for item in report["archives"]:
        if digest(item["path"]) != item["sha256"]:
            raise ValueError("Original archive changed")
    return report


class SecurityTests(unittest.TestCase):
    def test_verification_rejects_extracted_and_nested_redirects(self):
        with tempfile.TemporaryDirectory() as directory:
            workspace = Path(directory)
            root = private_root(workspace)
            outside = workspace / "outside"
            outside.mkdir()
            (outside / "manifest.json").write_text('{"files": [], "archives": []}', encoding="utf-8")

            def redirect(target, link):
                if os.name == "nt":
                    import _winapi
                    _winapi.CreateJunction(str(target), str(link))
                else:
                    link.symlink_to(target, target_is_directory=True)

            redirect(outside, root / "extracted")
            with self.assertRaisesRegex(ValueError, "redirects"):
                verify(workspace)
            # rmdir removes the Windows junction itself; unlink removes a POSIX
            # directory symlink. Neither follows it into the target directory.
            os.rmdir(root / "extracted") if os.name == "nt" else (root / "extracted").unlink()
            extracted = root / "extracted"
            extracted.mkdir()
            redirect(outside, extracted / "album-01")
            (extracted / "manifest.json").write_text(json.dumps({"files": [{
                "relativePath": "album-01/manifest.json", "bytes": (outside / "manifest.json").stat().st_size,
                "sha256": digest(outside / "manifest.json")
            }], "archives": []}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "redirects"):
                verify(workspace)
            self.assertTrue((outside / "manifest.json").is_file())

    def test_reject_unsafe_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "unsafe.zip"
            for name in ("../escape", "/absolute", "C:/drive", "a\\b", "CON.txt", "COM¹.txt", "x:stream", "a./x"):
                with self.subTest(name=name):
                    with zipfile.ZipFile(target, "w") as archive:
                        info = zipfile.ZipInfo("placeholder")
                        info.filename = name
                        archive.writestr(info, b"x")
                    with zipfile.ZipFile(target) as archive, self.assertRaises(ValueError):
                        checked_members(archive)

    def test_reject_links_collisions_and_bombs(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "unsafe.zip"
            for variant in ("link", "case", "parent", "bomb"):
                with self.subTest(variant=variant):
                    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                        if variant == "link":
                            info = zipfile.ZipInfo("link")
                            info.create_system = 3
                            info.external_attr = (stat.S_IFLNK | 0o777) << 16
                            archive.writestr(info, "../../outside")
                        elif variant == "case":
                            archive.writestr("Cover.jpg", b"a")
                            archive.writestr("cover.jpg", b"b")
                        elif variant == "parent":
                            archive.writestr("folder", b"a")
                            archive.writestr("folder/child", b"b")
                        else:
                            archive.writestr("bomb", b"0" * 1024 * 1024)
                    with zipfile.ZipFile(target) as archive, self.assertRaises(ValueError):
                        checked_members(archive)

    def test_no_overwrite_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            archive_path = root / "valid.zip"
            with zipfile.ZipFile(archive_path, "w") as archive:
                archive.writestr("音楽/track.ogg", b"original")
            before = digest(archive_path)
            extract(root, [archive_path])
            verify(root)
            with self.assertRaises(FileExistsError):
                extract(root, [archive_path])
            extracted = root / ".test-data/private-albums/extracted/album-01/音楽/track.ogg"
            extracted.write_bytes(b"changed")
            with self.assertRaises(ValueError):
                verify(root)
            self.assertEqual(before, digest(archive_path))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--music-dir", type=Path, default=Path.home() / "Music")
    parser.add_argument("--verify", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--negative-control", action="store_true", help="Disable entry validation in memory; security tests must fail")
    args = parser.parse_args()
    if args.negative_control and not args.self_test:
        parser.error('--negative-control requires --self-test')
    if args.self_test:
        if args.negative_control:
            global checked_members
            checked_members = lambda archive: [(entry, PurePosixPath(entry.filename)) for entry in archive.infolist()]
        result = unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(SecurityTests))
        raise SystemExit(0 if result.wasSuccessful() else 1)
    workspace = Path(__file__).resolve().parent.parent
    paths = [args.music_dir / name for name in ARCHIVES]
    missing = sum(not path.is_file() for path in paths)
    if missing:
        print(json.dumps({"status": "skipped", "reason": "Private album archives are not installed", "missingArchives": missing}))
        return
    report = verify(workspace) if args.verify else extract(workspace, paths)
    print(json.dumps({"status": "verified" if args.verify else "extracted", "archives": len(report["archives"]),
        "files": len(report["files"]), "audioFiles": sum(item["audio"] for item in report["files"]),
        "bytes": sum(item["bytes"] for item in report["files"])}))


if __name__ == "__main__":
    main()
