import { logsFileRouteHandler } from '../lib/logEx.js';
import { sendStdResponse } from '../lib/utils.js';

export const routes = {
  GET: {
    '/': (_, res) =>
      sendStdResponse(res, {
        message: 'Hello from LogEx - Explore logs with ease!!',
      }),
    '/v1/health': (_, res) =>
      sendStdResponse(res, {
        message: `Server up and running!!!`,
        at: new Date().toISOString(),
      }),
    '/v1/logs': logsFileRouteHandler,
  },
  notFound: (_, res) =>
    sendStdResponse(
      res,
      {
        message: `Route Not found!`,
      },
      404,
    ),
};
