"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, LoaderCircle } from "lucide-react";
import {
  getWenshuSkillCatalog,
  type WenshuSkillPackageDefinition,
} from "@/shared/api/officeSuiteSkills";

const explicitSkillDraftPattern = /(^|\s)\$([a-z0-9_-]*)$/i;

type AgentSkillSuggestion = Pick<
  WenshuSkillPackageDefinition,
  "id" | "name" | "description"
>;

export const getAgentSkillDraftQuery = (text: string) =>
  explicitSkillDraftPattern.exec(text)?.[2]?.toLowerCase() ?? null;

export const insertExplicitSkill = (text: string, skillId: string) =>
  text.replace(explicitSkillDraftPattern, (_match, prefix: string) => `${prefix}$${skillId} `);

export function AgentSkillComposerSuggestion({
  text,
  onSelect,
}: {
  text: string;
  onSelect: (skillId: string) => void;
}) {
  const [skills, setSkills] = useState<AgentSkillSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const query = getAgentSkillDraftQuery(text);

  useEffect(() => {
    if (query === null || skills.length > 0) return;

    let disposed = false;
    setLoading(true);
    setError(null);
    void getWenshuSkillCatalog()
      .then((catalog) => {
        if (!disposed) {
          setSkills(
            catalog.skills.map((skill) => ({
              id: skill.id,
              name: skill.name,
              description: skill.description,
            })),
          );
        }
      })
      .catch(() => {
        if (!disposed) setError("技能列表暂时不可用");
      })
      .finally(() => {
        if (!disposed) setLoading(false);
      });

    return () => {
      disposed = true;
    };
  }, [query, skills.length]);

  const matches = useMemo(() => {
    if (query === null) return [];
    return skills
      .filter((skill) => {
        const haystack = `${skill.id} ${skill.name} ${skill.description}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 8);
  }, [query, skills]);

  if (query === null) return null;

  return (
    <div
      role="listbox"
      aria-label="Agent skills"
      className="max-h-56 overflow-y-auto rounded-ui-control border border-border/70 bg-surface-primary py-1 shadow-sm"
    >
      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-tertiary">
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          <span>正在加载技能</span>
        </div>
      ) : null}
      {error ? <p className="px-3 py-2 text-xs text-text-tertiary">{error}</p> : null}
      {!loading && !error && matches.length === 0 ? (
        <p className="px-3 py-2 text-xs text-text-tertiary">没有匹配的技能</p>
      ) : null}
      {matches.map((skill) => (
        <button
          key={skill.id}
          type="button"
          role="option"
          aria-label={`使用技能 ${skill.name}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(skill.id)}
          className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <Box className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-text-primary">{skill.name}</span>
            <span className="block truncate text-xs text-text-tertiary">
              ${skill.id} {skill.description}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}
