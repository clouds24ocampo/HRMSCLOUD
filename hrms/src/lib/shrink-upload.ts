// Runs in the browser before an upload. Phone photos are often 4-10 MB: shrink them to a sensible size first so the
// form does not fail on a large request. PDFs are never changed, only checked against the limit.
const MAX_SIDE = 2000;
const SHRINK_ABOVE = 1.5 * 1024 * 1024;

export async function prepareUpload(file: File, maxMb: number): Promise<{ file: File } | { error: string }> {
  const limit = maxMb * 1024 * 1024;
  let out = file;
  if (file.type.startsWith("image/") && file.size > SHRINK_ABOVE) {
    try {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
      if (blob && blob.size < file.size) out = new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    } catch {
      // The browser cannot read this image: send the original and let the server decide.
    }
  }
  if (out.size > limit) return { error: `${file.name} is too large (${(out.size / 1024 / 1024).toFixed(1)} MB). The limit is ${maxMb} MB. Choose a smaller file or a photo instead.` };
  return { file: out };
}
