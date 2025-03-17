import {
  Body,
  EllipsiesController,
  EllipsiesExtends,
  ExpressRequest,
  InternalServerError,
  Param,
  Post,
  Req,
  UseBefore,
  MoreThan,
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
      const value = await LocationRisk.find({
        where: {
          location: location.id,
          isActive: true,
          createdAt: MoreThan(
            new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 3),
          ),
        },
      });

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
    if (!token) {
      return [];
    }
    try {
      const found = await UserTokens.findOne({
        where: { token },
        relations: { user: true },
      });

      if (!found || !found.user) {
        return [];
      }

      const user = typeof found.user === "string" ? found.user : found.user.id;

      const values = await TokenLocation.find({
        order: { createdAt: "desc" },
        where: { user },
      });

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
