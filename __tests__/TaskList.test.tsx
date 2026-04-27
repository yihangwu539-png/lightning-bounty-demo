import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskList } from "@/components/tasks/TaskList";
import type { Task } from "@/lib/types";

const tasks: Task[] = [
  { id: "1", projectId: "p1", title: "First task", description: "", status: "todo", priority: "high", tags: [], assignee: "", dueDate: null, order: 0, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: "2", projectId: "p1", title: "Second task", description: "Some details", status: "done", priority: "low", tags: [], assignee: "", dueDate: null, order: 1, createdAt: "2024-01-02T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
  { id: "3", projectId: "p1", title: "Blocked task", description: "", status: "blocked", priority: "medium", tags: [], assignee: "alice", dueDate: null, order: 2, createdAt: "2024-01-03T00:00:00Z", updatedAt: "2024-01-03T00:00:00Z" },
];

describe("TaskList", () => {
  it("renders all tasks", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    expect(screen.getByText("First task")).toBeInTheDocument();
    expect(screen.getByText("Second task")).toBeInTheDocument();
    expect(screen.getByText("Blocked task")).toBeInTheDocument();
  });

  it("shows empty state when no tasks", () => {
    render(<TaskList tasks={[]} projectId="p1" />);
    expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument();
  });

  it("filters tasks by search", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    const searchInput = screen.getByPlaceholderText(/search tasks/i);
    fireEvent.change(searchInput, { target: { value: "second" } });
    expect(screen.getByText("Second task")).toBeInTheDocument();
    expect(screen.queryByText("First task")).toBeNull();
  });

  it("shows count of visible tasks", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    expect(screen.getByText(/3 of 3 tasks/i)).toBeInTheDocument();
  });

  describe("reorder", () => {
    it("calls onReorder with reordered tasks when task is dragged down", () => {
      const onReorder = vi.fn();
      render(<TaskList tasks={tasks} projectId="p1" onReorder={onReorder} />);
      const items = screen.getAllByRole("listitem");
      expect(items).toHaveLength(3);

      // Simulate drag: drop first item (index 0) onto third item (index 2)
      fireEvent.dragStart(items[0], { dataTransfer: { setData: vi.fn(), getData: vi.fn(() => "0") } });
      fireEvent.dragOver(items[2]);
      fireEvent.drop(items[2], { dataTransfer: { setData: vi.fn(), getData: vi.fn(() => "0") } });

      expect(onReorder).toHaveBeenCalledOnce();
      const reordered = onReorder.mock.calls[0][0] as Task[];
      expect(reordered).toHaveLength(3);
      // First task (id: "1") should now be at index 2
      expect(reordered[2].id).toBe("1");
    });

    it("calls onReorder with reordered tasks when task is dragged up", () => {
      const onReorder = vi.fn();
      render(<TaskList tasks={tasks} projectId="p1" onReorder={onReorder} />);
      const items = screen.getAllByRole("listitem");

      // Simulate drag: drop third item (index 2) onto first item (index 0)
      fireEvent.dragStart(items[2], { dataTransfer: { setData: vi.fn(), getData: vi.fn(() => "2") } });
      fireEvent.dragOver(items[0]);
      fireEvent.drop(items[0], { dataTransfer: { setData: vi.fn(), getData: vi.fn(() -> "2") } });

      expect(onReorder).toHaveBeenCalledOnce();
      const reordered = onReorder.mock.calls[0][0] as Task[];
      // Third task (id: "3") should now be at index 0
      expect(reordered[0].id).toBe("3");
      // The moved task should have order=0, others shifted
      expect(reordered.map((t) => t.order)).toEqual([0, 1, 2]);
    });

    it("items have role listitem and correct aria attributes", () => {
      render(<TaskList tasks={tasks} projectId="p1" />);
      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();
      expect(list.getAttribute("aria-label")).toBe("Task list, draggable to reorder");
    });
  });
});
