declare module "@wecom/aibot-node-sdk" {
  export type SmartRobotClientLike = {
    connect: () => unknown;
    disconnect: () => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
    isConnected?: boolean;
  };

  export class WSClient {
    constructor(options: { botId: string; secret: string });
    connect(): this;
    disconnect(): void;
    on(event: string, handler: (...args: unknown[]) => void): void;
    isConnected?: boolean;
  }

  const defaultExport: {
    WSClient: typeof WSClient;
  };

  export default defaultExport;
}
