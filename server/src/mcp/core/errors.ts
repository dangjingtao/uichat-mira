import { badRequest, internalError, notFound } from "@/utils/route-errors.js";

export const mcpBadRequest = badRequest;
export const mcpNotFound = notFound;
export const mcpInternalError = internalError;

export class McpApprovalRequiredError extends Error {
  scope?: string;

  constructor(message: string, input: { scope?: string } = {}) {
    super(message);
    this.name = "McpApprovalRequiredError";
    this.scope = input.scope;
  }
}
