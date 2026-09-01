import { useAtomValue } from "@effect/atom-react";
import type { EnvironmentId } from "@t3tools/contracts";
import { useCallback } from "react";

import { useRemoteOpenResolution } from "../../remoteOpen";
import { serverEnvironment } from "../../state/server";
import { shellEnvironment } from "../../state/shell";
import { useAtomCommand } from "../../state/use-atom-command";
import {
  revealInFileExplorerLabelForKind,
  revealInFileExplorerLabelForOs,
} from "../preview/fileExplorerLabel";

/**
 * Reveal a workspace file in the OS file manager.
 *
 * The reveal happens on the environment that owns the file, not the machine
 * running the browser — driving a remote workspace from a laptop should open
 * the folder where the file actually is, or offer nothing at all. `label` is
 * null exactly when that is impossible (remote transport, or a server that
 * reports no file manager), which is the callers' cue to drop the action
 * rather than show one that fails.
 */
export function useRevealWorkspaceFile(environmentId: EnvironmentId | null): {
  readonly label: string | null;
  readonly reveal: (filePath: string) => void;
} {
  const remoteOpen = useRemoteOpenResolution(environmentId);
  const serverConfig = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });

  const canReveal =
    environmentId !== null &&
    remoteOpen.isResolved &&
    remoteOpen.state.mode === "local-exec" &&
    serverConfig?.shellRevealInFileManager === true &&
    serverConfig.availableEditors.includes("file-manager");

  const label = !canReveal
    ? null
    : serverConfig.shellRevealInFileManagerKind === undefined
      ? revealInFileExplorerLabelForOs(serverConfig.environment.platform.os)
      : revealInFileExplorerLabelForKind(serverConfig.shellRevealInFileManagerKind);

  const reveal = useCallback(
    (filePath: string) => {
      if (environmentId === null) return;
      void openInEditor({
        environmentId,
        input: { cwd: filePath, editor: "file-manager", reveal: true },
      });
    },
    [environmentId, openInEditor],
  );

  return { label, reveal };
}
