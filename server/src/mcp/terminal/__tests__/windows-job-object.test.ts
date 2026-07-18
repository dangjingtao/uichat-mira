import { describe, expect, it } from "vitest";

import {
  createWindowsJobCommandArgs,
  createWindowsJobPtyArgs,
  getWindowsJobMarker,
} from "../windows-job-object.js";

const decodeEncodedCommand = (args: string[]) => {
  const index = args.indexOf("-EncodedCommand");
  expect(index).toBeGreaterThanOrEqual(0);
  return Buffer.from(args[index + 1]!, "base64").toString("utf16le");
};

describe("Windows Job Object bootstrap", () => {
  it("sets KILL_ON_JOB_CLOSE and assigns the shell process", () => {
    const script = decodeEncodedCommand(
      createWindowsJobCommandArgs("Write-Output 'ok'"),
    );

    expect(script).toContain("CreateJobObject");
    expect(script).toContain("SetInformationJobObject");
    expect(script).toContain("AssignProcessToJobObject");
    expect(script).toContain("0x00002000");
    expect(script).toContain(getWindowsJobMarker());
  });

  it("keeps a PTY shell open after bootstrap", () => {
    const args = createWindowsJobPtyArgs();
    const script = decodeEncodedCommand(args);

    expect(args).toContain("-NoExit");
    expect(script).toContain(getWindowsJobMarker());
  });
});
