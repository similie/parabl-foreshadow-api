import { PointApi } from "./point-sdk";

const api = new PointApi();
import fetch from "isomorphic-fetch";
import * as models from "../models";
import * as controllers from "../controllers";
import {
  Ellipsies,
  COMMON_API_SERVICE_ROUTES,
  INTERNAL_SERVICE_PORTS,
  testDataSourceCredentials,
  defaultTestDataSourceOpt,
} from "@similie/ellipsies";
import { generateUniqueId } from "../utils/tools";
import { seedContent } from "../seeds";
import { runJob } from "../jobs";
const testEmail = process.env.TEST_EMAIL_ADDRESS;
const thisPort = INTERNAL_SERVICE_PORTS.TEST - 1;
const ellipsies = new Ellipsies({
  models,
  controllers,
  port: thisPort,
  prefix: COMMON_API_SERVICE_ROUTES, // Pre
});
const baseURL = `http://localhost:${thisPort}${COMMON_API_SERVICE_ROUTES}`;

const testUser = {
  email: testEmail,
  userName: "similieParabl",
  name: "Parabl Foreshadow",
};
const artifacts: Record<string, any> = {};
describe("Pont forecast API", () => {
  beforeAll(async () => {
    if (!testEmail) {
      throw new Error("Please set the TEST_EMAIL_ADDRESS environment variable");
    }

    await ellipsies.setDataSource(
      testDataSourceCredentials(),
      defaultTestDataSourceOpt(),
    );
    await ellipsies.start();
    await ellipsies.pgManager.datasource.dropDatabase(); // careful, DO NOT USE IN PRODUCTION
    await ellipsies.pgManager.datasource.synchronize(); // this is required when running in full test mode
    await seedContent(["risks"], ellipsies.pgManager.datasource);
    artifacts.token1 = generateUniqueId();
  });

  it("should create a new user", async () => {
    artifacts.testUser = await models.ApplicationUser.save(
      models.ApplicationUser.create(testUser),
    );
    expect(artifacts.testUser.id).toBeDefined();
  });

  it("should generate user token locations ", async () => {
    const response = await fetch(`${baseURL}user-tokens/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Add this header
      },
      body: JSON.stringify({
        token: artifacts.token1,
        user: artifacts.testUser.id,
      }),
    });
    const results = await response.json();
    expect(results.id).toBeDefined();
    // // this is not going to be the case for when we are in production
    expect(results.token).toBe(artifacts.token1);
    artifacts.created = results;
  });

  it("should assign token locations to our user ", async () => {
    // const tl = new QueryAgent<models.TokenLocation>(models.TokenLocation, {});
    const storedLocations = [];
    const locationLength = 5;
    for (let i = 0; i < locationLength; i++) {
      const point = api.getRandomGeoPoint();
      const location = (await models.TokenLocation.save(
        models.TokenLocation.create({
          user: artifacts.testUser.id,
          name: `location-${i}`,
          latitude: point.latitude,
          longitude: point.longitude,
        }),
      )) as models.TokenLocation;
      if (!location) {
        throw new Error("Could not create location");
      }
      expect(location.id).toBeDefined();
      storedLocations.push(location);
    }
    expect(storedLocations.length).toBe(locationLength);
  });

  it("should run the risk indicator service", async () => {
    let good = false;
    try {
      await runJob();
      good = true;
    } catch (e) {
      expect(e instanceof Error).toBeFalsy();
    }
    expect(good).toBeTruthy();
  }, 100000000);
  it("should return a streaming forecast", async () => {
    const point = api.getRandomGeoPoint();
    for (let i = 0; i < PointApi.STEP_HOURS; i++) {
      const stream = await api.streamForecast(
        point,
        PointApi.DAYS_TO_READ,
        PointApi.STEP_HOURS,
        i + 1,
      );
      try {
        await stream((data: any) => {
          if (
            !data ||
            (typeof data !== "string" && Object.keys(data).length === 0)
          ) {
            return;
          }

          if (data.progress) {
            return console.log("Forecast Progress", data.progress);
          }

          console.log("I HAVE THIS DATA", data);
        });
      } catch (e) {
        console.log(e);
      }
    }
  }, 100000000);
  afterAll(async () => {
    await ellipsies.shutdown();
  });
});
