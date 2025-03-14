import {
  ExpressRequest,
  ExpressResponse,
  ExpressNext,
  UnauthorizedError,
  BadRequestError,
  QueryAgent,
} from "@similie/ellipsies";
import { UserTokens, VerificationToken } from "../models";
import {
  findTokenInRequest,
  getUserWithTokenInRedis,
  setUserWithTokenInRedis,
} from "../utils";

const FindTokenUser = async (req: ExpressRequest) => {
  const token = findTokenInRequest(req);
  if (!token) {
    return null;
  }

  const cachedUser = await getUserWithTokenInRedis(token);
  if (cachedUser) {
    return cachedUser;
  }

  const agentUser = new QueryAgent<UserTokens>(UserTokens, {
    populate: ["user"],
  });
  const tk = await agentUser.findOneBy({ token: token });
  if (!tk) {
    return null;
  }
  const user = tk?.user;
  if (user) {
    await setUserWithTokenInRedis(token, user);
  }
  return tk?.user || null;
};

export const TokenUserInRequest = async (
  req: ExpressRequest,
  _res: ExpressResponse,
  next: ExpressNext,
) => {
  const user = await FindTokenUser(req);
  if (!user) {
    return next();
  }
  req.user = user || null;

  next();
};

export const UserRequired = async (
  req: ExpressRequest,
  _res: ExpressResponse,
  next: ExpressNext,
) => {
  if (!req.user) {
    req.user = await FindTokenUser(req);
  }
  if (!req.user) {
    return next(new UnauthorizedError("User Required"));
  }
  next();
};

export const OTPAuthToken = async (
  req: ExpressRequest,
  _res: ExpressResponse,
  next: ExpressNext,
) => {
  const token = req.headers["authorization"];
  if (!token) {
    return next("Authorization Required");
  }

  try {
    const isValid = await VerificationToken.validToken(token);
    if (!isValid) {
      return next(new UnauthorizedError("Unauthorized access"));
    }
    return next();
  } catch (e: any) {
    console.error("Token Validation Error:", e.message);
    // return next(e);
    next(new UnauthorizedError("Unauthorized access"));
  }
};

export const BodyToken = async (
  req: ExpressRequest,
  _res: ExpressResponse,
  next: ExpressNext,
) => {
  const body = req.body || {}; // await requestBodyParser<{ token: string }>(req);
  if (!body || !body.token) {
    return next(new BadRequestError("Invalid token Provided"));
  }
  //   req.body = body;
  const agentToken = new QueryAgent<UserTokens>(UserTokens, {});
  const found = await agentToken.findOneBy({ token: body.token });
  if (!found) {
    return next(new BadRequestError("Invalid token Provided"));
  }
  next();
};
