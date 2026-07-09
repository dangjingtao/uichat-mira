import { codeGraphBindingSchema } from "@/db/repositories/micro-apps.repository.js";
import type { MicroAppDefinition } from "../types.js";

export const codeGraphMicroApp: MicroAppDefinition = {
  type: "codegraph",
  label: "CodeGraph Studio",
  description:
    "为桌面内的 CodeGraph 调试工作台保留共享注册定义和稳定 runtime key，不在这里承接 Planner 主链或默认 provider 暴露。",
  runtimeKey: "codegraph",
  supportedAccessPoints: ["desktop.codegraph_studio"],
  bindingSchema: codeGraphBindingSchema,
  async invoke() {
    return {
      mode: "error",
      errorCode: "codegraph_studio_not_invokable",
      errorMessage:
        "codegraph 已完成共享注册，但当前入口只提供桌面内 Studio 调试能力，不承接外部微应用调用。",
    };
  },
};
