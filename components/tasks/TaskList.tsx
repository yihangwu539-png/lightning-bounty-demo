"use client";

import { useState, useMemo } from "react";
import type { Task, SortConfig, FilterConfig } from "@/lib/types";
import { TaskItem } from "./TaskItem";
import { searchTasks } from "@/lib/search";
import { filterTasks } from "@/lib/filters";
import { sortTasks, reorderTasks } from "@/lib/sort";
import { SearchBar } from "@/components/ui/SearchBar";

interface TaskListProps {
  tasks: Task[];
  projectId: string;
  onDelete?: (id: string) => void;
  onReorder?: (reordered: Task[]) => void;
}

export function TaskList({ tasks, projectId, onDelete, onReorder }: TaskListProps) {
  const [search, setSearch] = useState("");
  const [sortConfig] = useState<SortConfig>({ field: "order", direction: "asc" });
  const [filterConfig] = useState<FilterConfig>({});

  const visible = useMemo(() => {
    let result = tasks;
    if (search) result = searchTasks(result, search);
    result = filterTasks(result, filterConfig);
    result = sortTasks(result, sortConfig);
    return result;
  }, [tasks, search, filterConfig, sortConfig]);

  function handleReorder(fromIndex: number, toIndex: number) {
    if (!onReorder) return;
    const reordered = reorderTasks(visible, fromIndex, toIndex);
    onReorder(reordered);
  }

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
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search tasks..."
        className="max-w-xs"
      />
      {visible.length === 0 ? (
        <p className="font-mono text-sm text-[--text-muted] py-4">No tasks match your search</p>
      ) : (
        <div className="space-y-1 stagger" role="list" aria-label="Task list, draggable to reorder">
          {visible.map((task, idx) => (
            <TaskItem
              key={task.id}
              task={task}
              index={idx}
              projectId={projectId}
              onDelete={onDelete}
              onReorder={onReorder ? handleReorder : undefined}
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
