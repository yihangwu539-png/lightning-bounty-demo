"use client";

import { useEffect, useState, useCallback } from "react";
import { handleKeydown, registerShortcut } from "@/lib/shortcuts";
import { PomodoroTimer } from "./PomodoroTimer";

/**
 * Floating Pomodoro timer widget that can be toggled with keyboard shortcut (T).
 * Placed once in a layout to make the timer available globally.
 */
export function PomodoroWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const unregister = registerShortcut({
      key: "t",
      description: "Toggle Pomodoro timer",
      action: toggle,
    });

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
      unregister();
    };
  }, [toggle]);

  return (
    <>
      {/* Toggle button — visible on all pages */}
      <button
        onClick={toggle}
        className="fixed bottom-4 right-4 z-30 w-12 h-12 border border-[--border] bg-[--surface] hover:border-[--accent] transition-colors flex items-center justify-center shadow-lg"
        aria-label={isOpen ? "Close Pomodoro timer" : "Open Pomodoro timer"}
        title="Toggle Pomodoro timer (T)"
      >
        <span className="text-lg" role="img" aria-hidden="true">
          🍅
        </span>
      </button>

      {/* Floating panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-30 w-80 shadow-xl">
          <div className="relative">
            <button
              onClick={toggle}
              className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center border border-[--border] bg-[--surface] text-xs text-[--text-muted] hover:text-[--text] hover:border-[--accent] transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
            <PomodoroTimer />
          </div>
        </div>
      )}
    </>
  );
}
