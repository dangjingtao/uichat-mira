import { FileCode2, FileSpreadsheet, FileText } from "lucide-react";

interface FileIconProps {
  extension: string;
  className?: string;
}

export function FileIcon({ extension, className = "h-5 w-5" }: FileIconProps) {
  const ext = extension.toUpperCase();

  if (ext === "PDF") {
    return <FileText className={`${className} text-rose-500`} />;
  }

  if (ext === "XLSX" || ext === "XLS") {
    return <FileSpreadsheet className={`${className} text-emerald-500`} />;
  }

  return <FileCode2 className={`${className} text-sky-500`} />;
}
