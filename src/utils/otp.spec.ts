/* eslint-disable @typescript-eslint/no-explicit-any */
import fetch from 'isomorphic-fetch';
import * as models from '../models';
import * as controllers from '../controllers';
import {
  Ellipsies,
  COMMON_API_SERVICE_ROUTES,
  INTERNAL_SERVICE_PORTS,
  testDataSourceCredentials,
  defaultTestDataSourceOpt,
} from '@similie/ellipsies';
import { generateUniqueId } from './tools';
const testEmail = 'adam.smith@similie.org';
const artifacts: Record<string, any> = {};
const ellipsies = new Ellipsies({
  models,
  controllers,
  port: INTERNAL_SERVICE_PORTS.TEST,
  prefix: COMMON_API_SERVICE_ROUTES, // Pre
});
const baseURL = `http://localhost:${INTERNAL_SERVICE_PORTS.TEST}${COMMON_API_SERVICE_ROUTES}`;
describe('OTP Code Generation', () => {
  beforeAll(async () => {
    await ellipsies.setDataSource(
      testDataSourceCredentials(),
      defaultTestDataSourceOpt()
    );
    await ellipsies.start();
    await ellipsies.pgManager.datasource.dropDatabase(); // careful, DO NOT USE IN PRODUCTION
    await ellipsies.pgManager.datasource.synchronize(); // this is required when running in full test mode
  });
  it('should generate a 5 digit OTP', async () => {
    const response = await fetch(`${baseURL}otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({
        identifier: testEmail,
        token: generateUniqueId(),
      }),
    });
    const results = await response.json();
    expect(results.id).toBeDefined();
    // this is not going to be the case for when we are in production
    expect(results.otp).toBeDefined();
    artifacts.created = results;
  }, 10000);

  it('should fail to verify the opt', async () => {
    const response = await fetch(`${baseURL}otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({
        identifier: testEmail,
        token: generateUniqueId(),
        otp: artifacts.created.otp + '1',
      }),
    });
    const results = await response.json();
    expect(results.otp).toBe(false);
  });

  it('should get the otp from the api', async () => {
    const response = await fetch(`${baseURL}otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({
        identifier: testEmail,
        token: generateUniqueId(),
        otp: artifacts.created.otp,
      }),
    });
    const results = await response.json();
    expect(results.otp).toBe(true);
    expect(results.token).toBeDefined();
    artifacts.token = results.token;
  });
  it('should get the otp from the api', async () => {
    const response = await fetch(`${baseURL}otp?id=${artifacts.created.id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
    });
    const [result] = await response.json();
    expect(result.otp).toBeDefined();
    expect(result.id).toBe(artifacts.created.id);
    expect(result.active).toBe(false);
  });

  it('should get blocked without the token header', async () => {
    const response = await fetch(`${baseURL}appusers/registered`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({ username: 'testEmail' }),
    });
    expect(response.status).toBe(500);
    // console.log('BOOMOP', response);
  });

  it('should not get blocked with the token header', async () => {
    const response = await fetch(`${baseURL}appusers/registered`, {
      method: 'POST',
      headers: {
        authorization: artifacts.token,
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({ userName: 'testEmail' }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.registered).toBe(false);
  });

  it('should now registered our user', async () => {
    const response = await fetch(`${baseURL}appusers`, {
      method: 'POST',
      headers: {
        authorization: artifacts.token,
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({
        userName: 'testEmail',
        name: 'Adam Similie',
        email: testEmail,
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBeDefined();
    artifacts.user = data;
    artifacts.token = generateUniqueId();
  });

  it('should now assign the token to the user', async () => {
    const response = await fetch(`${baseURL}user-tokens`, {
      method: 'POST',
      headers: {
        // authorization: artifacts.token,
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({ user: artifacts.user.id, token: artifacts.token }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.user).toBeDefined();
    expect(data.user.id).toBeDefined();
  });

  it('should now registered our user', async () => {
    const response = await fetch(`${baseURL}appusers/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({ userName: 'testEmail', token: artifacts.token }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBeDefined();
    artifacts.loginOtp = data;
  });

  it('should successfully verify the opt', async () => {
    const response = await fetch(`${baseURL}otp/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', // Add this header
      },
      body: JSON.stringify({
        identifier: artifacts.loginOtp.identifier,
        token: artifacts.token,
        otp: artifacts.loginOtp.otp,
      }),
    });
    const results = await response.json();
    expect(results.otp).toBe(true);
  });

  afterAll(async () => {
    await ellipsies.shutdown();
  });
});
