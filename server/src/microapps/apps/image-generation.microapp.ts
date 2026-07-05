import { imageGenerationBindingSchema } from "@/db/repositories/micro-apps.repository.js";
import type { MicroAppDefinition } from "../types.js";

export const imageGenerationMicroApp: MicroAppDefinition = {
  type: "image_generation",
  label: "生图工作区",
  description:
    "为桌面内的生图调试工作区保留共享注册定义和稳定 runtime key，不在这里承接实际生成逻辑。",
  runtimeKey: "image_generation",
  supportedAccessPoints: ["desktop.image_generation_studio"],
  bindingSchema: imageGenerationBindingSchema,
  async invoke() {
    return {
      mode: "error",
      errorCode: "image_generation_not_implemented",
      errorMessage:
        "image_generation 已完成共享注册，但当前线程没有引入实际运行时执行逻辑。",
    };
  },
};
