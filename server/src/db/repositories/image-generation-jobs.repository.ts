import { eq } from "drizzle-orm";
import { getDb, getSqlite } from "../index.js";
import { imageGenerationJobs } from "../schema.js";
import type { ImageGenerationJob, ImageGenerationJobStore } from "@/microapps/image-generation/core/types.js";

const ensureTable = () => {
  getSqlite().exec(`
    CREATE TABLE IF NOT EXISTS image_generation_jobs (
      id TEXT PRIMARY KEY NOT NULL,
      job_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_image_generation_jobs_updated_at ON image_generation_jobs(updated_at);
  `);
};

const clone = (job: ImageGenerationJob): ImageGenerationJob => JSON.parse(JSON.stringify(job)) as ImageGenerationJob;

export const imageGenerationJobsRepository: ImageGenerationJobStore & { initialize(): void } = {
  initialize: ensureTable,
  async create(job) {
    getDb().insert(imageGenerationJobs).values({
      id: job.id,
      jobJson: JSON.stringify(job),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }).run();
  },
  async getById(id) {
    const row = getDb().select().from(imageGenerationJobs).where(eq(imageGenerationJobs.id, id)).get();
    if (!row) return null;
    return clone(JSON.parse(row.jobJson) as ImageGenerationJob);
  },
  async update(job) {
    getDb().update(imageGenerationJobs).set({
      jobJson: JSON.stringify(job),
      updatedAt: job.updatedAt,
    }).where(eq(imageGenerationJobs.id, job.id)).run();
  },
};
