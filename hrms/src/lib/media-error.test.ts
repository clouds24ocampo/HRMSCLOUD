import { describe, expect, it } from "vitest";
import { mediaErrorMessage } from "./media-error";

const named = (name: string) => Object.assign(new Error("raw browser text"), { name });

describe("mediaErrorMessage", () => {
  it("explains a blocked permission and how to fix it", () => {
    expect(mediaErrorMessage(named("NotAllowedError"), true)).toMatch(/camera and microphone is blocked/);
    expect(mediaErrorMessage(named("NotAllowedError"), false)).toMatch(/microphone is blocked/);
  });
  it("tells a missing device from a busy one", () => {
    expect(mediaErrorMessage(named("NotFoundError"), false)).toMatch(/No microphone/);
    expect(mediaErrorMessage(named("NotReadableError"), true)).toMatch(/in use/);
  });
  it("falls back to the error's own text", () => {
    expect(mediaErrorMessage(new Error("Calls need https"), false)).toBe("Calls need https");
  });
});
