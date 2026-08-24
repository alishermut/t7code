import { describe, expect, it } from "vite-plus/test";

import {
  APP_BASE_NAME,
  APP_ID,
  APP_SLUG,
  AUTO_UPDATES_ENABLED,
  HOME_DIR_NAME,
  LINUX_EXECUTABLE_NAME,
  LINUX_URL_HANDLER_DESKTOP_ENTRY_NAME,
  appIdForDevelopment,
  legacyUserDataDirName,
  linuxDesktopEntryName,
  linuxWmClass,
  productNameForChannel,
  protocolScheme,
  userDataDirName,
} from "./appIdentity.ts";

describe("appIdentity", () => {
  it("keeps T7 Code distinct from official T3 Code", () => {
    expect(APP_BASE_NAME).toBe("T7 Code");
    expect(APP_ID).toBe("com.t7code.app");
    expect(APP_SLUG).toBe("t7code");
    expect(HOME_DIR_NAME).toBe(".t7code");
    expect(LINUX_EXECUTABLE_NAME).toBe("t7code");
    expect(LINUX_URL_HANDLER_DESKTOP_ENTRY_NAME).toBe("t7code-url-handler.desktop");
    expect(AUTO_UPDATES_ENABLED).toBe(false);
  });

  it("derives development and production identity from the slug", () => {
    expect(appIdForDevelopment(false)).toBe("com.t7code.app");
    expect(appIdForDevelopment(true)).toBe("com.t7code.app.dev");
    expect(protocolScheme(false)).toBe("t7code");
    expect(protocolScheme(true)).toBe("t7code-dev");
    expect(userDataDirName(false)).toBe("t7code");
    expect(userDataDirName(true)).toBe("t7code-dev");
    expect(legacyUserDataDirName(false)).toBe("T7 Code (Alpha)");
    expect(legacyUserDataDirName(true)).toBe("T7 Code (Dev)");
    expect(linuxWmClass(false)).toBe("t7code");
    expect(linuxWmClass(true)).toBe("t7code-dev");
    expect(linuxDesktopEntryName(false)).toBe("t7code.desktop");
    expect(linuxDesktopEntryName(true)).toBe("t7code-dev.desktop");
  });

  it("names packaged builds by channel without colliding with T3 Code", () => {
    expect(productNameForChannel("latest")).toBe("T7 Code (Alpha)");
    expect(productNameForChannel("nightly")).toBe("T7 Code (Nightly)");
  });
});
