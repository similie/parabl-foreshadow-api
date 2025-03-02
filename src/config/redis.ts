/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  createClient,
  type RedisClientOptions,
  type RedisClientType,
} from "redis";
export const getRedisConfig = () => {
  const redisConfig: RedisClientOptions = {
    url: process.env.REDIS_CONFIG_URL || "redis://localhost:6379",
  };
  return redisConfig;
};

export class RedisStore {
  private static _instance: RedisStore | undefined;
  private client: RedisClientType;
  private constructor() {
    this.client = createClient(getRedisConfig()) as RedisClientType;
    this.client.on("error", (err) => console.error("Redis Client Error", err));
    this.client
      .connect()
      .catch((err) => console.error("Redis Connection Error", err));
  }

  public static get instance() {
    if (!this._instance) {
      this._instance = new RedisStore();
    }
    return this._instance;
  }

  // Set a key with an optional expiration (in seconds)
  public async set(
    key: string,
    value: any,
    expirationInSeconds?: number,
  ): Promise<void> {
    let vString = value;
    try {
      vString = JSON.stringify(value);
    } catch {
      //
    }

    if (expirationInSeconds) {
      await this.client.set(key, vString, { EX: expirationInSeconds });
    } else {
      await this.client.set(key, vString);
    }
  }

  // Retrieve a value by key
  public async get(key: string): Promise<string | null> {
    const val = await this.client.get(key);
    if (!val) {
      return null;
    }

    try {
      const anyVal = JSON.parse(val);
      return anyVal;
    } catch {
      //
    }
    return val;
  }
}
