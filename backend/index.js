import { mkdir } from 'node:fs/promises';

import app from './src/app.js';
import config from './src/config/env.js';
import { connectDatabase, disconnectDatabase } from './src/config/db.js';
import { connectRedis } from './src/config/redis.js';
import { closeSocket, initSocket } from './src/config/socket.js';
import { createLogger, flushLogger } from './src/config/logger.js';

const log = createLogger('server');

// Entry point: connect Postgres and Redis first, then start the HTTP server.
// If either connection fails, log clearly and exit — never start the server
// without them, and never fail silently. Both are connected explicitly here
// (Prisma and ioredis both connect lazily by default) so a bad DATABASE_URL
// or REDIS_URL fails at boot rather than as a 500 on the first request that
// happens to need it.
const startServer = async () => {
  try {
    // The upload directory, before anything can try to write into it. Created
    // here rather than checked per request: an upload that fails because a
    // directory is missing is a 500 for a configuration problem, and the check
    // belongs where the rest of the boot-time configuration is proved.
    await mkdir(config.upload.dir, { recursive: true });

    await connectDatabase();
    await connectRedis();

    const server = app.listen(config.port, () => {
      log.info(`Listening on port ${config.port} (${config.nodeEnv})`);
    });

    // Socket.IO shares the HTTP server, and therefore the port: one origin for
    // the browser, one CORS rule, and no second listener to expose or forget
    // to shut down. Attached AFTER listen so the handshake path is live the
    // moment the port is.
    initSocket(server);

    const shutdown = async (signal) => {
      log.info(`${signal} received, shutting down...`);
      /* Sockets first: `server.close` stops accepting new connections but
         waits for open ones, and a live WebSocket never closes on its own —
         so without this the process hangs until the orchestrator kills it. */
      await closeSocket();
      server.close(async () => {
        await disconnectDatabase();
        await flushLogger();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    log.fatal({ err: error }, 'Failed to start server');
    // Flush first: process.exit() does not wait for the pretty-print
    // transport's worker thread, and this is the one line that explains the
    // exit.
    await flushLogger();
    process.exit(1);
  }
};

// Last-resort handlers. A rejection or throw that escapes every other path
// would otherwise print Node's own trace to stderr and bypass the logger
// entirely — unstructured, and invisible to a collector reading NDJSON. The
// process still dies on an uncaught exception: its state is unknown after
// one, so logging and exiting beats limping on.
process.on('unhandledRejection', (reason) => {
  log.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', async (error) => {
  log.fatal({ err: error }, 'Uncaught exception, exiting');
  await flushLogger();
  process.exit(1);
});

startServer();
