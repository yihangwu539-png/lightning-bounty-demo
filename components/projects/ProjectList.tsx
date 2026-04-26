"use client";

import { useMemo, useState } from "react";
import type { Project, Task } from "@/lib/types";
import { ProjectCard } from "./ProjectCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { searchProjects } from "@/lib/search";

interface ProjectListProps {
  projects: Project[];
  tasks: Task[];
}

export function ProjectList({ projects, tasks }: ProjectListProps) {
  const [search, setSearch] = useState("");

  const tasksByProject = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    for (const task of tasks) {
      const existing = map.get(task.projectId) ?? { total: 0, done: 0 };
      map.set(task.projectId, {
        total: existing.total + 1,
        done: existing.done + (task.status === "done" ? 1 : 0),
      });
    }
    return map;
  }, [tasks]);

  const visible = useMemo(() => {
    return search ? searchProjects(projects, search) : projects;
  }, [projects, search]);

  if (projects.length === 0) {
    return (
      <EmptyState
        title="No projects yet"
        description="Create your first project to get started"
        actionLabel="New project"
        actionHref="/projects/new"
      />
    );
  }

  return (
    <div className="space-y-4">
      <SearchBar value={search} onChange={setSearch} placeholder="Search projects..." />
      {visible.length === 0 ? (
        <p className="font-mono text-sm text-[--text-muted] py-4">No projects match your search</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
          {visible.map((project) => {
            const counts = tasksByProject.get(project.id) ?? { total: 0, done: 0 };
            return (
              <ProjectCard
                key={project.id}
                project={project}
                taskCount={counts.total}
                doneCount={counts.done}
              />
            );
          })}
        </div>
      )}
      <p className="font-mono text-xs text-[--text-muted]">
        {visible.length} of {projects.length} projects
      </p>
    </div>
  );
}
