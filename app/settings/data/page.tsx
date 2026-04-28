"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  exportRaw,
  clearAll,
  getTasks,
  getProjects,
  saveTask,
  saveProject,
} from "@/lib/storage";
import {
  tasksToCSV,
  projectsToCSV,
  parseTasksCSV,
  parseProjectsCSV,
  mergeTasks,
  mergeProjects,
} from "@/lib/csv";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";

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
  const [importing, setImporting] = useState(false);
  const tasksInputRef = useRef<HTMLInputElement>(null);
  const projectsInputRef = useRef<HTMLInputElement>(null);

  // --- Export handlers ---

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

  // --- Import handlers ---

  async function handleImportTasks(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processTasksFile(file);
    if (tasksInputRef.current) tasksInputRef.current.value = "";
  }

  async function handleImportProjects(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    await processProjectsFile(file);
    if (projectsInputRef.current) projectsInputRef.current.value = "";
  }

  async function processTasksFile(file: File) {
    setImporting(true);
    try {
      const raw = await file.text();
      const projects = getProjects();
      const { items, errors } = parseTasksCSV(raw, projects);

      if (errors.length > 0) {
        const msg =
          errors.length > 3
            ? `${errors[0]}\n${errors[1]}\n...and ${errors.length - 2} more`
            : errors.join("\n");
        showToast(`Validation errors: ${msg}`, "error");
      }

      if (items.length === 0) {
        if (errors.length === 0) {
          showToast("No tasks found in CSV", "info");
        }
        setImporting(false);
        return;
      }

      const existing = getTasks();
      const { tasks: merged, skipped } = mergeTasks(existing, items);

      const newTasks = merged.slice(existing.length);
      for (const task of newTasks) {
        saveTask(task);
      }

      const importedCount = newTasks.length;
      let resultMsg = `Imported ${importedCount} task${importedCount !== 1 ? "s" : ""}`;
      if (skipped > 0) {
        resultMsg += `, ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped`;
      }
      showToast(resultMsg, importedCount > 0 ? "success" : "info");
    } catch (err) {
      showToast(
        `Failed to import: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setImporting(false);
    }
  }

  async function processProjectsFile(file: File) {
    setImporting(true);
    try {
      const raw = await file.text();
      const { items, errors } = parseProjectsCSV(raw);

      if (errors.length > 0) {
        const msg =
          errors.length > 3
            ? `${errors[0]}\n${errors[1]}\n...and ${errors.length - 2} more`
            : errors.join("\n");
        showToast(`Validation errors: ${msg}`, "error");
      }

      if (items.length === 0) {
        if (errors.length === 0) {
          showToast("No projects found in CSV", "info");
        }
        setImporting(false);
        return;
      }

      const existing = getProjects();
      const { projects: merged, skipped } = mergeProjects(existing, items);

      const newProjects = merged.slice(existing.length);
      for (const project of newProjects) {
        saveProject(project);
      }

      const importedCount = newProjects.length;
      let resultMsg = `Imported ${importedCount} project${importedCount !== 1 ? "s" : ""}`;
      if (skipped > 0) {
        resultMsg += `, ${skipped} duplicate${skipped !== 1 ? "s" : ""} skipped`;
      }
      showToast(resultMsg, importedCount > 0 ? "success" : "info");
    } catch (err) {
      showToast(
        `Failed to import: ${err instanceof Error ? err.message : "Unknown error"}`,
        "error",
      );
    } finally {
      setImporting(false);
    }
  }

  // --- Danger zone ---

  function handleClear() {
    if (!confirm("Clear all data? This cannot be undone.")) return;
    setClearing(true);
    clearAll();
    showToast("All data cleared", "info");
    setTimeout(() => {
      router.push("/");
    }, 500);
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl text-[--text] mb-6">
        Data
      </h1>

      {/* Export */}
      <section className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[--text-muted] mb-3">
          Export
        </h2>
        <div className="border border-[--border] bg-[--surface] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[--text]">
                Export tasks as CSV
              </p>
              <p className="text-xs text-[--text-muted]">
                All tasks with project names, status, priority
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportTasks}
              aria-label="Export tasks CSV"
            >
              Export
            </Button>
          </div>
          <div className="flex items-center justify-between border-t border-[--border] pt-3">
            <div>
              <p className="text-sm font-medium text-[--text]">
                Export projects as CSV
              </p>
              <p className="text-xs text-[--text-muted]">
                All projects with metadata
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportProjects}
              aria-label="Export projects CSV"
            >
              Export
            </Button>
          </div>
        </div>
      </section>

      {/* Import */}
      <section className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-widest text-[--text-muted] mb-3">
          Import
        </h2>
        <div className="border border-[--border] bg-[--surface] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[--text]">
                Import tasks from CSV
              </p>
              <p className="text-xs text-[--text-muted]">
                Uses the same format as export. Duplicate titles within a
                project are skipped.
              </p>
            </div>
            <div>
              <input
                ref={tasksInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportTasks}
                disabled={importing}
                className="hidden"
                id="import-tasks-csv"
                aria-label="Select tasks CSV file to import"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={importing}
                aria-label="Import tasks CSV"
                onClick={() => tasksInputRef.current?.click()}
              >
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[--border] pt-3">
            <div>
              <p className="text-sm font-medium text-[--text]">
                Import projects from CSV
              </p>
              <p className="text-xs text-[--text-muted]">
                Duplicate project names are skipped.
              </p>
            </div>
            <div>
              <input
                ref={projectsInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportProjects}
                disabled={importing}
                className="hidden"
                id="import-projects-csv"
                aria-label="Select projects CSV file to import"
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={importing}
                aria-label="Import projects CSV"
                onClick={() => projectsInputRef.current?.click()}
              >
                {importing ? "Importing…" : "Import"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section>
        <h2 className="font-mono text-xs uppercase tracking-widest text-[--text-muted] mb-3">
          Danger Zone
        </h2>
        <div className="border border-red-200 dark:border-red-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[--text]">
                Clear all data
              </p>
              <p className="text-xs text-[--text-muted]">
                Removes all projects and tasks. Seed data will reload.
              </p>
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
