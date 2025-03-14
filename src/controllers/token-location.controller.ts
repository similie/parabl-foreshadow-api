import {
  Body,
  EllipsiesController,
  EllipsiesExtends,
  ExpressRequest,
  InternalServerError,
  Param,
  // populateType,
  Post,
  QueryAgent,
  Req,
  UseBefore,
} from "@similie/ellipsies";
import {
  LocationRisk,
  RiskIndicator,
  TokenLocation,
  UserTokens,
} from "../models";
// import { TokenCoordinates } from '../types';
import { PointApi } from "../weather";
import { BlockAllTraffic, UserRequired } from "../middleware";
import { LocationCoordinates } from "../types";

@EllipsiesExtends("tokens")
export default class TokenController extends EllipsiesController<TokenLocation> {
  public constructor() {
    super(TokenLocation);
  }

  private async findAlerts(locations: TokenLocation[]) {
    const locationRisks: (Partial<TokenLocation> & {
      alerts: (Partial<RiskIndicator> & { onDate?: Date })[];
    })[] = [];
    const pointApi = new PointApi();
    const risks = await pointApi.getAllRiskValues();
    for (const location of locations) {
      const agent = new QueryAgent<LocationRisk>(LocationRisk, {
        where: {
          location: location.id,
          isActive: true,
          createdAt: {
            ">": new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 3),
          } as unknown as Date,
        },
      });
      const value = (await agent.getObjects()) as LocationRisk[];
      const riskMap: Record<string, boolean> = {};
      const locationRiskIds: (Partial<RiskIndicator> & { onDate?: Date })[] =
        [];
      for (const risk of value) {
        if (riskMap[risk.risk]) {
          continue;
        }
        riskMap[risk.risk] = true;
        const value = risks.find((r: RiskIndicator) => r.id === risk.risk);
        if (!value) {
          continue;
        }

        locationRiskIds.push({
          ...value,
          onDate: risk.onDate,
        });
      }
      locationRisks.push({ ...location, alerts: locationRiskIds });
    }
    return locationRisks;
  }

  public override async find(
    @Req() req: ExpressRequest,
  ): Promise<TokenLocation[]> {
    const token: string | undefined = req.query.token as string | undefined;
    console.log("I AM THIS TOKEN AND I DESERVER MORE", token);
    if (!token) {
      return [];
    }
    try {
      const agentToken = new QueryAgent<UserTokens>(UserTokens, {});
      const found = await agentToken.findOneBy({ token });
      console.log("WHAT AND I FOUND", found);
      if (!found || !found.user) {
        return [];
      }

      const user = typeof found.user === "string" ? found.user : found.user.id;
      console.log("I AM THE USER", user);
      const queryAgent = new QueryAgent<TokenLocation>(TokenLocation, {
        populate: ["*"],
        sort: { createdAt: "desc" },
        where: { user },
      });
      const values = (await queryAgent.getObjects()) as TokenLocation[];
      console.log("FOUND THESE VALUES", values);
      return this.findAlerts(values) as unknown as TokenLocation[];
    } catch (e) {
      console.error("ERROR", e);
      return [];
    }
  }

  @Post("/name")
  public async getNameAtPoint(@Body() body: LocationCoordinates) {
    const sdk = new PointApi();
    try {
      const name = await sdk.getLocationName(body);
      return { name };
    } catch (e) {
      console.error("NAME RETRIEVAL ERROR", e);
      return { name: null };
    }
  }

  @Post("/weather")
  public async getWeatherAtPoint(
    @Body() body: { coords: LocationCoordinates },
  ) {
    const sdk = new PointApi();
    try {
      const values = await sdk.getWeatherAtPoint(body.coords);
      return values;
    } catch (e: any) {
      throw new InternalServerError(e.message);
    }
  }

  @Post("/forecast")
  public async getWeatherForecast(
    @Body() body: { coords: LocationCoordinates },
  ) {
    const sdk = new PointApi();
    try {
      const values = await sdk.getForecastAtPoint(body.coords);
      return values;
    } catch (e: any) {
      throw new InternalServerError(e.message);
    }
  }

  @UseBefore(UserRequired)
  @UseBefore(BlockAllTraffic)
  public override async findOne(@Param("id") id: number) {
    return super.findOne(id);
  }

  // @UseBefore(BlockAllTraffic)
  // public override async destroy(@Req() req) {
  //   return super.destroy(req);
  // }

  @UseBefore(BlockAllTraffic)
  public override async update(@Body() body: any) {
    return super.update(body);
  }

  // @UseBefore(BlockAllTraffic)
  // public override async create(@Req() req) {
  //   return super.create(req);
  // }

  @UseBefore(BlockAllTraffic)
  public override async count(@Body() body: any) {
    return super.count(body);
  }
}
