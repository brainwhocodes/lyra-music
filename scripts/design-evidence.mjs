import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";

const design = "docs/design/lyra";
const out = join(design, "verification");
await mkdir(out, { recursive: true });
const root = JSON.parse(
  await readFile(join(design, "root-mockup-records.json"), "utf8"),
);
const utility = JSON.parse(
  await readFile(join(design, "utility-generation-record.json"), "utf8"),
);
const references = [...root, ...utility.pages];
const resultsDirectory = process.argv[2] || "test-results";
const evidenceRuns = await readFile(
  join(resultsDirectory, "evidence-manifest.json"),
  "utf8",
)
  .then(JSON.parse)
  .catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
const paths = (await readdir(resultsDirectory, { recursive: true })).map((p) =>
  join(resultsDirectory, p),
);
const screenshots = paths.filter((p) => p.endsWith(".png"));
const routeIds = {
  "album-detail": "albums-album-the-distant-sun",
  "artist-detail": "artists-scott-buckley",
  "genre-detail": "genres-ambient",
  "playlist-detail": "playlists-local-listening",
  "discovery-detail": "discovery-local-discoveries",
  "podcast-detail": "podcasts-listening-notes",
  "radio-detail": "radio-quiet-hours",
  "radio-settings": "settings-radio",
  "radio-edit": "settings-radio-quiet-hours",
};
const stateFiles = {
  "full-player": "full-screen-player.png",
  "queue-state": "queue-keyboard.png",
  "lyrics-state": "lyrics-current-track.png",
};
const digest = (data) => createHash("sha256").update(data).digest("hex");
async function identity(path) {
  const bytes = await readFile(path);
  const meta = await sharp(bytes).metadata();
  return {
    path: path.replaceAll("\\", "/"),
    sha256: digest(bytes),
    width: meta.width,
    height: meta.height,
  };
}
const records = [];
for (const ref of references) {
  const referencePath = ref.path || ref.savedPath;
  const reference = await identity(referencePath);
  const fileName =
    stateFiles[ref.id] || `route-${routeIds[ref.id] || ref.id}.png`;
  const captures = {};
  for (const viewport of ["desktop", "tablet", "mobile"]) {
    const path = screenshots.find(
      (p) => p.includes(`-${viewport}`) && basename(p) === fileName,
    );
    if (path) captures[viewport] = await identity(path);
  }
  const primary =
    captures[stateFiles[ref.id] ? "mobile" : "desktop"] ||
    captures.mobile ||
    captures.tablet;
  const record = {
    id: ref.id,
    routes: ref.routes,
    reference,
    captures,
    comparison: null,
    overlay: null,
  };
  if (primary) {
    // Comparison-only uniform scaling. Raw references and browser captures remain untouched.
    const columnWidth = 720;
    const left = await sharp(referencePath)
      .resize({ width: columnWidth })
      .png()
      .toBuffer();
    const right = await sharp(primary.path)
      .resize({ width: columnWidth })
      .png()
      .toBuffer();
    const lm = await sharp(left).metadata(),
      rm = await sharp(right).metadata();
    const height = Math.max(lm.height, rm.height);
    const comparison = join(out, `${ref.id}-comparison.webp`);
    await sharp({
      create: {
        width: columnWidth * 2 + 16,
        height: height + 44,
        channels: 4,
        background: "#e3d9c9",
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="1456" height="44"><text x="14" y="28" font-family="sans-serif" font-size="18">Selected reference</text><text x="750" y="28" font-family="sans-serif" font-size="18">Production browser · ${primary.width}px capture</text></svg>`,
          ),
          left: 0,
          top: 0,
        },
        { input: left, left: 0, top: 44 },
        { input: right, left: 736, top: 44 },
      ])
      .webp({ quality: 92 })
      .toFile(comparison);
    const { data, info } = await sharp(right)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4)
      data[i] = Math.round(data[i] * 0.5);
    const overlay = join(out, `${ref.id}-overlay.webp`);
    await sharp({
      create: {
        width: columnWidth,
        height,
        channels: 4,
        background: "#f4efe5",
      },
    })
      .composite([
        { input: left, left: 0, top: 0 },
        { input: data, raw: info, left: 0, top: 0 },
      ])
      .webp({ quality: 92 })
      .toFile(overlay);
    record.comparison = comparison.replaceAll("\\", "/");
    record.overlay = overlay.replaceAll("\\", "/");
  }
  records.push(record);
}
const assets = await Promise.all(
  [
    "public/images/lyra/listening-room.png",
    "public/images/lyra/mark.png",
    join(design, "brand-board.png"),
  ].map(identity),
);
await writeFile(
  join(out, "manifest.json"),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      tool: `sharp ${sharp.versions.sharp}`,
      command: `node scripts/design-evidence.mjs ${resultsDirectory}`,
      evidenceRuns,
      method:
        "Aspect-preserving 720px-wide comparison copies, top-left alignment, no masking. Overlay: production alpha 50% over selected reference. Originals untouched. No numerical fidelity score.",
      odiff:
        "ODiff was unavailable on this host; these overlays and regional visual review are the fallback. No ODiff run claimed.",
      assets,
      records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    references: records.length,
    compared: records.filter((r) => r.comparison).length,
    missing: records.filter((r) => !r.comparison).map((r) => r.id),
  }),
);
