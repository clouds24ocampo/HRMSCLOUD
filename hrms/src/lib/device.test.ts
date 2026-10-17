import { describe, expect, it } from "vitest";
import { deviceOf } from "./device";

describe("device evidence on time stamps", () => {
  it("tells phones, tablets and computers apart from the user agent", () => {
    expect(deviceOf("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("PHONE");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-S918B) Chrome/126 Mobile Safari/537.36")).toBe("PHONE");
    expect(deviceOf("Mozilla/5.0 (Linux; Android 14; SM-X710) Chrome/126 Safari/537.36")).toBe("TABLET");
    expect(deviceOf("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)")).toBe("TABLET");
    expect(deviceOf("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36")).toBe("DESKTOP");
  });
});
