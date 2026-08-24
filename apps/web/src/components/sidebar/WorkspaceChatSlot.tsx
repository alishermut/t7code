import { useWorkspaceChatSlotStore } from "../../workspaceChatSlotStore";

export function WorkspaceChatSlot() {
  const setSlot = useWorkspaceChatSlotStore((state) => state.setSlot);

  return (
    <div
      ref={setSlot}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      data-workspace-chat-slot=""
    />
  );
}
