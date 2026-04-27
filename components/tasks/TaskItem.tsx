"use client";

import { useCallback, useRef, type DragEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import type { Task } from "@/lib/types";
import { TaskStatusBadge } from "./TaskStatusBadge";
import { TagBadge } from "@/components/tags/TagBadge";

interface TaskItemProps {
  task: Task;
  projectId: string;
  onDelete?: (id: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  index: number;
}

const priorityDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-zinc-400",
};

export function TaskItem({ task, projectId, onDelete, onReorder, index }: TaskItemProps) {
  const dragRef = useRef<HTMLDivElement>(null);
  const dragIndex = useRef<number>(index);
  dragIndex.current = index;

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    // Add a slight delay so the browser renders the drag image
    setTimeout(() => {
      e.currentTarget.classList.add("opacity-50", "border-[--accent]");
    }, 0);
  }, [index]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("border-t-[--accent]");
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("border-t-[--accent]");
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-t-[--accent]");
    // Clear visual style from the dragged item too
    document.querySelectorAll(".opacity-50").forEach((el) => {
      el.classList.remove("opacity-50", "border-[--accent]");
    });
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(fromIdx) && fromIdx !== index && onReorder) {
      onReorder(fromIdx, index);
    }
  }, [index, onReorder]);

  const handleDragEnd = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.currentTarget.classList.remove("opacity-50", "border-[--accent]");
    document.querySelectorAll(".border-t-[--accent]").forEach((el) => {
      el.classList.remove("border-t-[--accent]");
    });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (!onReorder) return;
    if (e.altKey && e.key === "ArrowUp") {
      e.preventDefault();
      if (index > 0) onReorder(index, index - 1);
    }
    if (e.altKey && e.key === "ArrowDown") {
      e.preventDefault();
      onReorder(index, index + 1);
    }
  }, [index, onReorder]);

  return (
    <div
      ref={dragRef}
      draggable={!!onReorder}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
      aria-roledescription="draggable task"
      aria-label={`${task.title}, priority ${task.priority}, status ${task.status}. Use Alt+Arrow keys to reorder.`}
      className={`border border-[--border] bg-[--surface] px-4 py-3 flex items-start gap-3 group hover:border-[--accent] transition-colors ${onReorder ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      {/* Drag handle indicator */}
      {onReorder && (
        <span
          className="mt-1.5 shrink-0 text-[--text-muted] opacity-0 group-hover:opacity-40 transition-opacity select-none font-mono text-xs"
          aria-hidden="true"
        >
          ⠿
        </span>
      )}
      {/* Priority indicator */}
      <span
        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${priorityDot[task.priority]}`}
        title={`Priority: ${task.priority}`}
        aria-label={`Priority: ${task.priority}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/projects/${projectId}/tasks/${task.id}`}
            className="font-medium text-sm text-[--text] hover:text-[--accent] transition-colors truncate"
          >
            {task.title}
          </Link>
          <TaskStatusBadge status={task.status} />
        </div>
        {task.description && (
          <p className="mt-0.5 text-xs text-[--text-muted] line-clamp-1">{task.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {task.tags.map((tag) => (
            <TagBadge key={tag.id} tag={tag} />
          ))}
          {task.assignee && (
            <span className="font-mono text-xs text-[--text-muted]">{task.assignee}</span>
          )}
          {task.dueDate && (
            <span className="font-mono text-xs text-[--text-muted]">due {task.dueDate}</span>
          )}
        </div>
      </div>
      {onDelete && (
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-[--text-muted] hover:text-red-500 text-xs transition-all"
          aria-label={`Delete task ${task.title}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
