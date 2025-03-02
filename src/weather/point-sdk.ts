/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from "node-fetch";
import {
  getGeoTime,
  getLocationName,
  getWeatherRequestTemplate,
  isDayAtLocation,
} from "./utils";
import {
  ForecastResponseDetails,
  ForecastWarning,
  LocationCoordinates,
  PointForecastDetails,
  PointForecastValue,
  WeatherMeta,
} from "../types";
import {
  ExpressRequest,
  ExpressResponse,
  QueryAgent,
} from "@similie/ellipsies";
import { RiskIndicator, TokenLocation } from "../models";
import { RiskIndicatorMapValue } from "../utils";
import * as http from "http";
import * as https from "https";

const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

export class PointApi {
  public static readonly DAYS_TO_READ = 4;
  public static readonly STEP_HOURS = 6;
  public static readonly POINT_CHECK_TIMER = { pattern: "0 0 */1 * * *" };
  public static readonly EXTREME_RISK = RiskIndicatorMapValue.high;
  // we are going to cache these values
  public static readonly ALL_RISK_VALUES: RiskIndicator[] = [];

  public getGeoTime(coords: LocationCoordinates, date?: Date) {
    return getGeoTime(coords, date);
  }

  public getLocationName(coords: LocationCoordinates) {
    return getLocationName(coords);
  }

  public async getAllRiskValues() {
    if (PointApi.ALL_RISK_VALUES.length) {
      return PointApi.ALL_RISK_VALUES;
    }

    const agent = new QueryAgent<RiskIndicator>(RiskIndicator, {
      where: { isActive: true },
    });
    const allRisks = (await agent.getObjects()) as RiskIndicator[];
    PointApi.ALL_RISK_VALUES.push(...allRisks);

    return allRisks;
  }

  public async getHighRiskValues(riskValue: number = PointApi.EXTREME_RISK) {
    const risks = await this.getAllRiskValues();
    const highRisks = risks.filter(
      (risk: RiskIndicator) => risk.severityValue >= riskValue,
    );
    return highRisks;
  }

  public async getWeatherMeta(
    coords: LocationCoordinates,
    date?: Date,
  ): Promise<WeatherMeta> {
    const timeDetails = this.getGeoTime(coords, date);
    const closestCity = await this.getLocationName(coords);
    const isDay = isDayAtLocation(
      coords.latitude,
      coords.longitude,
      timeDetails.localTime,
      timeDetails.timeZone,
    );
    return {
      timezone: timeDetails.timeZone,
      date: timeDetails.localTime,
      closestCity,
      ...isDay,
    };
  }

  private alertsToMap(risks: RiskIndicator[]) {
    const alertMap: Record<string, RiskIndicator[]> = {};
    for (const risk of risks) {
      const key = risk.paramKey;
      if (!alertMap[key]) {
        alertMap[key] = [];
      }
      alertMap[key].push(risk);
    }
    return alertMap;
  }

  private queryRisks(value: number, risks: RiskIndicator[]) {
    for (const risk of risks) {
      const floor = risk.floor != null ? risk.floor : Infinity * -1;
      const ceil = risk.ceil != null ? risk.ceil : Infinity;
      if (value >= floor && value < ceil) {
        return risk;
      }
    }
    return null;
  }

  public async raiseExtremeAlerts(
    forecasts: ForecastResponseDetails[],
    location: TokenLocation,
  ): Promise<ForecastWarning[]> {
    const allRisks = await this.getHighRiskValues();

    const coords = {
      latitude: location.latitude,
      longitude: location.longitude,
    };
    const riskMap = this.alertsToMap(allRisks);
    const highRisks: ForecastWarning[] = [];
    for (const forecast of forecasts) {
      const meta = forecast.metadata;
      for (const value of forecast.values) {
        const risks = riskMap[meta.shortName];
        if (!risks || !risks.length) {
          continue;
        }
        const risk = this.queryRisks(value.value, risks);
        if (!risk) {
          continue;
        }

        const geoTime = getGeoTime(coords, new Date(value.datetime));
        const sendRisk: Partial<RiskIndicator> & { onDate?: Date } = {
          ...risk,
          onDate: new Date(geoTime.localTime),
        };
        highRisks.push({
          risk: sendRisk,
          location,
          forecast: meta,
          value: value.value,
          datetime: geoTime.localTime,
        });
        // we are just going to break after the first one
        break;
      }
    }
    return highRisks;
  }

  private async raiseAlerts(details: PointForecastDetails[]) {
    const allRisks = await this.getAllRiskValues();
    const riskMap = this.alertsToMap(allRisks);
    for (const detail of details) {
      for (const value of detail.values) {
        const risks = riskMap[value.metadata.shortName];
        if (!risks || !risks.length) {
          continue;
        }
        if (!value.value) {
          continue;
        }
        const risk = this.queryRisks(value.value, risks);
        if (!risk) {
          continue;
        }
        value.risk = risk;
      }
    }
    return details;
  }

  private async iterateValuesWithMeta(
    coords: LocationCoordinates,
    forecast: ForecastResponseDetails[],
  ): Promise<PointForecastDetails[]> {
    const meta: PointForecastDetails[] = [];
    const closestCity = await this.getLocationName(coords);
    const first = forecast[0];
    if (!first) {
      throw new Error("No Forecast Found");
    }
    const size = first.values.length;

    for (let i = 0; i < size; i++) {
      let sendMeta: Partial<PointForecastDetails> = {
        closestCity,
        values: [],
      };
      for (const _forecast of forecast) {
        const forecast = _forecast.values[i];
        if (!sendMeta.values) {
          continue;
        }
        sendMeta.values.push({
          ..._forecast,
          value: forecast.value,
        });
        if (sendMeta.timezone) {
          continue;
        }
        const timeDetails = this.getGeoTime(
          coords,
          new Date(forecast.datetime),
        );
        const isDay = isDayAtLocation(
          coords.latitude,
          coords.longitude,
          timeDetails.localTime,
          timeDetails.timeZone,
        );
        sendMeta = {
          ...sendMeta,
          timezone: timeDetails.timeZone,
          date: timeDetails.localTime,
          ...isDay,
        };
      }
      meta.push(sendMeta as PointForecastDetails);
    }
    return meta;
  }

  public async rawPointForecast(
    coords: LocationCoordinates,
    days: number = PointApi.DAYS_TO_READ,
    hours: number = PointApi.STEP_HOURS,
  ): Promise<ForecastResponseDetails[]> {
    const request = getWeatherRequestTemplate(coords);
    request.total_days = days;
    request.step_hours = hours;
    const response = await fetch(process.env.FORESHADOW_API_URL + "/forecast", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
    });
    const responseValues = (await response.json()) as ForecastResponseDetails[];
    return responseValues;
  }

  // public static proxTileServer(
  //   req: ExpressRequest,
  //   res: ExpressResponse
  // ): Promise<void> {
  //   return new Promise<void>((resolve, reject) => {
  //     const joinedPath = req.path.split('/');
  //     const index = joinedPath.indexOf('tiles');
  //     const append = joinedPath.splice(index).join('/');
  //     const targetHost = process.env.FORESHADOW_API_URL + `/${append}`;
  //     const targetUrl = new URL(targetHost);
  //     // Assuming req.query is a plain object, URLSearchParams will serialize it.
  //     targetUrl.search = new URLSearchParams(req.query as any).toString();
  //     targetUrl.searchParams.delete('authorization');
  //     console.log('I AM GETTING THIS TO THE SERVER', targetUrl.toString());
  //     // Choose the correct module based on the protocol.
  //     const lib = targetUrl.protocol === 'https:' ? https : http;
  //     // Make the request to the target URL.
  //     lib
  //       .get(targetUrl.toString(), (proxyRes) => {
  //         // Set response headers and status from the proxied response.
  //         res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
  //         // Pipe the response data back to the original response.
  //         proxyRes.pipe(res);

  //         proxyRes.on('end', () => {
  //           resolve();
  //         });

  //         // In case of an error in the proxy response stream, reject the promise.
  //         proxyRes.on('error', (err) => {
  //           reject(err);
  //         });
  //       })
  //       .on('error', (err: Error) => {
  //         console.error('Proxy error:', err);
  //         if (!res.headersSent) {
  //           res.status(500).send('Error connecting to target host');
  //         }
  //         reject(err);
  //       });
  //   }).catch(console.error);
  // }

  public static proxTileServer(
    req: ExpressRequest,
    res: ExpressResponse,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const joinedPath = req.path.split("/");
      const index = joinedPath.indexOf("tiles");
      const append = joinedPath.slice(index).join("/"); // use slice instead of splice to avoid mutating array
      const targetHost = process.env.FORESHADOW_API_URL + `/${append}`;
      const targetUrl = new URL(targetHost);

      // Serialize query parameters and remove authorization if present.
      targetUrl.search = new URLSearchParams(req.query as any).toString();
      targetUrl.searchParams.delete("authorization");

      // Log target URL (remove or comment out in production)
      console.log("Requesting tile from:", targetUrl.toString());

      // Select the appropriate agent based on the protocol.
      const agent = targetUrl.protocol === "https:" ? httpsAgent : httpAgent;

      // Use get with the agent option.
      const lib = targetUrl.protocol === "https:" ? https : http;
      lib
        .get(targetUrl.toString(), { agent }, (proxyRes) => {
          // Forward response headers and status
          res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
          // Pipe response data back to the client.
          proxyRes.pipe(res);

          proxyRes.on("end", () => resolve());
          proxyRes.on("error", (err) => reject(err));
        })
        .on("error", (err: Error) => {
          console.error("Proxy error:", err);
          if (!res.headersSent) {
            res.status(500).send("Error connecting to target host");
          }
          reject(err);
        });
    }).catch(console.error);
  }

  public async rawPointWeather(
    coords: LocationCoordinates,
  ): Promise<PointForecastValue[]> {
    const request = getWeatherRequestTemplate(coords);
    const response = await fetch(process.env.FORESHADOW_API_URL + "/point", {
      method: "POST",
      body: JSON.stringify(request),
      headers: { "Content-Type": "application/json" },
    });
    const values = (await response.json()) as PointForecastValue[];
    return values;
  }

  public async getForecastAtPoint(
    coords: LocationCoordinates,
  ): Promise<PointForecastDetails[]> {
    try {
      const responseValues = await this.rawPointForecast(coords);
      const details = await this.iterateValuesWithMeta(coords, responseValues);
      return this.raiseAlerts(details);
    } catch (e: any) {
      console.error("WEATHER API ERROR", e);
      throw new Error(e.message);
    }
  }

  public async getWeatherAtPoint(
    coords: LocationCoordinates,
  ): Promise<PointForecastDetails> {
    try {
      const values = await this.rawPointWeather(coords);
      const meta = await this.getWeatherMeta(coords);
      const results: PointForecastDetails = {
        values,
        ...meta,
      };
      await this.raiseAlerts([results]);
      return results;
    } catch (e: any) {
      console.error("WEATHER API ERROR", e);
      throw new Error(e.message);
    }
  }
}
