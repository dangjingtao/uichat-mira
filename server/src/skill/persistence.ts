import { skillInstanceRepository } from "@/db/repositories/skill-instance.repository";
import { configureSkillInstancePersistence } from "./store";

export const configureDefaultSkillPersistence = () => {
  configureSkillInstancePersistence({
    create: skillInstanceRepository.create.bind(skillInstanceRepository),
    get: skillInstanceRepository.get.bind(skillInstanceRepository),
    getByRunId: skillInstanceRepository.getByRunId.bind(skillInstanceRepository),
    update: skillInstanceRepository.update.bind(skillInstanceRepository),
    clear: skillInstanceRepository.clear.bind(skillInstanceRepository),
  });
};
