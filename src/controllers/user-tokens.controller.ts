/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EllipsiesController,
  EllipsiesExtends,
  QueryAgent,
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

  public static async getToken(token: string): Promise<UserTokens> {
    const agentToken = new QueryAgent<UserTokens>(UserTokens, {});
    const found = await agentToken.findOneBy({ token });
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

  private async destroyExistingOnUser(userUid: UUID) {
    try {
      return await UserTokens.delete({
        user: { id: userUid } as unknown as ApplicationUser,
      });
    } catch (e: any) {
      console.error("Error destroying user token", e.message);
    }
    return null;
  }

  // private destroyExistingOnTokens(token: string) {
  //   const agentUserDest = new QueryAgent<UserTokens>(UserTokens, {
  //     where: { token: token },
  //   });
  //   return agentUserDest.destroyAll();
  // }

  /**
   * @description Override defaults to validate query and get objects
   * @param {Partial<UserTokens>} body
   * @returns {Promise<UserTokens>}
   */
  @Post("/search")
  public async search(
    @Body() body: Partial<UserTokens>,
  ): Promise<UserTokens | UserTokens[] | null> {
    try {
      // const appUserAgent = new QueryAgent<ApplicationUser>(ApplicationUser, {});
      const agentUser = new QueryAgent<UserTokens>(UserTokens, {
        populate: ["user"],
      });
      // console.log("STARTING HERE", body);
      let token = await agentUser.findOneBy({ token: body.token });
      if (!token) {
        const store: { token: string; user?: UUID } = {
          token: body.token || "",
        };
        if (body.user) {
          store.user = body.user as unknown as UUID;
          await this.destroyExistingOnUser(body.user as unknown as UUID);
        }
        token = (await agentUser.create(store as any)) as UserTokens;
      } else if (token && body.user) {
        // await this.destroyExistingTokens(body.user as unknown as UUID);
        const user = await ApplicationUser.findOneBy({
          id: body.user as unknown as UUID,
        });
        if (!user) {
          return token;
        }
        await UserTokens.update({ id: token.id }, { user: user });
        token = await agentUser.findOneBy({ token: body.token });
      }
      return token;
    } catch (e) {
      console.error(e);
      return [];
    }
  }
}
