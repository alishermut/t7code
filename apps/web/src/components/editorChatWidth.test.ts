import { describe, expect, it } from "vite-plus/test";

import {
  EDITOR_CHAT_DEFAULT_WIDTH,
  EDITOR_CHAT_MIN_WIDTH,
  resolveEditorChatMaximumWidth,
  resolveEditorChatWidth,
} from "./editorChatWidth";

describe("resolveEditorChatWidth", () => {
  it("uses the default width when nothing is stored", () => {
    expect(resolveEditorChatWidth(null, 1600, 256)).toBe(EDITOR_CHAT_DEFAULT_WIDTH);
  });

  it("clamps stored widths to the remaining space beside the file pane", () => {
    expect(resolveEditorChatWidth(900, 1200, 256)).toBe(resolveEditorChatMaximumWidth(1200, 256));
    expect(resolveEditorChatWidth(100, 1600, 256)).toBe(EDITOR_CHAT_MIN_WIDTH);
  });
});
