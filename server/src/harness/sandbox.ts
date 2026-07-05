export interface HarnessSandboxPlan {
  mode: "off" | "node-permission";
  nodeOptions?: string;
}

export interface BuildHarnessSandboxPlanInput {
  cwd: string;
}

export const mergeNodeOptions = (
  existingOptions?: string | null,
  sandboxOptions?: string | null,
) =>
  [existingOptions, sandboxOptions]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim() || undefined;

export const buildHarnessSandboxPlan = (
  input: BuildHarnessSandboxPlanInput,
): HarnessSandboxPlan => {
  if (!process.env.MCP_HARNESS_SANDBOX_POC) {
    return {
      mode: "off",
    };
  }

  const sandboxOptions = [
    "--permission",
    "--allow-net",
    `--allow-fs-read=${JSON.stringify(input.cwd)}`,
  ].join(" ");

  return {
    mode: "node-permission",
    nodeOptions: mergeNodeOptions(process.env.NODE_OPTIONS, sandboxOptions),
  };
};
