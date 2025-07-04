/* eslint-disable object-curly-spacing */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";
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
    synchronize: process.env.NODE_ENV !== "production",
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
  const repeatableWarmingJobs = await prewarmCachingQueue.getJobSchedulers();
  for (const job of repeatableWarmingJobs) {
    await prewarmCachingQueue.removeJobScheduler(job.key);
  }
};

const runSystemJobs = async () => {
  // await prewarmCachingQueue.add(
  //   CACHING_PREWARMING_JOB,
  //   {}, //  "0 */30 * * * *"
  //   { repeat: { pattern: "0 */15 * * * *" }, jobId: "prewarm-caching" },
  // );
  await foreCastQueue.add(
    FORECAST_QUEUE_JOB,
    {}, // PointApi.POINT_CHECK_TIMER { pattern: "0 */1 * * * *" }
    { repeat: PointApi.POINT_CHECK_TIMER, jobId: "forecast-queue" },
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

  await runSystemJobs();

  SocketServer.instance.subscribe(
    "token",
    async function ({ token, user }: { token: string; user: string }) {
      await setUserInCache(token, user, this.id);
    },
  );
};

run();
