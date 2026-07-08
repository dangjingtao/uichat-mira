import { describe, expect, it } from "vitest";
import {
  composeComfyUiWorkflowJson,
  getComfyUiNodeSummaries,
} from "../model/comfyui-workbench";

describe("comfyui-workbench helpers", () => {
  it("writes mapped prompt, seed, and size overrides into the workflow json", () => {
    const workflowJson = JSON.stringify(
      {
        "57:27": {
          class_type: "CLIPTextEncode",
          inputs: {
            text: "",
          },
          _meta: {
            title: "Prompt",
          },
        },
        "57:3": {
          class_type: "KSampler",
          inputs: {
            seed: 0,
          },
        },
        "57:13": {
          class_type: "EmptyLatentImage",
          inputs: {
            width: 512,
            height: 512,
          },
        },
      },
      null,
      2,
    );

    const composed = composeComfyUiWorkflowJson({
      rawJson: workflowJson,
      mapping: {
        promptPath: "57:27.text",
        seedPath: "57:3.seed",
        widthPath: "57:13.width",
        heightPath: "57:13.height",
        outputNodeId: "9",
        previewNodeId: "9",
      },
      overrides: {
        prompt: "cinematic harbor portrait",
        seed: "42",
        size: "1536x1024",
      },
    });

    const parsed = JSON.parse(composed) as Record<
      string,
      { inputs: Record<string, unknown> }
    >;

    expect(parsed["57:27"].inputs.text).toBe("cinematic harbor portrait");
    expect(parsed["57:3"].inputs.seed).toBe(42);
    expect(parsed["57:13"].inputs.width).toBe(1536);
    expect(parsed["57:13"].inputs.height).toBe(1024);
  });

  it("extracts readable node summaries from the workflow json", () => {
    const nodes = getComfyUiNodeSummaries(
      JSON.stringify({
        "9": {
          class_type: "SaveImage",
          inputs: {},
          _meta: {
            title: "保存图像",
          },
        },
      }),
    );

    expect(nodes).toEqual([
      {
        id: "9",
        classType: "SaveImage",
        title: "保存图像",
      },
    ]);
  });
});
