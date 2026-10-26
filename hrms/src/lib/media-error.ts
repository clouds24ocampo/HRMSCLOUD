// Turns what getUserMedia throws into something a person can act on, instead of the browser's bare "Permission denied".
export function mediaErrorMessage(err: unknown, video: boolean): string {
  const device = video ? "camera and microphone" : "microphone";
  const name = err instanceof DOMException || err instanceof Error ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return `Access to your ${device} is blocked. Click the lock icon next to the address, allow the ${device} for this site, then try again.`;
    case "NotFoundError":
    case "OverconstrainedError":
      return `No ${device} was found on this device.`;
    case "NotReadableError":
    case "AbortError":
      return `Your ${device} is in use by another app. Close it and try again.`;
    default:
      return err instanceof Error && err.message ? err.message : `The ${device} could not be started.`;
  }
}
