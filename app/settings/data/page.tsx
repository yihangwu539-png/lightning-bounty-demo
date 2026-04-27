"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { exportRaw, clearAll, saveProject, saveTask, getProjects, getTasks } from "@/lib/storage";
import { tasksToCSV, projectsToCSV, parseTasksFromCSV, parseProjectsFromCSV } from "@/lib/csv";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";
import type { Project, Task } from "@/lib/types";

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DataPage() {
  const { showToast } = useToast();
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [importingTasks, setImportingTasks] = useState(false);
  const [importingProjects, setImportingProjects] = useState(false);
  const tasksFileRef = useRef<HTMLInputElement>(null);
  const projectsFileRef = useRef<HTMLInputElement>(null);

  function handleExportTasks() {
    const { projects, tasks } = exportRaw();
    downloadCSV(tasksToCSV(tasks, projects), "project-tracker-tasks.csv");
    showToast("Tasks exported as CSV", "success");
  }

  function handleExportProjects() {
    const { projects } = exportRaw();
    downloadCSV(projectsToCSV(projects), "project-tracker-projects.csv");
    showToast("Projects exported as CSV", "success");
  }

  function handleClear() {
    if (!confirm("Clear all data? This cannot be undone.")) return;
    setClearing(true);
    clearAll();
    showToast("All data cleared", "info");
    // Reload to reseed
    setTimeout(() => { router.push("/"); }, 500);
  }

  function handleImportTasks(file: File) {
    setImportingTasks(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          showToast("Could not read file", "warning");
          setImportingTasks(false);
          return;
        }

        // Gather existing task titles (by project) for duplicate detection
        const existingProjects = getProjects();
        const existingTasks = getTasks();
        const existingTitles = new Set<string>();
        const projectNameToId = new Map<string, string>();
        for (const p of existingProjects) {
          projectNameToId.set(p.name, p.id);
        }
        for (const t of existingTasks) {
          const proj = existingProjects.find((p) => p.id === t.projectId);
          existingTitles.add(`${proj?.name ?? t.projectId}::${t.title}`);
        }

        const parsed = parseTasksFromCSV(text, existingTitles);

        if (parsed.errors.length > 0) {
          // Show first few errors as toast warning
          const errorMsgs = parsed.errors.slice(0, 3).map((e) => e.message);
          const extra = parsed.errors.length > 3 ? ` (+${parsed.errors.length - 3} more)` : "";
          showToast(`Import warnings: ${errorMsgs.join("; ")}${extra}`, "warning");
        }

        if (parsed.data.length === 0) {
          if (parsed.errors.length === 0) {
            showToast("No tasks found in file", "info");
          }
          setImportingTasks(false);
          return;
        }

        // Import tasks: find or create projects by name, then save tasks
        let importedCount = 0;
        for (const taskData of parsed.data) {
          let projectId = projectNameToId.get(taskData.projectName);
          if (!projectId) {
            // Create the project if it doesn't exist
            const newProject: Project = {
              id: `import-proj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: taskData.projectName,
              description: `Imported from CSV`,
              status: "active",
              tags: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            saveProject(newProject);
            projectId = newProject.id;
            projectNameToId.set(taskData.projectName, projectId);
          }

          const task: Task = {
            id: taskData.id,
            projectId,
            title: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            assignee: taskData.assignee,
            tags: taskData.tags,
            dueDate: taskData.dueDate,
            createdAt: taskData.createdAt,
            updatedAt: taskData.updatedAt,
          };
          saveTask(task);
          importedCount++;
        }

        showToast(`Imported ${importedCount} task(s) from CSV`, "success");
      } catch (err) {
        showToast(`Error importing tasks: ${err instanceof Error ? err.message : "Unknown error"}`, "warning");
      }
      setImportingTasks(false);
    };
    reader.onerror = () => {
      showToast("Error reading file", "warning");
      setImportingTasks(false);
    };
    reader.readAsText(file);
  }

  function handleImportProjects(file: File) {
    setImportingProjects(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text) {
          showToast("Could not read file", "warning");
          setImportingProjects(false);
          return;
        }

        // Gather existing project names for duplicate detection
        const existingProjects = getProjects();
        const existingNames = new Set(existingProjects.map((p) => p.name));

        const parsed = parseProjectsFromCSV(text, existingNames);

        if (parsed.errors.length > 0) {
          const errorMsgs = parsed.errors.slice(0, 3).map((e) => e.message);
          const extra = parsed.errors.length > 3 ? ` (+${parsed.errors.length - 3} more)` : "";
          showToast(`Import warnings: ${errorMsgs.join("; ")}${extra}`, "warning");
        }

        if (parsed.data.length === 0) {
          if (parsed.errors.length === 0) {
            showToast("No projects found in file", "info");
          }
          setImportingProjects(false);
          return;
        }

        for (const project of parsed.data) {
          saveProject(project);
        }

        showToast(`Imported ${parsed.data.length} project(s) from CSV`, "success");
      } catch (err) {
        showToast(`Error importing projects: ${err instanceof Error ? err.message : "Unknown error"}`, "warning");
      }
      setImportingProjects(false);
    };
    reader.onerror = () => {
      showToast("Error reading file", "warning");
      setImportingProjects(false);
    };
    reader.readAsText(file);
  }

  function handleTasksFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImportTasks(file);
    // Reset so same file can be re-imported
    e.target.value = "";
  }

  function handleProjectsFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImportProjects(file);
    e.target.value = "";
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-[--text] mb-6">Data</h1>

      <section className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[--text-muted] mb-3">Export</h2>
        <div className="border border-[--border] bg-[--surface] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[--text]">Export tasks as CSV</p>
              <p className="text-xs text-[--text-muted]">All tasks with project names, status, priority</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportTasks} aria-label="Export tasks CSV">
              Export
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-[--border] pt-3">
            <div>
              <p className="text-sm font-medium text-[--text]">Export projects as CSV</p>
              <p className="text-xs text-[--text-muted]">All projects with metadata</p>
            </div>
            <Button variant="secondary" size="sm" onClick={handleExportProjects} aria-label="Export projects CSV">
              Export
            </Button>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[--text-muted] mb-3">Import</h2>
        <div className="border border-[--border] bg-[--surface] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[--text]">Import tasks from CSV</p>
              <p className="text-xs text-[--text-muted]">
                Same format as export. Duplicates by title within a project are skipped. New projects are created if needed.
              </p>
            </div>
            <div>
              <input
                ref={tasksFileRef}
                type="file"
                accept=".csv"
                onChange={handleTasksFileChange}
                className="hidden"
                aria-label="Select tasks CSV file"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => tasksFileRef.current?.click()}
                disabled={importingTasks}
                aria-label="Import tasks CSV"
              >
                {importingTasks ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[--border] pt-3">
            <div>
              <p className="text-sm font-medium text-[--text]">Import projects from CSV</p>
              <p className="text-xs text-[--text-muted]">
                Same format as export. Duplicates by name are skipped.
              </p>
            </div>
            <div>
              <input
                ref={projectsFileRef}
                type="file"
                accept=".csv"
                onChange={handleProjectsFileChange}
                className="hidden"
                aria-label="Select projects CSV file"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => projectsFileRef.current?.click()}
                disabled={importingProjects}
                aria-label="Import projects CSV"
              >
                {importingProjects ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-widest text-[--text-muted] mb-3">Danger Zone</h2>
        <div className="border border-red-200 dark:border-red-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[--text]">Clear all data</p>
              <p className="text-xs text-[--text-muted]">Removes all projects and tasks. Seed data will reload.</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleClear}
              disabled={clearing}
              aria-label="Clear all data"
            >
              Clear
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
