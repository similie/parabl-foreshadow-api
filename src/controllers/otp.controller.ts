/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EllipsiesController,
  EllipsiesExtends,
  Body,
  QueryAgent,
  BadRequestError,
  Req,
  Post,
  FindOptionsWhere,
  UseBefore,
  Param,
  ExpressRequest,
  IDValue,
} from "@similie/ellipsies";
import { ApplicationUser, OTP, VerificationToken } from "../models";
import {
  issueOTP,
  isValueIdentity,
  compareHash,
  createdAtSearch,
  invalidateAllOtp,
  isEmail,
} from "../utils";
import { BlockAllTraffic, TestOnlyTraffic } from "../middleware";

@EllipsiesExtends("otp")
export default class OTPController extends EllipsiesController<OTP> {
  public constructor() {
    super(OTP);
  }

  private async otpUser(identifier: string): Promise<ApplicationUser | null> {
    const queryAgent = new QueryAgent<ApplicationUser>(ApplicationUser, {});
    const search: FindOptionsWhere<ApplicationUser> = {};
    if (isEmail(identifier)) {
      search.email = identifier;
    } else {
      search.phone = identifier;
    }

    const user = await queryAgent.findOneBy(search);
    return user || null;
  }

  private async findOtpByUsernameIdentifier(
    identifier: string,
  ): Promise<QueryAgent<OTP>> {
    if (isValueIdentity(identifier)) {
      return new QueryAgent<OTP>(OTP, {
        where: {
          identifier,
          active: true,
          createdAt: createdAtSearch(),
        },
      });
    }

    const queryAgent = new QueryAgent<ApplicationUser>(ApplicationUser, {});
    const user = await queryAgent.findOneBy({ userName: identifier });
    if (!user) {
      throw new Error("User is not found");
    }

    const search: string[] = [];
    if (user.email) {
      search.push(user.email);
    }

    if (user.phone) {
      search.push(user.phone);
    }
    if (!search.length) {
      throw new Error("User has not valid contact details");
    }

    return new QueryAgent<OTP>(OTP, {
      where: {
        identifier: search as unknown as string,
        active: true,
        createdAt: createdAtSearch(),
      },
    });
  }

  private invalidateAllOtp(identifier: string) {
    return invalidateAllOtp(identifier);
  }

  @Post("/verify")
  public async verify(
    @Body() body: Partial<OTP>,
  ): Promise<{ otp: boolean; user: ApplicationUser | null; token?: string }> {
    if (!body.identifier) {
      throw new BadRequestError("Invalid identity Provided");
    }

    if (!body.otp) {
      throw new BadRequestError("Invalid OTP Provided");
    }
    let identifier = body.identifier;
    try {
      const queryAgent = await this.findOtpByUsernameIdentifier(
        body.identifier,
      );
      const verifications = (await queryAgent.getObjects()) as OTP[];
      let valid = false;
      for (const verify of verifications) {
        if (!verify || !verify.otp) {
          continue;
        }
        const match = await compareHash(verify.otp, body.otp);
        if (!match || !verify.identifier) {
          continue;
        }
        valid = true;
        identifier = verify.identifier;
        break;
      }

      const send: {
        otp: boolean;
        user: ApplicationUser | null;
        token: string | undefined;
      } = { otp: valid, user: null, token: undefined };
      if (valid) {
        await this.invalidateAllOtp(identifier);
        // if the account exists and is valid, then we send it down
        send.user = await this.otpUser(identifier);
        send.token = await VerificationToken.createToken();
      }

      return send;
    } catch (error: any) {
      throw new BadRequestError(error.message);
    }
  }

  public override async create(@Body() body: Partial<OTP>) {
    if (!body.identifier || !isValueIdentity(body.identifier)) {
      throw new BadRequestError("Invalid identity Provided");
    }
    await this.invalidateAllOtp(body.identifier);
    // console.log('BODY IS SO HOT IT HURTS', body);
    const created = (await super.create(body)) as OTP;
    return issueOTP(created);
  }

  /**
   * Below we are going to block the other routes
   */

  @UseBefore(BlockAllTraffic)
  public override avg(@Param("attr") attr: string, @Req() req: ExpressRequest) {
    return super.avg(attr, req);
  }

  @UseBefore(BlockAllTraffic)
  public override async sum(
    @Param("attr") attr: string,
    @Req() req: ExpressRequest,
  ) {
    return super.sum(attr, req);
  }
  @UseBefore(BlockAllTraffic)
  public override async destroyOne(@Param("id") id: number) {
    return super.destroyOne(id);
  }
  @UseBefore(BlockAllTraffic)
  public override async destroy(@Body() body: any) {
    return super.destroy(body);
  }
  @UseBefore(BlockAllTraffic)
  public override async updateOne(@Param("id") id: IDValue, @Body() body: any) {
    return super.updateOne(id as number, body);
  }
  @UseBefore(BlockAllTraffic)
  public override async update(@Body() body: any) {
    return super.update(body);
  }
  @UseBefore(TestOnlyTraffic)
  public override async findOne(@Param("id") id: number) {
    return super.findOne(id);
  }
  @UseBefore(TestOnlyTraffic)
  public override async find(@Req() req: ExpressRequest) {
    return super.find(req);
  }
}
