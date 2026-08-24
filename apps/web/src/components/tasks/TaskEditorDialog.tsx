import type { ProjectTask, ProjectTaskStatus } from "@t3tools/contracts";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";

export interface TaskEditorDraft {
  readonly title: string;
  readonly notes: string;
  readonly status: ProjectTaskStatus;
}

export function TaskEditorDialog({
  open,
  mode,
  initial,
  onOpenChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly mode: "create" | "edit";
  readonly initial: TaskEditorDraft;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (draft: TaskEditorDraft) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial.title);
      setNotes(initial.notes);
      setSaving(false);
    }
  }, [initial.notes, initial.title, open]);

  const submit = async () => {
    const nextTitle = title.trim();
    if (nextTitle.length === 0 || saving) {
      return;
    }
    setSaving(true);
    await onSubmit({
      title: nextTitle,
      notes: notes.trim(),
      status: initial.status,
    });
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            The name and explanation become the prompt when an agent claims this work.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 px-6 pb-2">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Name</span>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What should get done?"
              autoFocus
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Explanation</span>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Context, constraints, and what done looks like"
            />
          </label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={title.trim().length === 0 || saving}
            onClick={() => void submit()}
          >
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export type { ProjectTask };
