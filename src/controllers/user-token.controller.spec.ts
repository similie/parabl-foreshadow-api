import fetch from "isomorphic-fetch";
import * as models from "../models";
import * as controllers from "../controllers";
import {
  Ellipsies,
  COMMON_API_SERVICE_ROUTES,
  INTERNAL_SERVICE_PORTS,
  testDataSourceCredentials,
  defaultTestDataSourceOpt,
  QueryAgent,
} from "@similie/ellipsies";
import { generateUniqueId } from "../utils/tools";
const testEmail = "adam.smith@similie.org";
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
describe("UserTokenControllerTest", () => {
  beforeAll(async () => {
    await ellipsies.setDataSource(
      testDataSourceCredentials(),
      defaultTestDataSourceOpt(),
    );
    await ellipsies.start();
    await ellipsies.pgManager.datasource.dropDatabase(); // careful, DO NOT USE IN PRODUCTION
    await ellipsies.pgManager.datasource.synchronize(); // this is required when running in full test mode
    artifacts.token1 = generateUniqueId();
  });

  it("should create a new user", async () => {
    const userQ = new QueryAgent<models.ApplicationUser>(
      models.ApplicationUser,
      {},
    );
    artifacts.testUser = await userQ.create(testUser);
    expect(artifacts.testUser.id).toBeDefined();
  });

  it("should should act as though our user isn't logged in", async () => {
    const response = await fetch(`${baseURL}user-tokens/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Add this header
      },
      body: JSON.stringify({
        token: artifacts.token1,
      }),
    });
    const results = await response.json();
    expect(results.id).toBeDefined();
    // // this is not going to be the case for when we are in production
    expect(results.token).toBe(artifacts.token1);
    artifacts.created = results;
  });

  it("should should act as though our user isn't logged in", async () => {
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
    expect(results.user).not.toBeFalsy();
    artifacts.created = results;
  });

  it("should should pull our user now", async () => {
    const response = await fetch(`${baseURL}user-tokens/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Add this header
      },
      body: JSON.stringify({
        token: artifacts.token1,
      }),
    });
    const results = await response.json();
    expect(results.id).toBeDefined();
    // // this is not going to be the case for when we are in production
    expect(results.token).toBe(artifacts.token1);
    expect(results.user).not.toBeFalsy();
  });

  it("should should pull our user now", async () => {
    artifacts.token2 = generateUniqueId();
    const response = await fetch(`${baseURL}user-tokens/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", // Add this header
      },
      body: JSON.stringify({
        token: artifacts.token2,
        user: artifacts.testUser.id,
      }),
    });
    const results = await response.json();
    expect(results.id).toBeDefined();
    // // this is not going to be the case for when we are in production
    expect(results.token).toBe(artifacts.token2);
    expect(results.user).not.toBeFalsy();
  });

  afterAll(async () => {
    // await ellipsies.pgManager.datasource.dropDatabase();
    await ellipsies.shutdown();
  });
});
