import { verifyPayload } from "./payload-utils.mjs";

const allowSkippedTests = ["1", "true"].includes(
  process.env.MIRA_RELEASE_ALLOW_SKIPPED_TESTS?.trim().toLowerCase() ?? "",
);

verifyPayload({ allowSkippedTests });
