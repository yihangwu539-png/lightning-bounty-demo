import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskItem } from "@/components/tasks/TaskItem";
import type { Task } from "@/lib/types";

const task: Task = {
  id: "task-1",
  projectId: "proj-1",
  title: "Fix the bug",
  description: "Critical production issue",
  status: "blocked",
  priority: "high",
  tags: [{ id: "t1", name: "urgent", color: "#f97316" }],
  assignee: "alice@example.com",
  dueDate: "2024-04-01",
  order: 0,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
};

describe("TaskItem", () => {
  it("renders task title", () => {
    render(<TaskItem task={task} projectId="proj-1" index={0} />);
    expect(screen.getByText("Fix the bug")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<TaskItem task={task} projectId="proj-1" index={0} />);
    expect(screen.getByText("Blocked")).toBeInTheDocument();
  });

  it("renders tag", () => {
    render(<TaskItem task={task} projectId="proj-1" index={0} />);
    expect(screen.getByText("urgent")).toBeInTheDocument();
  });

  it("renders assignee", () => {
    render(<TaskItem task={task} projectId="proj-1" index={0} />);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows delete button when onDelete provided", () => {
    render(<TaskItem task={task} projectId="proj-1" index={0} onDelete={vi.fn()} />);
    expect(screen.getByLabelText(/delete task/i)).toBeInTheDocument();
  });

  it("does not show delete button when onDelete not provided", () => {
    render(<TaskItem task={task} projectId="proj-1" index={0} />);
    expect(screen.queryByLabelText(/delete task/i)).toBeNull();
  });

  it("calls onDelete with task id when delete clicked", () => {
    const onDelete = vi.fn();
    render(<TaskItem task={task} projectId="proj-1" index={0} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText(/delete task/i));
    expect(onDelete).toHaveBeenCalledWith("task-1");
  });

  describe("drag-and-drop reorder", () => {
    it("is draggable when onReorder is provided", () => {
      render(<TaskItem task={task} projectId="proj-1" index={0} onReorder={vi.fn()} />);
      const item = screen.getByRole("listitem");
      expect(item.getAttribute("draggable")).toBe("true");
    });

    it("is not draggable when onReorder is not provided", () => {
      render(<TaskItem task={task} projectId="proj-1" index={0} />);
      const item = screen.getByRole("listitem");
      expect(item.getAttribute("draggable")).toBe("false");
    });

    it("has correct aria label for accessibility", () => {
      render(<TaskItem task={task} projectId="proj-1" index={0} />);
      const item = screen.getByRole("listitem");
      expect(item.getAttribute("aria-label")).toContain("Fix the bug");
      expect(item.getAttribute("aria-label")).toContain("Alt+Arrow");
    });

    it("has tabIndex 0 for keyboard focus", () => {
      render(<TaskItem task={task} projectId="proj-1" index={0} />);
      expect(screen.getByRole("listitem").getAttribute("tabindex")).toBe("0");
    });

    it("calls onReorder with correct indices on Alt+ArrowUp", () => {
      const onReorder = vi.fn();
      render(<TaskItem task={task} projectId="proj-1" index={2} onReorder={onReorder} />);
      const item = screen.getByRole("listitem");
      fireEvent.keyDown(item, { key: "ArrowUp", altKey: true });
      expect(onReorder).toHaveBeenCalledWith(2, 1);
    });

    it("calls onReorder with correct indices on Alt+ArrowDown", () => {
      const onReorder = vi.fn();
      render(<TaskItem task={task} projectId="proj-1" index={2} onReorder={onReorder} />);
      const item = screen.getByRole("listitem");
      fireEvent.keyDown(item, { key: "ArrowDown", altKey: true });
      expect(onReorder).toHaveBeenCalledWith(2, 3);
    });

    it("does not call onReorder for Alt+ArrowUp at index 0", () => {
      const onReorder = vi.fn();
      render(<TaskItem task={task} projectId="proj-1" index={0} onReorder={onReorder} />);
      const item = screen.getByRole("listitem");
      fireEvent.keyDown(item, { key: "ArrowUp", altKey: true });
      expect(onReorder).not.toHaveBeenCalled();
    });

    it("does not call onReorder for non-Alt arrow keys", () => {
      const onReorder = vi.fn();
      render(<TaskItem task={task} projectId="proj-1" index={1} onReorder={onReorder} />);
      const item = screen.getByRole("listitem");
      fireEvent.keyDown(item, { key: "ArrowUp", altKey: false });
      expect(onReorder).not.toHaveBeenCalled();
    });
  });
});
