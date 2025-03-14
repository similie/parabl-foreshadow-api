import { ExpressRequest, QueryAgent } from "@similie/ellipsies";
import { ApplicationUser, UserTokens } from "../models";
import { RedisStore } from "../config";

export const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

export const requestBodyParser = <T>(req: ExpressRequest): Promise<T> => {
  return new Promise<T>((resolve) => {
    if (req.body && Object.keys(req.body).length) {
      resolve(req.body as T);
    }

    let body = "";
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        return resolve(body as unknown as T);
      }
      console.log("Raw body:", body);
      resolve(JSON.parse(body) as T);
    });
  });
};

export const setUserWithTokenInRedis = (
  token: string,
  user: ApplicationUser,
) => {
  return RedisStore.instance.set("user-store:" + token, user, 3600);
};

export const getUserWithTokenInRedis = async (
  token: string,
): Promise<ApplicationUser | null> => {
  const found = await RedisStore.instance.get("user-store:" + token);
  return (found as unknown as ApplicationUser) || null;
};

export const setUserInCache = async (
  token: string,
  user: string,
): Promise<void> => {
  // await RedisClien
  const userTokenAgent = new QueryAgent<UserTokens>(UserTokens, {});
  const foundToken = await userTokenAgent.findOneBy({ token });
  if (!foundToken) {
    return;
  }

  const userAgent = new QueryAgent<ApplicationUser>(ApplicationUser, {});
  const foundUser = await userAgent.findOneById(user);
  if (!foundUser) {
    return;
  }

  const agentUserUpdate = new QueryAgent<UserTokens>(UserTokens, {
    where: { id: foundToken.id },
  });
  await agentUserUpdate.updateByQuery({
    user: foundUser.id as unknown as ApplicationUser,
  });
  await setUserWithTokenInRedis(token, foundUser);
};
