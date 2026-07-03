const DEFAULT_GITHUB_MIRROR_BASE = "https://github.com.cnpmjs.org";

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

export const resolveGithubMirrorUrl = (url: string) => {
  const raw = url.trim();
  if (!raw) {
    return raw;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return raw;
  }

  if (parsed.hostname !== "github.com") {
    return raw;
  }

  const mirrorBase =
    (typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    typeof import.meta.env.VITE_GITHUB_MIRROR_BASE === "string" &&
    import.meta.env.VITE_GITHUB_MIRROR_BASE.trim()
      ? import.meta.env.VITE_GITHUB_MIRROR_BASE.trim()
      : DEFAULT_GITHUB_MIRROR_BASE);

  const normalizedBase = trimSlashes(mirrorBase);
  const path = trimSlashes(`${parsed.pathname}${parsed.search}${parsed.hash}`);
  return path ? `${normalizedBase}/${path}` : normalizedBase;
};
