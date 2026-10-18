import { createApp, createRouter, toNodeListener, type EventHandler } from 'h3';
import { createServer } from 'node:http';

export async function serveHandler(path: string, handler: EventHandler, middleware?: EventHandler) {
  const app = createApp({ debug: false });
  if (middleware) app.use(middleware);
  app.use(createRouter().use(path, handler));
  const server = createServer(toNodeListener(app));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.closeAllConnections();
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}
