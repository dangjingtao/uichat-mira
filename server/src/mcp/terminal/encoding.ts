import { decode } from "iconv-lite";

export const decodeTerminalOutput = (input: {
  chunk: string | Buffer;
  encoding: string;
}) => {
  if (typeof input.chunk === "string") {
    return input.chunk;
  }

  const encoding = input.encoding.toLowerCase();
  if (encoding === "utf8" || encoding === "utf-8") {
    return input.chunk.toString("utf8");
  }

  return decode(input.chunk, input.encoding);
};
