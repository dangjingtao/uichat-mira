import type {
  ImageGenerationCreateRequest,
  ImageGenerationProviderAdapter,
} from "../core/types.js";

export type JsonPrimitive = string | number | boolean | null;

export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type HttpRequest = {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
};

export type HttpResponse = {
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
  arrayBuffer?(): Promise<ArrayBuffer>;
};

export type ImageGenerationAdapterContext = {
  http(request: HttpRequest): Promise<HttpResponse>;
  now(): Date;
};

export type AdapterFactoryOptions = {
  context?: ImageGenerationAdapterContext;
};

export type AdapterRequestLike = Pick<
  ImageGenerationCreateRequest,
  | "count"
  | "model"
  | "negativePrompt"
  | "prompt"
  | "providerParams"
  | "seed"
  | "size"
  | "stylePreset"
  | "workflowApiJson"
>;

export type ProviderAdapter = ImageGenerationProviderAdapter;
