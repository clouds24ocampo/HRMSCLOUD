// What a chat message may carry. The type is decided from the file's own bytes (plus its extension for formats that share a
// signature); the name and type the browser sends are never trusted.
import { sniffType } from "@/lib/documents";

export type ChatFileType = { mime: string; image: boolean };

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];
const OFFICE: Record<string, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const TEXT: Record<string, string> = { txt: "text/plain", csv: "text/csv" };

const extOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

export function sniffChatFile(bytes: Uint8Array, fileName: string): ChatFileType | null {
  const known = sniffType(bytes);
  if (known) return { mime: known.mime, image: known.mime.startsWith("image/") };
  const ext = extOf(fileName);
  if (OFFICE[ext] && ZIP_MAGIC.every((v, i) => bytes[i] === v)) return { mime: OFFICE[ext], image: false };
  if (TEXT[ext] && !bytes.includes(0)) return { mime: TEXT[ext], image: false };
  return null;
}
