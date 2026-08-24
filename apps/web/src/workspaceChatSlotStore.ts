import { create } from "zustand";

interface WorkspaceChatSlotStore {
  readonly slot: HTMLElement | null;
  readonly setSlot: (slot: HTMLElement | null) => void;
}

export const useWorkspaceChatSlotStore = create<WorkspaceChatSlotStore>((set) => ({
  slot: null,
  setSlot: (slot) => set({ slot }),
}));
