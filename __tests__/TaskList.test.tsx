import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TaskList } from "@/components/tasks/TaskList";
import type { Task } from "@/lib/types";

const tasks: Task[] = [
  { id: "1", projectId: "p1", title: "First task", description: "", status: "todo", priority: "high", tags: [], assignee: "", dueDate: null, createdAt: "2024-01-01T00:00:00Z", updatedAt: "2024-01-01T00:00:00Z" },
  { id: "2", projectId: "p1", title: "Second task", description: "Some details", status: "done", priority: "low", tags: [], assignee: "", dueDate: null, createdAt: "2024-01-02T00:00:00Z", updatedAt: "2024-01-02T00:00:00Z" },
  { id: "3", projectId: "p1", title: "Blocked task", description: "", status: "blocked", priority: "medium", tags: [], assignee: "alice", dueDate: null, createdAt: "2024-01-03T00:00:00Z", updatedAt: "2024-01-03T00:00:00Z" },
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

  it("renders select-all checkbox when there are tasks", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    expect(screen.getByTestId("select-all-checkbox")).toBeInTheDocument();
  });

  it("renders individual task checkboxes", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    expect(screen.getByTestId("select-task-1")).toBeInTheDocument();
    expect(screen.getByTestId("select-task-2")).toBeInTheDocument();
    expect(screen.getByTestId("select-task-3")).toBeInTheDocument();
  });

  it("selects all tasks when select-all is clicked", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    fireEvent.click(screen.getByTestId("select-all-checkbox"));
    expect(screen.getByTestId("select-all-checkbox")).toBeChecked();
    expect(screen.getByTestId("select-task-1")).toBeChecked();
    expect(screen.getByTestId("select-task-2")).toBeChecked();
    expect(screen.getByTestId("select-task-3")).toBeChecked();
  });

  it("shows bulk action bar with count when tasks are selected", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    fireEvent.click(screen.getByTestId("select-task-1"));
    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument();
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    expect(screen.getByTestId("bulk-done-button")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-delete-button")).toBeInTheDocument();
    expect(screen.getByTestId("bulk-clear-button")).toBeInTheDocument();
  });

  it("clears selection via clear button", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    fireEvent.click(screen.getByTestId("select-task-1"));
    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bulk-clear-button"));
    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();
  });

  it("calls onDelete for each selected task on bulk delete", () => {
    const onDelete = vi.fn();
    render(<TaskList tasks={tasks} projectId="p1" onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("select-all-checkbox"));
    fireEvent.click(screen.getByTestId("bulk-delete-button"));
    expect(onDelete).toHaveBeenCalledTimes(3);
    expect(onDelete).toHaveBeenCalledWith("1");
    expect(onDelete).toHaveBeenCalledWith("2");
    expect(onDelete).toHaveBeenCalledWith("3");
  });

  it("hides bulk action bar after bulk delete clears selection", () => {
    const onDelete = vi.fn();
    render(<TaskList tasks={tasks} projectId="p1" onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId("select-all-checkbox"));
    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bulk-delete-button"));
    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();
  });

  it("hides bulk action bar after bulk done clears selection", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    fireEvent.click(screen.getByTestId("select-all-checkbox"));
    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("bulk-done-button"));
    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();
  });

  it("partial select shows bulk action bar", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    // Select only one task
    fireEvent.click(screen.getByTestId("select-task-1"));
    expect(screen.getByTestId("bulk-action-bar")).toBeInTheDocument();
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    // Select a second task
    fireEvent.click(screen.getByTestId("select-task-2"));
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });

  it("deselect removes from bulk count", () => {
    render(<TaskList tasks={tasks} projectId="p1" />);
    fireEvent.click(screen.getByTestId("select-task-1"));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("select-task-1"));
    expect(screen.queryByTestId("bulk-action-bar")).toBeNull();
  });
});
