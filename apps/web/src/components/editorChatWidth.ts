export const EDITOR_CHAT_WIDTH_STORAGE_KEY = "t3code:editor-chat-width";
export const EDITOR_CHAT_DEFAULT_WIDTH = 26 * 16;
export const EDITOR_CHAT_MIN_WIDTH = 18 * 16;
export const EDITOR_FILE_MIN_WIDTH = 24 * 16;

export function resolveEditorChatMaximumWidth(
  viewportWidth: number,
  leftSidebarWidth: number,
): number {
  return Math.max(
    EDITOR_CHAT_MIN_WIDTH,
    Math.floor(viewportWidth) - leftSidebarWidth - EDITOR_FILE_MIN_WIDTH,
  );
}

export function resolveEditorChatWidth(
  storedWidth: number | null,
  viewportWidth: number,
  leftSidebarWidth: number,
): number {
  const preferredWidth =
    storedWidth === null ? EDITOR_CHAT_DEFAULT_WIDTH : Math.max(EDITOR_CHAT_MIN_WIDTH, storedWidth);
  return Math.min(preferredWidth, resolveEditorChatMaximumWidth(viewportWidth, leftSidebarWidth));
}
