import http from 'node:http';
import url from 'node:url';

import { HTTP_PORT, HTTP_HOST } from '../lib/conf.js';
import { routes } from './routes.js';

export async function startHttpServer() {
  const server = http.createServer((req, res) => {
    const { pathname: path } = url.parse(req.url, true);
    const method = req.method;
    const routeHandler = routes?.[method]?.[path] ?? routes.notFound;
    routeHandler(req, res);
  });

  await server.listen(HTTP_PORT, HTTP_HOST);
  console.info('[INFO]', `Server running on http://localhost:${HTTP_PORT}`);
}
