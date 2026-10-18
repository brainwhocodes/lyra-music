import { test, expect, type Locator } from "@playwright/test";
import {
  audit,
  checkAccessibility,
  checkLayout,
  guard,
  login,
  navigate,
} from "./helpers";
import { holdActualResponse } from "./held-response";

async function expectSkeleton(status: Locator) {
  await expect(status).toBeVisible();
  await expect(status).toHaveAttribute("aria-busy", "true");
  // Decorative placeholder geometry has no accessible role or interactive target.
  const decorative = status.locator('[aria-hidden="true"]');
  await expect(decorative).toHaveCount(1);
  expect(await decorative.locator("a,button,input,[tabindex]").count()).toBe(0);
  const box = await decorative.boundingBox();
  expect(
    box?.height,
    "Loading must reserve real content space",
  ).toBeGreaterThan(44);
}

async function expectGenreArtwork(link: Locator) {
  // The artwork is decorative inside an already named link. Inspect the real
  // image only after reaching that link through its accessible name.
  const image = link.locator("img");
  await expect(image).toHaveCount(1);
  await expect(image).toHaveAttribute("src", /\/images\/genres\/[a-z-]+-genre-art\.webp$/);
  await expect.poll(() => image.evaluate((node: HTMLImageElement) =>
    node.complete && node.naturalWidth > 100 && node.naturalHeight > 100,
  )).toBe(true);
}

test("collection skeletons follow genuine pending requests and yield to usable content", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = guard(page);
  await login(page);
  await navigate(page, "Settings");
  const libraryRequests = await Promise.all(
    ["/api/albums", "/api/artists", "/api/genres", "/api/playlists"].map(
      (path) => holdActualResponse(page, path),
    ),
  );
  try {
    await navigate(page, "Library");
    await Promise.all(libraryRequests.map((request) => request.ready));
    for (const label of [
      "Loading albums…",
      "Loading artists…",
      "Loading genres…",
      "Loading playlists…",
    ]) {
      await expectSkeleton(
        page.getByRole("status", { name: label, exact: true }),
      );
    }
    await audit(page, info, "skeleton-library");
    await checkLayout(page);
    await checkAccessibility(page, info, "skeleton-library");
  } finally {
    await Promise.all(libraryRequests.map((request) => request.cleanup()));
  }
  await expect(
    page.getByRole("link", { name: "Monomyth", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading albums…", exact: true }),
  ).toHaveCount(0);
  await expectGenreArtwork(page.getByRole("link", { name: /^Ambient\s*Browse albums$/ }));

  const collections = [
    {
      nav: "Albums",
      path: "/api/albums",
      label: "Loading albums…",
      link: "Monomyth",
      exact: true,
    },
    {
      nav: "Artists",
      path: "/api/artists",
      label: "Loading artists…",
      link: "Scott Buckley",
      exact: false,
    },
    {
      nav: "Genres",
      path: "/api/genres",
      label: "Loading genres…",
      link: "Ambient",
      exact: false,
    },
    {
      nav: "Playlists",
      path: "/api/playlists",
      label: "Loading playlists…",
      link: "Local listening",
      exact: true,
    },
    {
      nav: "Podcasts",
      path: "/api/podcasts",
      label: "Loading podcasts…",
      link: "Listening Notes",
      exact: true,
    },
    {
      nav: "Discover",
      path: "/api/discovery-playlists",
      label: "Loading discovery playlists…",
      link: "Quiet discoveries",
      exact: true,
    },
    {
      nav: "Radio",
      path: "/api/radio-stations",
      label: "Loading stations…",
      link: "Quiet hours",
      exact: true,
    },
  ];
  for (const collection of collections) {
    const request = await holdActualResponse(page, collection.path);
    try {
      await navigate(page, collection.nav);
      await request.ready;
      await expectSkeleton(
        page.getByRole("status", { name: collection.label, exact: true }),
      );
      await checkLayout(page);
      await audit(page, info, "skeleton-" + collection.nav.toLowerCase());
    } finally {
      await request.cleanup();
    }
    await expect(
      page.getByRole("status", { name: collection.label, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", {
        name: collection.link,
        exact: collection.exact,
      }),
    ).toBeVisible();
    if (collection.nav === "Genres") {
      await expectGenreArtwork(page.getByRole("link", { name: /Ambient/ }));
      await checkLayout(page);
      await checkAccessibility(page, info, "genre-artwork-ready");
      await audit(page, info, "genre-artwork-ready");
      if (info.project.name === "desktop") {
        const viewport = page.viewportSize()!;
        await page.setViewportSize({ width: 320, height: 800 });
        await navigate(page, "Artists");
        const compactRequest = await holdActualResponse(page, "/api/genres");
        try {
          await navigate(page, "Genres");
          await compactRequest.ready;
          await expectSkeleton(page.getByRole("status", { name: "Loading genres…", exact: true }));
          await checkLayout(page);
          await audit(page, info, "compact320-skeleton-genres");
        } finally { await compactRequest.cleanup(); }
        await expectGenreArtwork(page.getByRole("link", { name: /Ambient/ }));
        await checkLayout(page);
        await checkAccessibility(page, info, "compact320-genre-artwork-ready");
        await audit(page, info, "compact320-genre-artwork-ready");
        await page.setViewportSize(viewport);
        // The shell observes usable width asynchronously. Wait for its real
        // desktop navigation before the next action samples compact controls.
        await expect(page.getByRole("button", { name: "Open navigation menu" })).not.toBeVisible();
      }
    }
  }
  await page.getByRole("link", { name: "Quiet hours", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quiet hours", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("detail skeletons honor reduced motion, preserve focus and disappear after real responses", async ({
  page,
}, info) => {
  test.setTimeout(150_000);
  const errors = guard(page);
  await login(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const album = await holdActualResponse(
    page,
    "/api/albums/album-the-distant-sun",
  );
  try {
    await page.getByRole("link", { name: "Monomyth", exact: true }).click();
    await album.ready;
    const status = page.getByRole("status", {
      name: "Loading album…",
      exact: true,
    });
    await expectSkeleton(status);
    // Animation styles are read-only diagnostics; navigation remains semantic.
    expect(
      await status
        .locator('[aria-hidden="true"] *')
        .evaluateAll((nodes) =>
          nodes.every(
            (node) => getComputedStyle(node).animationName === "none",
          ),
        ),
    ).toBe(true);
    await audit(page, info, "skeleton-detail-reduced-motion");
    await checkAccessibility(page, info, "skeleton-detail-reduced-motion");
    await checkLayout(page);
  } finally {
    await album.cleanup();
  }
  await expect(
    page.getByRole("heading", { name: "Monomyth", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading album…", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add to playlist", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Add Monomyth to playlist", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Add Monomyth to playlist", exact: true }),
  ).not.toBeVisible();
  const details = [
    {
      nav: "Artists",
      link: "Scott Buckley",
      exact: false,
      path: "/api/artists/scott-buckley",
      label: "Loading artist…",
      heading: "Scott Buckley",
    },
    {
      nav: "Playlists",
      link: "Local listening",
      exact: true,
      path: "/api/playlists/local-listening",
      label: "Loading playlist…",
      heading: "Local listening",
    },
    {
      nav: "Podcasts",
      link: "Listening Notes",
      exact: true,
      path: "/api/podcasts/listening-notes",
      label: "Loading podcast…",
      heading: "Listening Notes",
    },
    {
      nav: "Discover",
      link: "Quiet discoveries",
      exact: true,
      path: "/api/discovery-playlists/local-discoveries",
      label: "Loading discovery playlist…",
      heading: "Quiet discoveries",
    },
    {
      nav: "Radio",
      link: "Quiet hours",
      exact: true,
      path: "/api/radio-stations/quiet-hours",
      label: "Loading station…",
      heading: "Quiet hours",
    },
    {
      nav: "Genres",
      link: "Ambient",
      exact: false,
      path: "/api/genres/ambient/albums",
      label: "Loading this genre…",
      heading: "Ambient",
    },
  ];
  for (const detail of details) {
    await navigate(page, detail.nav);
    const request = await holdActualResponse(page, detail.path);
    try {
      await page
        .getByRole("link", { name: detail.link, exact: detail.exact })
        .click();
      await request.ready;
      await expectSkeleton(
        page.getByRole("status", { name: detail.label, exact: true }),
      );
      await checkLayout(page);
      await audit(page, info, "skeleton-detail-" + detail.nav.toLowerCase());
    } finally {
      await request.cleanup();
    }
    await expect(
      page.getByRole("status", { name: detail.label, exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", {
        name: detail.heading,
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("playlist loading errors remain recoverable after the session changes in another tab", async ({
  page,
  context,
}, info) => {
  test.setTimeout(90_000);
  const errors = guard(page, [{ path: "/api/playlists", status: 401 }]);
  await login(page);
  await page.getByRole("link", { name: "Monomyth", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Monomyth", exact: true }),
  ).toBeVisible();
  const sessionTab = await context.newPage();
  await sessionTab.goto("/logout");
  await expect(sessionTab).toHaveURL("http://127.0.0.1:3100/");
  const request = await holdActualResponse(page, "/api/playlists");
  const picker = page.getByRole("dialog", {
    name: "Add Monomyth to playlist",
    exact: true,
  });
  try {
    await page
      .getByRole("button", { name: "Add to playlist", exact: true })
      .click();
    await request.ready;
    await expectSkeleton(
      picker.getByRole("status", { name: "Loading playlists…", exact: true }),
    );
    await expect(
      picker.getByRole("button", { name: "Cancel", exact: true }),
    ).toBeFocused();
    await audit(page, info, "skeleton-playlist-picker");
  } finally {
    await request.cleanup();
  }
  await expect(picker.getByRole("alert")).toContainText(
    "Could not load playlists",
  );
  await expect(
    picker.getByText("No playlists yet.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    picker.getByRole("status", { name: "Loading playlists…", exact: true }),
  ).toHaveCount(0);
  await audit(page, info, "playlist-picker-load-error");
  await checkAccessibility(page, info, "playlist-picker-load-error");
  await login(sessionTab);
  await sessionTab.close();
  await picker
    .getByRole("button", { name: "Retry loading playlists", exact: true })
    .click();
  await expect(
    picker.getByRole("button", { name: "Local listening", exact: true }),
  ).toBeVisible();
  await expect(picker.getByRole("alert")).toHaveCount(0);
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(picker).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add to playlist", exact: true }),
  ).toBeFocused();
  // A full document request proves cookies are forwarded by the SSR session check.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Monomyth", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
