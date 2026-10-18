import { expect, type APIResponse, type Page, type Request, type Route } from '@playwright/test';

/** Delay genuine application bytes without replacing the response or UI logic. */
export async function holdActualResponse(page: Page, path: string) {
  const pattern = '**' + path;
  let release!: () => void, ready!: () => void, finished!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const responseReady = new Promise<void>(resolve => { ready = resolve; });
  const responseFinished = new Promise<void>(resolve => { finished = resolve; });
  let abortObserved = false;
  let heldRequest: Request, originalResponse: APIResponse;
  const onFailed = (request: Request) => {
    if (new URL(request.url()).pathname === path && request.failure()?.errorText === 'net::ERR_ABORTED') abortObserved = true;
  };
  page.on('requestfailed', onFailed);
  const handler = async (route: Route) => {
    heldRequest = route.request();
    const response = await route.fetch();
    originalResponse = response;
    ready();
    await held;
    try { await route.fulfill({ response }); } catch { /* The real UI may abort this request while it is held. */ }
    finished();
  };
  await page.route(pattern, handler);
  return {
    ready: responseReady, release, finished: responseFinished, abortObserved: () => abortObserved,
    request: () => heldRequest,
    responseBody: () => originalResponse.body(),
    async expectAborted() {
      await expect.poll(() => abortObserved, { message: 'The browser must abort the obsolete request: ' + path }).toBe(true);
    },
    async cleanup() {
      release();
      await page.unroute(pattern, handler);
      page.off('requestfailed', onFailed);
    },
  };
}
