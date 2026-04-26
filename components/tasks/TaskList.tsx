"use client";

import { useState, useMemo, useCallback } from "react";
import type { Task, SortConfig, FilterConfig } from "@/lib/types";
import { TaskItem } from "./TaskItem";
import { searchTasks } from "@/lib/search";
import { filterTasks } from "@/lib/filters";
import { sortTasks } from "@/lib/sort";
import { SearchBar } from "@/components/ui/SearchBar";
import { Button } from "@/components/ui/Button";
import { saveTask, deleteTask } from "@/lib/storage";

interface TaskListProps {
  tasks: Task[];
  projectId: string;
  onDelete?: (id: string) => void;
}

export function TaskList({ tasks, projectId, onDelete }: TaskListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig] = useState<SortConfig>({ field: "status", direction: "asc" });
  const [filterConfig] = useState<FilterConfig>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const visible = useMemo(() => {
    let result = tasks;
    if (search) result = searchTasks(result, search);
    result = filterTasks(result, filterConfig);
    result = sortTasks(result, sortConfig);
    return result;
  }, [tasks, search, filterConfig, sortConfig]);

  const allVisibleSelected = useMemo(
    () => visible.length > 0 && visible.every((t) => selectedIds.has(t.id)),
    [visible, selectedIds]
  );

  const handleSelectChange = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (allVisibleSelected) {
      // Deselect all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const t of visible) {
          next.delete(t.id);
        }
        return next;
      });
    } else {
      // Select all visible
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const t of visible) {
          next.add(t.id);
        }
        return next;
      });
    }
  }, [allVisibleSelected, visible]);

  const handleBulkDone = useCallback(() => {
    for (const id of selectedIds) {
      const task = tasks.find((t) => t.id === id);
      if (task && task.status !== "done") {
        const updated = { ...task, status: "done" as const, updatedAt: new Date().toISOString() };
        saveTask(updated);
      }
    }
    setSelectedIds(new Set());
  }, [selectedIds, tasks]);

  const handleBulkDelete = useCallback(() => {
    for (const id of selectedIds) {
      deleteTask(id);
      onDelete?.(id);
    }
    setSelectedIds(new Set());
  }, [selectedIds, onDelete]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  if (tasks.length === 0) {
    return (
      <div className="border border-dashed border-[--border] p-8 text-center">
        <p className="font-mono text-sm text-[--text-muted]">No tasks yet</p>
        <p className="mt-1 text-xs text-[--text-muted]">Create a task to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search tasks..."
          className="max-w-xs"
        />
        {visible.length > 0 && (
          <label className="flex items-center gap-1.5 text-xs text-[--text-muted] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={handleSelectAll}
              className="accent-[--accent]"
              aria-label="Select all visible tasks"
              data-testid="select-all-checkbox"
            />
            Select all
          </label>
        )}
      </div>

      {selectedIds.size > 0 && (
        <div
          className="flex items-center gap-3 px-4 py-2 border border-[--accent] bg-[--accent]/5 rounded"
          data-testid="bulk-action-bar"
        >
          <span className="font-mono text-xs text-[--text-muted] shrink-0">
            {selectedIds.size} selected
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleBulkDone}
            aria-label="Mark selected tasks as done"
            data-testid="bulk-done-button"
          >
            Mark done
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            aria-label="Delete selected tasks"
            data-testid="bulk-delete-button"
          >
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearSelection}
            aria-label="Clear selection"
            data-testid="bulk-clear-button"
          >
            Clear selection
          </Button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="font-mono text-sm text-[--text-muted] py-4">No tasks match your search</p>
      ) : (
        <div className="space-y-1 stagger">
          {visible.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              projectId={projectId}
              onDelete={onDelete}
              selected={selectedIds.has(task.id)}
              onSelectChange={handleSelectChange}
            />
          ))}
        </div>
      )}
      <p className="font-mono text-xs text-[--text-muted]">
        {visible.length} of {tasks.length} tasks
      </p>
    </div>
  );
}
