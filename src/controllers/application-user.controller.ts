/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  EllipsiesController,
  EllipsiesExtends,
  Req,
  UseBefore,
  QueryAgent,
  Post,
  Get,
  BadRequestError,
  QueryParam,
  ExpressRequest,
  // ExpressRequest,
  // Param,
} from "@similie/ellipsies";

import { ApplicationUser, OTP, UserAgreement, UserTokens } from "../models";
import { BlockAllTraffic, OTPAuthToken } from "../middleware";
import { createOTP } from "../utils";
import UserTokenController from "./user-tokens.controller";

@EllipsiesExtends("appusers")
export default class ApplicationUserController extends EllipsiesController<ApplicationUser> {
  public constructor() {
    super(ApplicationUser);
  }

  @UseBefore(OTPAuthToken)
  @Post("/registered")
  public async isRegistered(
    @Body() body: Partial<ApplicationUser>,
  ): Promise<{ registered: boolean }> {
    const agentUser = new QueryAgent<ApplicationUser>(ApplicationUser, {
      where: body,
    });
    const values = (await agentUser.getObjects()) as ApplicationUser[];
    return { registered: !!values.length };
  }

  @Get("/license")
  public async getLicense() {
    const agentUser = new QueryAgent<UserAgreement>(UserAgreement, {});
    return agentUser.findOneBy({ active: true });
  }

  @Post("/login")
  public async Login(
    //@Req() req
    @Body() body: { token: string; userName?: string; checkPhone?: boolean },
  ) {
    if (!(await UserTokenController.getToken(body.token))) {
      return;
    }

    if (!body.userName) {
      throw new BadRequestError("Username is required");
    }
    const agentUser = new QueryAgent<ApplicationUser>(ApplicationUser, {});
    const user = await agentUser.findOneBy({ userName: body.userName });

    if (!user) {
      throw new BadRequestError("Invalid Username");
    }
    const otp: Partial<OTP> = {
      identifier: body.checkPhone && user.phone ? user.phone : user.email,
      token: body.token,
      active: true,
    };

    if (!otp.identifier) {
      throw new BadRequestError("User cannot be authenticated");
    }
    console.log("my otp", otp);
    return createOTP(otp);
  }

  @Post("/assign")
  public async assignUserToToken(@Body() body: Partial<UserTokens>) {
    //UserTokens
    if (!body.token || !body.user) {
      throw new BadRequestError("Invalid identity Provided");
    }
    const agentUser = new QueryAgent<UserTokens>(UserTokens, {});
    const found = await agentUser.findOneBy({ token: body.token });
    if (!found) {
      throw new BadRequestError("Invalid token Provided");
    }
    const agentUpdate = new QueryAgent<UserTokens>(UserTokens, {
      where: { id: found.id },
    });
    return agentUpdate.updateById({ user: body.user });
  }

  @UseBefore(OTPAuthToken)
  public override async updateOne(
    @Body() body: any,
    @QueryParam("id") id: any,
  ): Promise<ApplicationUser | null> {
    try {
      const saved = await super.updateOne(id, body);
      return saved;
    } catch (e) {
      console.error(e);
      throw new BadRequestError("Invalid Request");
    }
  }

  @UseBefore(BlockAllTraffic)
  public override async findOne(@QueryParam("id") id: number) {
    return super.findOne(id);
  }

  @UseBefore(BlockAllTraffic)
  public override async find(@Req() req: ExpressRequest) {
    return super.find(req);
  }

  @UseBefore(BlockAllTraffic)
  public override update(@Body() body: any) {
    return super.update(body);
  }

  @UseBefore(OTPAuthToken)
  public override create(
    @Body() body: Partial<ApplicationUser>,
  ): Promise<ApplicationUser> {
    return super.create(body) as Promise<ApplicationUser>;
  }
}
