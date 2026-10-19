import { expect, type Page } from '@playwright/test';

export async function checkRadioBrandHeading(page: Page) {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Own your\s*frequency\./);
}

export async function checkRadioBrandFonts(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Read the rendered styles and native FontFaceSet. A CSS family declaration
  // alone would pass even if the browser silently rendered a fallback face.
  const fonts = await page.getByRole('heading', { level: 1 }).evaluate(heading => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(heading).fontFamily,
    headingWeight: getComputedStyle(heading).fontWeight,
    loaded: [...document.fonts].filter(face => face.status === 'loaded').map(face => ({ family: face.family.replace(/["']/g, ''), weight: face.weight })),
  }));
  expect(fonts.body.split(',')[0].replace(/["']/g, '').trim()).toBe('Space Grotesk');
  expect(fonts.heading.split(',')[0].replace(/["']/g, '').trim()).toBe('Barlow Condensed');
  expect(['700', '800']).toContain(fonts.headingWeight);
  expect(fonts.loaded.map(face => face.family)).toContain('Space Grotesk');
  const requested = Number(fonts.headingWeight);
  const loadedHeadingWeight = fonts.loaded.some(face => {
    if (face.family !== 'Barlow Condensed') return false;
    const weights = face.weight.split(/\s+/).map(weight => weight === 'normal' ? 400 : weight === 'bold' ? 700 : Number(weight));
    return weights.length === 1 ? weights[0] === requested : Math.min(...weights) <= requested && Math.max(...weights) >= requested;
  });
  expect(loadedHeadingWeight, 'The actual loaded Barlow Condensed face must support the rendered heading weight: ' + JSON.stringify(fonts)).toBe(true);
  return fonts;
}
