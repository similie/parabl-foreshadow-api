import { ExpressRequest, UUID } from "@similie/ellipsies";
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
  socketId?: string,
): Promise<void> => {
  // await RedisClien
  const foundToken = await UserTokens.findOneBy({ token });
  if (!foundToken) {
    return;
  }
  const foundUser = await ApplicationUser.findOneBy({ id: user as UUID });
  if (!foundUser) {
    return;
  }

  const update: { user: ApplicationUser; socket?: string } = {
    user: foundUser,
  };

  if (socketId) {
    update.socket = socketId;
  }

  await UserTokens.update({ id: foundToken.id }, update);
  await setUserWithTokenInRedis(token, foundUser);
};
