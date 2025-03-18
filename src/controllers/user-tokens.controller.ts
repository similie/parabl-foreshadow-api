/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EllipsiesController,
  EllipsiesExtends,
  Post,
  Body,
  Req,
  UseBefore,
  BadRequestError,
  UUID,
  ExpressRequest,
  Params,
} from "@similie/ellipsies";
import { ApplicationUser, UserTokens } from "../models";
import { BlockAllTraffic } from "../middleware";
@EllipsiesExtends("user-tokens")
export default class UserTokenController extends EllipsiesController<UserTokens> {
  public constructor() {
    super(UserTokens);
  }

  public static async searchToken(token: string): Promise<UserTokens | null> {
    const found = await UserTokens.findOne({
      where: { token },
      relations: { user: true },
    });
    return found || null;
  }

  public static async getToken(token: string): Promise<UserTokens> {
    const found = await UserTokenController.searchToken(token);
    if (!found) {
      throw new BadRequestError("Invalid token Provided");
    }
    return found;
  }

  @UseBefore(BlockAllTraffic)
  public override async findOne(@Params() id: number) {
    return super.findOne(id);
  }
  @UseBefore(BlockAllTraffic)
  public override async find(@Req() req: ExpressRequest) {
    return super.find(req);
  }

  // private async destroyExistingOnUser(userUid: UUID) {
  //   try {
  //     return await UserTokens.delete({
  //       user: { id: userUid } as unknown as ApplicationUser,
  //     });
  //   } catch (e: any) {
  //     console.error("Error destroying user token", e.message);
  //   }
  //   return null;
  // }

  private async generateNewToken(token: string, user: UUID) {
    const store: { token: string; user?: UUID } = {
      token,
    };
    if (user) {
      store.user = user;
      // await this.destroyExistingOnUser(user);
    }
    const createdToken = (await UserTokens.save(
      UserTokens.create(store as any),
    )) as UserTokens;
    const sendToken = await UserTokens.findOne({
      where: { id: createdToken.id },
      relations: { user: true },
    });
    return sendToken;
  }

  private async applyUserToToken(token: UserTokens, bodyUser: UUID) {
    const user = await ApplicationUser.findOne({
      where: { id: bodyUser },
    });
    if (!user) {
      return token;
    }
    await UserTokens.update({ id: token.id }, { user: user });
    const sendToken = await UserTokenController.searchToken(token.token);
    return sendToken;
  }
  /**
   * @description Override defaults to validate query and get objects
   * @param {Partial<UserTokens>} body
   * @returns {Promise<UserTokens>}
   */
  @Post("/search")
  public async search(
    @Body() body: Partial<UserTokens>,
  ): Promise<UserTokens | UserTokens[] | null> {
    if (!body.token) {
      throw new BadRequestError("Invalid token Provided");
    }

    try {
      let token = await UserTokenController.searchToken(body.token);
      if (!token) {
        token = await this.generateNewToken(
          body.token,
          body.user as unknown as UUID,
        );
      } else if (token && body.user) {
        token = await this.applyUserToToken(
          token,
          body.user as unknown as UUID,
        );
      }
      return token;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}
