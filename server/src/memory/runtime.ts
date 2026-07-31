import path from "node:path";
import CONFIG from "@/config/index.js";
import { FileMemoryRepository } from "./file-memory.repository.js";
import { LlmMemoryConsolidator } from "./llm-memory.consolidator.js";
import { MemoryService } from "./memory.service.js";

const memoryRoot = path.resolve(CONFIG.DATABASE_DIR, "memory");

export const memoryService = new MemoryService(
  new FileMemoryRepository(memoryRoot),
  new LlmMemoryConsolidator(),
);
