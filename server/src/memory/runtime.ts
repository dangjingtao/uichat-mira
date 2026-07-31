import path from "node:path";
import CONFIG from "@/config/index.js";
import { FileMemoryRepository } from "./file-memory.repository.js";
import { FileMemoryTurnLedger } from "./file-memory-turn-ledger.js";
import { MemoryService } from "./memory.service.js";
import type { MemoryConsolidator } from "./types.js";

const memoryRoot = path.resolve(CONFIG.DATABASE_DIR, "memory");

let consolidatorPromise: Promise<MemoryConsolidator> | undefined;

const lazyConsolidator: MemoryConsolidator = {
  async propose(input) {
    consolidatorPromise ??= import("./llm-memory.consolidator.js").then(
      ({ LlmMemoryConsolidator }) => new LlmMemoryConsolidator(),
    );
    return (await consolidatorPromise).propose(input);
  },
};

export const memoryService = new MemoryService(
  new FileMemoryRepository(memoryRoot),
  lazyConsolidator,
  new FileMemoryTurnLedger(memoryRoot),
);
