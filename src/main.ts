/* eslint-disable object-curly-spacing */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Ellipsies,
  COMMON_API_SERVICE_ROUTES,
  DEFAULT_SERVICE_PORT,
} from "@similie/ellipsies";
import * as models from "./models";
import * as controllers from "./controllers";
import { EllipsiesSocket, SocketServer } from "./sockets";
import { getRedisConfig } from "./config";
import { seedContent } from "./seeds";
import {
  FORECAST_QUEUE_JOB,
  foreCastQueue,
  prewarmCachingQueue,
  CACHING_PREWARMING_JOB,
} from "./jobs";
import { PointApi } from "./weather";
import { UserRequired } from "./middleware";
import { tileMappingRoute } from "./utils/routes";
import { setUserInCache } from "./utils";

const eConfig = () => {
  return {
    models,
    controllers,
    port: DEFAULT_SERVICE_PORT,
    prefix: COMMON_API_SERVICE_ROUTES, // Pre
  };
};

const ds = () => {
  return {
    database: process.env.DB_DATABASE || "foreshadow",
    username: process.env.DB_USER || "wrdims",
    password: process.env.DB_PASSWORD || "wrdims",
    host: process.env.DB_HOST || "localhost",
    port: 5432,
    synchronize: false,
  };
};

const setRoutes = (ellipsies: Ellipsies) => {
  ellipsies.server.app.get(
    tileMappingRoute(COMMON_API_SERVICE_ROUTES),
    [UserRequired], // need to fix this
    PointApi.proxTileServer,
  );
};

const pruneJobs = async () => {
  const repeatableJobs = await foreCastQueue.getJobSchedulers();
  for (const job of repeatableJobs) {
    await foreCastQueue.removeJobScheduler(job.key);
  }
};

const runNotificationTest = async () => {
  const repeatableJobs = await prewarmCachingQueue.getJobSchedulers();
  for (const job of repeatableJobs) {
    await prewarmCachingQueue.removeJobScheduler(job.key);
  }
  await prewarmCachingQueue.add(
    CACHING_PREWARMING_JOB,
    {},
    { repeat: { pattern: "0 */20 * * * *" } },
  );
};

const run = async () => {
  const ellipsies = new Ellipsies(eConfig());
  await ellipsies.setDataSource(ds());
  await ellipsies.start();
  setRoutes(ellipsies);
  await seedContent(["risks"], ellipsies.pgManager.datasource);
  await EllipsiesSocket(ellipsies, getRedisConfig());
  await pruneJobs();
  await foreCastQueue.add(
    FORECAST_QUEUE_JOB,
    {},
    { repeat: PointApi.POINT_CHECK_TIMER },
  );
  await runNotificationTest();

  SocketServer.instance.subscribe(
    "token",
    async ({ token, user }: { token: string; user: string }) => {
      await setUserInCache(token, user);
    },
  );
};

run();
