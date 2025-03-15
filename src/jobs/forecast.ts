import { Worker, Queue } from "bullmq";
import { getRedisConfig } from "../config";
import {
  ApplicationUser,
  LocationRisk,
  TokenLocation,
  UserTokens,
} from "../models";
import { QueryAgent, UUID } from "@similie/ellipsies";
import { PointApi } from "../weather";
import { SocketServer } from "../sockets";
import { ForecastWarning } from "../types";
import { sendPushNotification } from "../utils";
export const FORECAST_QUEUE_NAME = "forecastProcess";
export const FORECAST_QUEUE_JOB = "forecastProcessJob";
export const CACHING_PREWARMING_JOB = "pushNotificationsJob";
export const foreCastQueue = new Queue(FORECAST_QUEUE_NAME, {
  connection: { url: getRedisConfig().url },
});

const createRiskJoins = async (risks: ForecastWarning[], ut: UserTokens) => {
  if (!ut || !ut.user) {
    return;
  }
  const user = ut.user.id;
  if (!user) {
    return;
  }
  const agent = new QueryAgent<LocationRisk>(LocationRisk, {});
  const joins = [];
  for (const risk of risks) {
    const riskValues = {
      location: risk.location.id,
      risk: risk.risk.id,
      isActive: true,
    };
    const agentD = new QueryAgent<LocationRisk>(LocationRisk, {
      where: riskValues,
    });
    agentD.updateByQuery({ isActive: false });
    joins.push({
      ...riskValues,
      onDate: new Date(risk.datetime),
    });
  }

  return await agent.create(joins);
};

const getUserToken = async (
  userUid: string,
  userMap: Map<string, UserTokens>,
) => {
  const userToken = userMap.get(userUid);
  if (userToken) {
    return userToken;
  }

  const agent = new QueryAgent<UserTokens>(UserTokens, {
    sort: { createdAt: "DESC" },
    populate: ["user"],
    limit: 1,
    where: { user: userUid as unknown as ApplicationUser },
  });
  const users = await agent.getObjects();
  if (!users || !Array.isArray(users) || !users.length) {
    return null;
  }
  const user = users[0];
  if (!user) {
    return null;
  }
  userMap.set(userUid, user);
  return user;
};

const broadcastEventsToUser = async (
  risks: ForecastWarning[],
  userId: UUID,
) => {
  try {
    await SocketServer.instance.publish("risks/" + userId, risks);
  } catch {
    console.error("Failed to broadcast to user", userId);
  }
};

const applyToCompletionMap = async (
  risks: ForecastWarning[],
  ut: UserTokens,
  map: Map<UUID, ForecastWarning[]>,
) => {
  if (!ut || !ut.user) {
    return;
  }
  const userId = ut.user.id;
  if (!userId) {
    return;
  }
  const values = map.get(userId) || [];
  values.push(...risks);
  map.set(userId, values);
};

const sendPushEvent = async (risks: ForecastWarning[], ut: UserTokens) => {
  if (!risks.length) {
    return;
  }
  const token = ut.token;
  ///ExponentPushToken[y-mt_cBKoJp_6o0LqRMZKe]
  if (!token || !token.includes("PushToken")) {
    return;
  }
  const subject = `Parabl risk notifications`;
  const body = `Parabl found ${risks.length} ${
    risks.length > 1 ? "risks" : "risk"
  } for your saved locations`;
  await sendPushNotification(token, subject, body);
};

const finalizeUserEvents = async (
  map: Map<UUID, ForecastWarning[]>,
  um: Map<UUID, UserTokens>,
) => {
  for (const [uid, risks] of map.entries()) {
    await broadcastEventsToUser(risks, uid);
    const ut = um.get(uid);
    if (!ut) {
      continue;
    }
    await sendPushEvent(risks, ut);
    // await
  }
};

// export for running tests
export const runJob = async () => {
  console.log("Running Job", new Date());
  const agent = new QueryAgent<TokenLocation>(TokenLocation, {
    sort: { user: "ASC" },
  });
  const locations = (await agent.getObjects()) as TokenLocation[];
  const pointApi = new PointApi();
  const userMap = new Map<UUID, UserTokens>();
  const completionMap = new Map<UUID, ForecastWarning[]>();
  for (const location of locations) {
    const coords = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const forecast = await pointApi.rawPointForecast(coords, 4, 3);
    const risks = await pointApi.raiseExtremeAlerts(forecast, location);
    if (!risks.length) {
      continue;
    }
    const userToken = await getUserToken(location.user, userMap);
    if (!userToken) {
      continue;
    }
    await createRiskJoins(risks, userToken);
    applyToCompletionMap(risks, userToken, completionMap);
  }
  finalizeUserEvents(completionMap, userMap);
  console.log("Locations", locations);
};

export const foreCastWorker = new Worker(
  FORECAST_QUEUE_NAME,
  async () => {
    await runJob();
  },
  {
    connection: {
      url: getRedisConfig().url,
    },
  },
);
export const prewarmCachingQueue = new Queue(CACHING_PREWARMING_JOB, {
  connection: { url: getRedisConfig().url },
});
export const prewarmCaching = new Worker(
  CACHING_PREWARMING_JOB,
  async () => {
    console.log("I AM STARTING MY PREWARMING JOB");
    const api = new PointApi();
    try {
      await api.prewarmForecast();
    } catch {
      //
    }
    try {
      await api.prewarmPointForecast();
    } catch {
      //
    }
  },
  {
    connection: {
      url: getRedisConfig().url,
    },
  },
);

foreCastWorker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

foreCastWorker.on("failed", (job, err) => {
  console.error(`Job ${job!.id} failed with error: ${err.message}`);
});
