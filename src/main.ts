/* eslint-disable object-curly-spacing */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Ellipsies,
  COMMON_API_SERVICE_ROUTES,
  DEFAULT_SERVICE_PORT,
} from "@similie/ellipsies";
import * as models from "./models";
import * as controllers from "./controllers";
import { EllipsiesSocket } from "./sockets";
import { getRedisConfig } from "./config";
import { seedContent } from "./seeds";
import {
  FORECAST_QUEUE_JOB,
  foreCastQueue,
  // testPushNotificationsQueue,
  // PUSH_NOTIFICATION_TEST,
} from "./jobs";
import { PointApi } from "./weather";
import { UserRequired } from "./middleware";
import { tileMappingRoute } from "./utils/routes";

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
  };
};

const setRoutes = (ellipsies: Ellipsies) => {
  ellipsies.server.app.get(
    tileMappingRoute(COMMON_API_SERVICE_ROUTES),
    [UserRequired],
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
  // const repeatableJobs = await testPushNotificationsQueue.getJobSchedulers();
  // for (const job of repeatableJobs) {
  //   await testPushNotificationsQueue.removeJobScheduler(job.key);
  // }
  // await testPushNotificationsQueue.add(
  //   PUSH_NOTIFICATION_TEST,
  //   {},
  //   { repeat: { pattern: '0 */1 * * * *' } }
  // );
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
};

run();
