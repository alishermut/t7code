import type { ProjectTask, ProjectTaskStatus } from "@t3tools/contracts";
import { Trash2Icon } from "lucide-react";
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
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Textarea } from "../ui/textarea";
import { TASK_STATUS_LABEL, TASK_STATUS_ORDER } from "./taskManager.logic";

export interface TaskEditorDraft {
  readonly title: string;
  readonly notes: string;
  readonly status: ProjectTaskStatus;
}

const STATUS_ITEMS = TASK_STATUS_ORDER.map((status) => ({
  value: status,
  label: TASK_STATUS_LABEL[status],
}));

export function TaskEditorDialog({
  open,
  mode,
  initial,
  onOpenChange,
  onSubmit,
  onDelete,
}: {
  readonly open: boolean;
  readonly mode: "create" | "edit";
  readonly initial: TaskEditorDraft;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (draft: TaskEditorDraft) => Promise<void>;
  readonly onDelete?: (() => Promise<void>) | undefined;
}) {
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [status, setStatus] = useState<ProjectTaskStatus>(initial.status);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(initial.title);
      setNotes(initial.notes);
      setStatus(initial.status);
      setSaving(false);
      setConfirmingDelete(false);
    }
  }, [initial.notes, initial.status, initial.title, open]);

  const submit = async () => {
    const nextTitle = title.trim();
    if (nextTitle.length === 0 || saving) {
      return;
    }
    setSaving(true);
    await onSubmit({ title: nextTitle, notes: notes.trim(), status });
    setSaving(false);
    onOpenChange(false);
  };

  const remove = async () => {
    if (!onDelete || saving) {
      return;
    }
    setSaving(true);
    await onDelete();
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New task" : "Edit task"}</DialogTitle>
          <DialogDescription>
            The name and explanation are what an agent reads when it picks this work up.
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
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Status</span>
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) {
                  setStatus(value as ProjectTaskStatus);
                }
              }}
              items={STATUS_ITEMS}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {STATUS_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </label>
        </div>
        <DialogFooter className="justify-between">
          {onDelete && mode === "edit" ? (
            <Button
              type="button"
              variant={confirmingDelete ? "destructive" : "ghost"}
              size="sm"
              disabled={saving}
              onClick={() => {
                if (confirmingDelete) {
                  void remove();
                } else {
                  setConfirmingDelete(true);
                }
              }}
            >
              <Trash2Icon className="size-4" />
              {confirmingDelete ? "Confirm delete" : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
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
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

export type { ProjectTask };
