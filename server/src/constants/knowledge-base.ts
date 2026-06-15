export const DEFAULT_KNOWLEDGE_BASE_ID = "default";
export const DEFAULT_KNOWLEDGE_BASE_NAME = "默认知识库";
export const DEFAULT_KNOWLEDGE_BASE_DESCRIPTION = "单知识库 MVP 默认实例";
export const DEFAULT_UPLOAD_SOURCE_LABEL = "本地上传";
export const MAX_UPLOAD_FILE_BYTES = 100 * 1024 * 1024;
export const SUPPORTED_UPLOAD_FILE_EXTENSIONS = ["md", "markdown", "txt"] as const;
export const MAX_EMBEDDING_BATCH_INPUTS = 32;
export const MAX_EMBEDDING_BATCH_CHARS = 60_000;

export const DEFAULT_CHUNKING_CONFIG = {
  separator: "\\n\\n",
  maxLength: 1024,
  overlap: 50,
  replaceWhitespace: true,
  removeUrls: false,
  useQaSplit: false,
} as const;
