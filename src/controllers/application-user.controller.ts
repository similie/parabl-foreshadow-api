/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Body,
  EllipsiesController,
  EllipsiesExtends,
  Req,
  UseBefore,
  Post,
  Get,
  BadRequestError,
  QueryParam,
  ExpressRequest,
  FindOptionsWhere,
  UUID,
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
    const values = await ApplicationUser.find({
      where: body as FindOptionsWhere<ApplicationUser>,
    });
    return { registered: !!values.length };
  }

  @Get("/license")
  public async getLicense() {
    return UserAgreement.findOne({ where: { active: true } });
  }

  @Post("/logout")
  public async Logout(@Body() body: { token: string; user: UUID }) {
    if (!body.user) {
      return { error: "Invalid User Provided" };
    }

    try {
      const found = await UserTokenController.searchToken(body.token);
      if (!found) {
        return { error: "Invalid Token Provided" };
      }
      if (found.user?.id !== body.user) {
        return { error: "Invalid User Provided" };
      }

      await UserTokens.update({ token: body.token }, { user: null });
      return { result: "ok" };
    } catch (e: any) {
      console.error(e);
      return { error: e.messsage };
    }
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
    const user = await ApplicationUser.findOneBy({ userName: body.userName });
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
    return createOTP(otp);
  }

  @Post("/assign")
  public async assignUserToToken(@Body() body: Partial<UserTokens>) {
    //UserTokens
    if (!body.token || !body.user) {
      throw new BadRequestError("Invalid identity Provided");
    }
    const found = await UserTokens.findOneBy({ token: body.token });
    if (!found) {
      throw new BadRequestError("Invalid token Provided");
    }
    return UserTokens.update({ id: found.id }, { user: body.user });
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
