import type { ComponentProps, ReactNode } from "react";

import { Command, CommandFooter, CommandInput, CommandPanel } from "./ui/command";

type CommandPaletteContentProps = Omit<ComponentProps<typeof Command>, "children"> & {
  readonly children: ReactNode;
  readonly footerTrailing?: ReactNode;
  readonly inputAccessory?: ReactNode;
  readonly inputProps: ComponentProps<typeof CommandInput>;
  readonly panelClassName?: string;
  readonly testId?: string;
};

/**
 * Shared command palette chrome. Palette modes provide their query behavior,
 * results, and optional input accessory while retaining one input and panel.
 */
export function CommandPaletteContent({
  children,
  footerTrailing,
  inputAccessory,
  inputProps,
  panelClassName,
  testId,
  ...commandProps
}: CommandPaletteContentProps) {
  return (
    <div className="contents" data-testid={testId}>
      <Command {...commandProps}>
        <div className="relative">
          <CommandInput {...inputProps} />
          {inputAccessory}
        </div>
        <CommandPanel className={panelClassName}>{children}</CommandPanel>
        {footerTrailing ? (
          <CommandFooter className="justify-end">{footerTrailing}</CommandFooter>
        ) : null}
      </Command>
    </div>
  );
}
