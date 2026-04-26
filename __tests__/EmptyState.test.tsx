import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "@/components/ui/EmptyState";

describe("EmptyState", () => {
  it("renders title, description, and action button", () => {
    render(
      <EmptyState
        title="No projects yet"
        description="Create your first project"
        actionLabel="New Project"
        onAction={vi.fn()}
      />
    );
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
    expect(screen.getByText("Create your first project")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New Project" })).toBeInTheDocument();
  });

  it("calls onAction when button clicked", () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Empty"
        description="Nothing here"
        actionLabel="Add Item"
        onAction={onAction}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Item" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("has accessible SVG with aria-hidden", () => {
    render(
      <EmptyState
        title="Test"
        description="Test description"
        actionLabel="Action"
        onAction={vi.fn()}
      />
    );
    const svg = document.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("has appropriate ARIA attributes", () => {
    render(
      <EmptyState
        title="Empty section"
        description="No items found"
        actionLabel="Create"
        onAction={vi.fn()}
      />
    );
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Empty state");
  });
});
