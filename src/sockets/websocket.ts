/* eslint-disable object-curly-spacing */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Ellipsies } from "@similie/ellipsies";
import { Server, Socket } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import {
  createClient,
  type RedisClientOptions,
  type RedisClientType,
} from "redis";
import { type Server as HTTPServer } from "http";

export type SocketMessage = {
  topic: string;
  data: any;
};

export interface CallbackContext {
  token: string; // Add any other properties you need
  id: string;
}

export type CallbackFunction = (
  this: CallbackContext,
  data: any,
) => void | Promise<void>;

export class SocketServer {
  private static _instance: SocketServer | undefined;
  private _io: Server | undefined;

  //   private readonly _subscriptions = new Map<string, Set<CallbackFunction>>();
  private pubClient: RedisClientType;
  private subClient: RedisClientType;

  private constructor(server: HTTPServer) {
    if (!server) {
      throw new Error("Server is not an HTTP server");
    }
    this._io = new Server(server, { cors: { origin: "*" } });

    this._io.on("connection", (ws: Socket) => {
      ws.on("close", () => {});
      ws.onAny((topic: string, message: any) => {
        console.log("Broadcast Message: @todo", topic, message);
      });
    });
  }

  public async disconnect() {
    console.log("Disconnecting WebSocket server...");
    if (this._io) {
      await this._io.close(); // Disconnect all sockets
    }

    if (this.pubClient.isOpen) {
      console.log("Closing Redis pubClient...");
      await this.pubClient.quit();
    }
    if (this.subClient.isOpen) {
      console.log("Closing Redis subClient...");
      await this.subClient.quit();
    }
    console.log("WebSocket server disconnected");

    SocketServer._instance = undefined;
  }

  private async connectRedis(
    redisConnection?: RedisClientOptions,
  ): Promise<void> {
    if (!redisConnection) {
      return;
    }
    // getting a bug with redis I cannot solve
    return;
    this.pubClient = createClient({
      ...redisConnection,
      database: 4,
    }) as RedisClientType;
    this.subClient = this.pubClient.duplicate();
    await this.pubClient.connect();
    await this.subClient.connect();
    this._io!.adapter(createAdapter(this.pubClient, this.subClient));
  }

  private delay(time = 50) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }
  public async connected(attempts = 10): Promise<boolean> {
    return true;

    if (this.pubClient.isReady) {
      return true;
    }

    for (let i = 0; i < 10; i++) {
      if (this.pubClient.isReady) {
        return true;
      }
      await this.delay(50);
    }

    if (this.pubClient.isReady) {
      return true;
    }

    if (attempts <= 0) {
      throw new Error("Failed to connect to the socket");
    }

    await this.pubClient.connect();
    attempts--;
    return await this.connected(attempts);
  }

  public static async applyServer(
    server: HTTPServer,
    redisConnection?: RedisClientOptions,
  ): Promise<SocketServer> {
    if (SocketServer._instance) {
      return SocketServer._instance;
    }
    SocketServer._instance = new SocketServer(server);
    await SocketServer._instance.connectRedis(redisConnection);
    return SocketServer._instance;
  }

  public static get instance(): SocketServer {
    if (!SocketServer._instance) {
      throw new Error("SocketServer instance not initialized");
    }
    return SocketServer._instance;
  }

  public subscribe(topic: string, cb: CallbackFunction): any {
    // return this._io.on(topic, cb);

    if (!this._io) {
      throw new Error("SocketServer instance not initialized");
    }

    this._io.on("connection", (socket: Socket) => {
      const token = socket.handshake.auth.token; // Extract token

      socket.on(topic, cb.bind({ token, id: socket.id }));
    });
  }

  public off(topic: string, cb: CallbackFunction): any {
    return this._io!.off(topic, cb);
  }

  public async publish(topic: string, data: any) {
    if (!this._io) {
      throw new Error("SocketServer instance not initialized");
    }

    const connected = await this.connected();
    if (!connected) {
      throw new Error("Failed to connect to the socket");
    }
    try {
      const sanitizedData = JSON.stringify(data); // Ensure valid JSON
      this._io.emit(topic, JSON.parse(sanitizedData)); // Parse back to object
    } catch (e: any) {
      console.error("Failed to publish to socket", e.message);
    }
  }

  public async sendToClient(
    clientId: string,
    message: SocketMessage,
  ): Promise<void> {
    if (!this._io) {
      throw new Error("IO not initialized");
    }

    const connected = await this.connected();
    if (!connected) {
      throw new Error("Failed to connect to the socket");
    }

    try {
      const client = this._io.to(clientId);
      if (!client) {
        return;
      }

      client.emit(message.topic, message.data);
    } catch (e) {
      console.error("Error sending message to client:", e);
    }
  }
}

export const EllipsiesSocket = async (
  ellipses: Ellipsies,
  redisConnection?: RedisClientOptions,
) => {
  const server = ellipses.server.server;
  if (!server) {
    throw new Error("Server not defined");
  }
  const instance = await SocketServer.applyServer(server, redisConnection);
  return instance;
};
