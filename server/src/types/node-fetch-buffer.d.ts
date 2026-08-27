export {};

declare global {
  /**
   * Node.js fetch (Undici) accepts Buffer bodies at runtime. Keep that Node-specific
   * capability visible to TypeScript without widening the browser RequestInit type.
   */
  function fetch(
    input: string | URL | Request,
    init?: Omit<RequestInit, "body"> & {
      body?: BodyInit | Buffer | null;
    },
  ): Promise<Response>;
}
