/**
 * Fork-local product identity. Official T3 Code remains a separate app;
 * keep these values here so upstream rebases only collide in this file.
 */
export const APP_BASE_NAME = "T7 Code";
export const APP_ID = "com.t7code.app";
export const APP_SLUG = "t7code";
export const HOME_DIR_NAME = ".t7code";
export const ARTIFACT_NAME_TEMPLATE = "T7-Code-${version}-${arch}.${ext}";
export const AUTO_UPDATES_ENABLED = false;

export function appIdForDevelopment(isDevelopment: boolean): string {
  return isDevelopment ? `${APP_ID}.dev` : APP_ID;
}

export function protocolScheme(isDevelopment: boolean): string {
  return isDevelopment ? `${APP_SLUG}-dev` : APP_SLUG;
}

export function userDataDirName(isDevelopment: boolean): string {
  return isDevelopment ? `${APP_SLUG}-dev` : APP_SLUG;
}

export function legacyUserDataDirName(isDevelopment: boolean): string {
  return isDevelopment ? `${APP_BASE_NAME} (Dev)` : `${APP_BASE_NAME} (Alpha)`;
}

export function linuxWmClass(isDevelopment: boolean): string {
  return protocolScheme(isDevelopment);
}

export function linuxDesktopEntryName(isDevelopment: boolean): string {
  return `${linuxWmClass(isDevelopment)}.desktop`;
}

export function productNameForChannel(channel: "latest" | "nightly"): string {
  return channel === "nightly" ? `${APP_BASE_NAME} (Nightly)` : `${APP_BASE_NAME} (Alpha)`;
}

export const LINUX_URL_HANDLER_DESKTOP_ENTRY_NAME = `${APP_SLUG}-url-handler.desktop`;
export const LINUX_EXECUTABLE_NAME = APP_SLUG;
