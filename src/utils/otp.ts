import { SystemEmail } from "../email";
import { OTP } from "../models";
import bcrypt from "bcrypt";
import {
  TimePeriod,
  DateHelper,
  timeConstants,
} from "@similie/shared-microservice-utils";
import { BadRequestError } from "routing-controllers";
import { ExpressRequest, QueryAgent } from "@similie/ellipsies";
const SALT_ROUNDS = 10;
export const OPT_EXPIRE_IN_MINUTES = process.env.OPT_EXPIRE_IN_MINUTES
  ? +process.env.OPT_EXPIRE_IN_MINUTES
  : 5;

export const findTokenInRequest = (req: ExpressRequest) => {
  const token = req.headers.authorization || req.headers.token;
  if (token) {
    return token;
  }
  const params = req.params || {};
  if (params.authorization) {
    return params.authorization;
  }
  const query = req.query || {};
  if (query.authorization) {
    return query.authorization;
  }
  const body = req.body || {};
  if (body.authorization) {
    return body.authorization;
  }
  return null;
};

export const isPhone = (value: string) => {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/; // E.164 format
  return phoneRegex.test(value);
};

export const isEmail = (value: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
};

export const isValueIdentity = (value: string) => {
  return isPhone(value) || isEmail(value);
};

export const createdAtSearch = (time = OPT_EXPIRE_IN_MINUTES) => {
  const createdAtSearch = {
    ">=": new DateHelper(timeConstants.now_).minus(time, TimePeriod.minutes)
      .toISO,
  } as unknown as Date;

  return createdAtSearch;
};

const templateObject = (passcode: string) => {
  return { passcode, expire: OPT_EXPIRE_IN_MINUTES };
};

const sendEmail = (email: string, otp: string) => {
  return SystemEmail.send(email, {
    templateName: "otp",
    data: templateObject(otp),
  });
};

export const toHash = (value: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(value, SALT_ROUNDS, (err, hash) => {
      if (err) {
        return reject(err);
      }
      resolve(hash);
    });
  });
};

export const compareHash = (hash: string, value: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(value, hash, function (err, result) {
      if (err) {
        return reject(err);
      }
      resolve(result);
    });
  });
};

export const issueOTP = async (otp: OTP) => {
  const otpValue = otp.otp;
  const sendObject = {
    ...otp,
  };
  // we never want to send the value of the otp to the client
  if (process.env.NODE_ENV !== "test") {
    delete sendObject.otp;
    delete sendObject.identifier;
  }

  if (!otp.identifier) {
    throw new Error("No identifier Found");
  }

  if (!otpValue) {
    throw new Error("No OTP found");
  }

  if (isEmail(otp.identifier)) {
    // don't wait to send the email
    sendEmail(otp.identifier, otpValue);
  }
  otp.otp = await toHash(otpValue);
  await otp.save();
  return sendObject as OTP;
};

export const invalidateAllOtp = async (identifier: string) => {
  const queryAgent = new QueryAgent<OTP>(OTP, {
    where: { identifier, active: true },
  });
  return queryAgent.updateByQuery({ active: false });
};

export const validateOTP = async (values: Partial<OTP>) => {
  if (!values.identifier || !isValueIdentity(values.identifier)) {
    throw new BadRequestError("Invalid identity Provided");
  }
  await invalidateAllOtp(values.identifier);
};

export const createOTP = async (values: Partial<OTP>) => {
  await validateOTP(values);
  const queryAgent = new QueryAgent<OTP>(OTP, {});
  const created = await queryAgent.create(values);
  const createdOtp = Array.isArray(created) ? created[0] : created;
  if (!createdOtp) {
    throw new Error("Failed to create the OTP");
  }
  return issueOTP(createdOtp);
};
