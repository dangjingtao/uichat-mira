import { computerUseBindingSchema } from "@/db/repositories/micro-apps.repository.js";
import type { MicroAppDefinition } from "../types.js";

export const computerUseMicroApp: MicroAppDefinition = {
  type: "computer_use",
  label: "浏览器任务工作台",
  description:
    "为桌面内的浏览器任务工作台保留共享注册定义和稳定 runtime key，不在这里承接实际浏览器执行逻辑。",
  runtimeKey: "computer_use",
  supportedAccessPoints: ["desktop.computer_use_studio"],
  bindingSchema: computerUseBindingSchema,
  async invoke() {
    return {
      mode: "error",
      errorCode: "computer_use_not_implemented",
      errorMessage:
        "computer_use 已完成共享注册，但当前线程没有引入实际浏览器运行时或执行逻辑。",
    };
  },
};
