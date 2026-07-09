import type { MicroAppDefinition } from "../types.js";

export const ttsMicroApp: MicroAppDefinition = {
  type: "tts",
  label: "TTS",
  description:
    "为桌面内的语音合成工作台保留共享注册定义和稳定 runtime key，不在这里承接外部接入点执行逻辑。",
  runtimeKey: "tts",
  supportedAccessPoints: ["desktop.tts_studio"],
  bindingSchema: {
    fields: [],
  },
  async invoke() {
    return {
      mode: "error",
      errorCode: "tts_not_implemented",
      errorMessage:
        "tts 已完成共享注册，但当前线程没有引入外部接入点运行时执行逻辑。",
    };
  },
};
