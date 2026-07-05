import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import type {
  ImageGenerationArtifactCandidate,
  ImageGenerationArtifactStore,
  ImageGenerationArtifactSummary,
  ImageGenerationJob,
} from "../core/types.js";
import { createArtifactFileName } from "./shared.js";
import type { ArtifactStoreOptions } from "./types.js";

export class LocalImageGenerationArtifactStore
  implements ImageGenerationArtifactStore
{
  private readonly rootDir: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => string;
  private readonly idFactory: () => string;

  constructor(options: ArtifactStoreOptions) {
    this.rootDir = options.rootDir;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString());
    this.idFactory = options.idFactory ?? randomUUID;
  }

  async materializeArtifacts(input: {
    job: ImageGenerationJob;
    artifacts: ImageGenerationArtifactCandidate[];
  }): Promise<ImageGenerationArtifactSummary[]> {
    const jobRootDir = path.join(this.rootDir, input.job.id);
    await fs.mkdir(jobRootDir, { recursive: true });

    const materialized: ImageGenerationArtifactSummary[] = [];
    for (const artifact of input.artifacts) {
      materialized.push(await this.materializeSingle(jobRootDir, artifact));
    }
    return materialized;
  }

  private async materializeSingle(
    rootDir: string,
    input: ImageGenerationArtifactCandidate,
  ): Promise<ImageGenerationArtifactSummary> {
    const id = input.id ?? this.idFactory();
    const fileName = createArtifactFileName({
      fileName: input.fileName,
      mimeType: input.mimeType,
      fallbackSource: input.remoteUrl ?? input.localPath,
      id,
    });
    const localPath = path.join(rootDir, fileName);
    let bytes: Uint8Array;

    switch (input.source) {
      case "base64":
        if (!input.base64Data) {
          throw new Error("Base64 artifact input requires base64Data.");
        }
        bytes = Buffer.from(input.base64Data, "base64");
        break;
      case "remote-url":
        if (!input.remoteUrl) {
          throw new Error("Remote artifact input requires remoteUrl.");
        }
        bytes = await this.downloadRemoteUrl(input.remoteUrl);
        break;
      case "local-file":
        if (!input.localPath) {
          throw new Error("Local artifact input requires localPath.");
        }
        bytes = await fs.readFile(input.localPath);
        break;
      default:
        throw new Error(`Unsupported artifact source: ${String(input.source)}`);
    }

    await fs.writeFile(localPath, bytes);

    return {
      id,
      type: input.type,
      mimeType: input.mimeType,
      source: input.source,
      localPath,
      fileName,
      byteSize: input.byteSize ?? bytes.byteLength,
      remoteUrl: input.remoteUrl,
      width: input.width,
      height: input.height,
      expiresAt: input.expiresAt,
      meta: {
        materializedAt: this.now(),
        ...(input.meta ?? {}),
      },
    };
  }

  private async downloadRemoteUrl(url: string): Promise<Uint8Array> {
    const response = await this.fetchImpl(url);
    if (!response.ok) {
      throw new Error(`Failed to download remote artifact. HTTP ${response.status}.`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
}
